const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * HTTP Client wrapper
 */
const apiClient = async (endpoint, options = {}) => {
  const {
    method = 'GET',
    body = null,
    headers = {},
    includeAuth = true,
  } = options;

  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include', // Include cookies for JWT
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    // Parse response
    let data;
    try {
      data = await response.json();
    } catch (e) {
      // Handle non-JSON responses
      data = { message: response.statusText || 'Server error' };
    }

    if (!response.ok) {
      const error = new Error(data.message || 'API request failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error.message);
    throw error;
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

// Auth API
export const authAPI = {
  register: (data) => apiClient('/auth/register', { method: 'POST', body: data }),
  login: (data) => apiClient('/auth/login', { method: 'POST', body: data }),
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
    return apiClient(`/courses/discover/course/${catalogId}?${params.toString()}`);
  },
  importNptelCourse: (payload) => apiClient('/courses/import-nptel', {
    method: 'POST',
    body: payload,
  }),
};

// Year Instance API
export const yearInstanceAPI = {
  getAllYearInstances: () => apiClient('/weeks/year-instances'),
  getYearInstances: (courseId) => apiClient(`/weeks/year-instances/course/${courseId}`),
  getYearInstance: (id) => apiClient(`/weeks/year-instance/${id}`),
  getWeeks: (yearInstanceId) => apiClient(`/weeks/weeks/${yearInstanceId}`),
  getWeek: (id) => apiClient(`/weeks/week/${id}`),
  getWeekStats: (weekId) => apiClient(`/weeks/week/${weekId}/stats`),
};

// Resource API
export const resourceAPI = {
  getResources: (weekId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/resources/resources/${weekId}?${query}`);
  },
  getResource: (id) => apiRequest(`/resources/resource/${id}`),
  getTrendingResources: (weekId) => apiRequest(`/resources/trending/${weekId}`),
  createResource: (data) => apiRequest('/resources/resources', { method: 'POST', body: data }),
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

export default apiClient;
