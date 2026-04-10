const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export const resolveApiAssetUrl = (url = '') => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`;
  return `${API_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

/**
 * Sleep utility for retries
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isNetworkError = (error) =>
  error instanceof TypeError ||
  /failed to fetch|networkerror|load failed/i.test(String(error?.message || ''));

const getUnexpectedResponseMessage = (response, rawText = '') => {
  if (response.status === 413) {
    return 'Uploaded file is too large. Please choose a smaller file.';
  }

  if (response.status === 415) {
    return 'This file type is not supported for this upload.';
  }

  if (response.status >= 500) {
    return 'The server could not process this request right now. Please try again in a moment.';
  }

  const trimmedText = String(rawText || '').trim();
  if (trimmedText && !trimmedText.startsWith('<')) {
    return trimmedText;
  }

  return response.statusText || 'Server error';
};

/**
 * HTTP Client wrapper with retry logic for rate limiting
 */
const apiClient = async (endpoint, options = {}) => {
  const {
    method = 'GET',
    body = null,
    headers = {},
    retries = 3,
  } = options;

  let lastError;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const config = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        credentials: 'include', // Include cookies for JWT
      };

      if (body) {
        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
        if (isFormData) {
          delete config.headers['Content-Type'];
          config.body = body;
        } else {
          config.body = JSON.stringify(body);
        }
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

      // Parse response
      let data;
      const responseText = await response.text();
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = {
          message: getUnexpectedResponseMessage(response, responseText),
        };
      }

      if (!response.ok) {
        const error = new Error(data.message || 'API request failed');
        error.status = response.status;
        error.data = data;

        // Retry on 429 (Too Many Requests) with exponential backoff
        if (response.status === 429 && attempt < retries - 1) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.warn(`Rate limited. Retrying in ${backoffMs}ms... (attempt ${attempt + 1}/${retries})`);
          await sleep(backoffMs);
          lastError = error;
          continue; // Retry
        }

        throw error;
      }

      return data;
    } catch (error) {
      lastError = error;
      if (isNetworkError(error) && attempt < retries - 1) {
        const retryDelayMs = Math.min(600 * (attempt + 1), 2000);
        await sleep(retryDelayMs);
        continue;
      }
      // Only retry on rate limit errors
      if (error.status === 429 && attempt < retries - 1) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        await sleep(backoffMs);
        continue;
      }
      // For other errors, throw immediately
      if (isNetworkError(error)) {
        error.message =
          'Unable to reach the server. Please make sure the backend is running and try again.';
      }
      console.error(`API Error [${endpoint}]:`, error.message);
      throw error;
    }
  }

  // After all retries exhausted
  if (lastError) {
    if (isNetworkError(lastError)) {
      lastError.message =
        'Unable to reach the server. Please make sure the backend is running and try again.';
    }
    console.error(`API Error [${endpoint}]: Max retries exceeded:`, lastError.message);
    throw lastError;
  }
};

/**
 * Fetch with authentication token
 */
const apiRequest = async (endpoint, options = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers = {
    ...options.headers,
  };

  if (token && options.includeAuth !== false) {
    headers.Authorization = `Bearer ${token}`;
  }

  return apiClient(endpoint, { ...options, headers });
};

const apiFormRequest = async (endpoint, formData, options = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = {
    ...(options.headers || {}),
  };

  if (token && options.includeAuth !== false) {
    headers.Authorization = `Bearer ${token}`;
  }

  return apiClient(endpoint, {
    ...options,
    headers,
    body: formData,
  });
};

// Auth API
export const authAPI = {
  register: (data) => apiClient('/auth/register', { method: 'POST', body: data }),
  login: (data) => apiClient('/auth/login', { method: 'POST', body: data }),
  guestLogin: (guestCode) =>
    apiClient('/auth/guest', { method: 'POST', body: { guestCode } }),
  googleLogin: (credential) =>
    apiClient('/auth/google', { method: 'POST', body: { credential } }),
  devLogin: (guestCode) =>
    apiClient('/auth/dev-login', { method: 'POST', body: { guestCode } }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  verifyEmail: (token) => apiClient('/auth/verify-email', { method: 'POST', body: { token } }),
  forgotPassword: (email) => apiClient('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (data) => apiClient('/auth/reset-password', { method: 'POST', body: data }),
  getCurrentUser: () => apiRequest('/auth/me'),
  updateProfile: (data) => apiRequest('/auth/profile', { method: 'PUT', body: data }),
  changePassword: (data) => apiRequest('/auth/change-password', { method: 'POST', body: data }),
};

// Course API
export const courseAPI = {
  getAllSubjects: () => apiClient('/courses/subjects'),
  getSubjectBySlug: (slug) => apiClient(`/courses/subjects/${slug}`),
  getCoursesBySubject: (subjectId) => apiClient(`/courses/subject/${subjectId}`),
  getCourseByCode: (code) => apiClient(`/courses/code/${code}`),
  searchNptelCourses: ({ query, institute = '', limit = 12 }) => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (institute) params.set('institute', institute);
    if (limit) params.set('limit', `${limit}`);
    return apiClient(`/courses/discover/search?${params.toString()}`);
  },
  getNptelCoursePreview: ({ catalogId, courseUrl = '', courseName = '', institute = '', professor = '' }) => {
    const params = new URLSearchParams();
    if (courseUrl) params.set('courseUrl', courseUrl);
    if (courseName) params.set('courseName', courseName);
    if (institute) params.set('institute', institute);
    if (professor) params.set('professor', professor);
    return apiRequest(`/courses/discover/course/${catalogId}?${params.toString()}`);
  },
  importNptelCourse: (payload) => apiRequest('/courses/import-nptel', {
    method: 'POST',
    body: payload,
  }),
};

// Year Instance API
export const yearInstanceAPI = {
  getAllYearInstances: () => apiRequest('/weeks/year-instances'),
  getYearInstances: (courseId) => apiRequest(`/weeks/year-instances/course/${courseId}`),
  getYearInstance: (id) => apiRequest(`/weeks/year-instance/${id}`),
  getWeeks: (yearInstanceId) => apiClient(`/weeks/weeks/${yearInstanceId}`),
  getWeek: (id) => apiRequest(`/weeks/week/${id}`),
  getWeekStats: (weekId) => apiRequest(`/weeks/week/${weekId}/stats`),
  getSubjectDownloadStatus: (courseId) => apiClient(`/weeks/course/${courseId}/subject-download/status`),
  getSubjectDownloadUrl: (courseId) => `${API_BASE_URL}/weeks/course/${courseId}/subject-download`,
};

// Resource API
export const resourceAPI = {
  getResources: (weekId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/resources/resources/${weekId}?${query}`);
  },
  getCourseResources: (courseId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/resources/course/${courseId}?${query}`);
  },
  getResource: (id) => apiRequest(`/resources/resource/${id}`),
  getTrendingResources: (weekId) => apiRequest(`/resources/trending/${weekId}`),
  createResource: (data) => apiRequest('/resources/resources', { method: 'POST', body: data }),
  uploadResourceFile: (formData) =>
    apiFormRequest('/resources/resources/upload', formData, { method: 'POST' }),
  uploadResourcePdf: (formData) =>
    apiFormRequest('/resources/resources/upload', formData, { method: 'POST' }),
  getReviewQueue: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/resources/admin/review-queue${query ? `?${query}` : ''}`);
  },
  approveReviewSubmission: (id, data = {}) =>
    apiRequest(`/resources/admin/review-queue/${id}/approve`, { method: 'POST', body: data }),
  rejectReviewSubmission: (id, data = {}) =>
    apiRequest(`/resources/admin/review-queue/${id}/reject`, { method: 'POST', body: data }),
  updateResource: (id, data) => apiRequest(`/resources/resources/${id}`, { method: 'PUT', body: data }),
  deleteResource: (id) => apiRequest(`/resources/resources/${id}`, { method: 'DELETE' }),
  upvoteResource: (id) => apiRequest(`/resources/resources/${id}/upvote`, { method: 'POST' }),
  downvoteResource: (id) => apiRequest(`/resources/resources/${id}/downvote`, { method: 'POST' }),
  addComment: (id, text) => apiRequest(`/resources/resources/${id}/comments`, {
    method: 'POST',
    body: { text },
  }),
  reportResource: (id, reason) => apiRequest(`/resources/resources/${id}/report`, {
    method: 'POST',
    body: { reason },
  }),
};

// Material API  
export const materialAPI = {
  getWeekMaterials: (weekId) => apiClient(`/weeks/week/${weekId}/materials`),
  addMaterial: (weekId, data) => apiRequest(`/weeks/week/${weekId}/materials`, {
    method: 'POST',
    body: data,
  }),
  removeMaterial: (weekId, materialIndex) => apiRequest(`/weeks/week/${weekId}/materials/${materialIndex}`, {
    method: 'DELETE',
  }),
  syncMaterialsFromNptel: (weekId, courseCode) => apiRequest(`/weeks/week/${weekId}/materials/nptel-sync`, {
    method: 'POST',
    body: { courseCode },
  }),
};

// Assignment API
export const assignmentAPI = {
  extractAssignments: (courseCode) =>
    apiClient('/assignments/extract', {
      method: 'POST',
      body: { courseCode },
    }),
  getAllAssignments: () => apiClient('/assignments'),
  getAssignments: (courseCode) => apiClient(`/assignments/${courseCode}`),
  getSolution: (courseCode, weekNumber) =>
    apiClient(`/assignments/${courseCode}/solution/${weekNumber}`),
  deleteAssignments: (courseCode) =>
    apiClient(`/assignments/${courseCode}`, {
      method: 'DELETE',
    }),
};

export const commonDiscussionAPI = {
  getPosts: () => apiClient('/common-discussion/posts'),
  createPost: (data) =>
    apiRequest('/common-discussion/posts', {
      method: 'POST',
      body: data,
    }),
  addReply: (postId, text) =>
    apiRequest(`/common-discussion/posts/${postId}/replies`, {
      method: 'POST',
      body: { text },
    }),
  deletePost: (postId) =>
    apiRequest(`/common-discussion/posts/${postId}`, {
      method: 'DELETE',
    }),
};

export const studyAnalyticsAPI = {
  trackStudyActivity: (payload) =>
    apiRequest('/study-analytics/track', {
      method: 'POST',
      body: payload,
    }),
  getMyTodaySummary: ({ timezoneOffsetMinutes = 0 } = {}) => {
    const params = new URLSearchParams();
    params.set('timezoneOffsetMinutes', `${timezoneOffsetMinutes}`);
    return apiRequest(`/study-analytics/me/today?${params.toString()}`);
  },
};

export default apiClient;
