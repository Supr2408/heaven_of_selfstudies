const API_BASE_URL =
  process.env.NEXT_PUBLIC_PRIVATE_ANALYTICS_URL || 'http://localhost:5100/api';

const TOKEN_KEY = 'private-analytics-admin-token';

export const getStoredToken = () =>
  typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : '';

export const setStoredToken = (token) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TOKEN_KEY, token);
  }
};

export const clearStoredToken = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TOKEN_KEY);
  }
};

const request = async (path, options = {}) => {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (options.expectBlob) {
    if (!response.ok) {
      const text = await response.text();
      const error = new Error(text || 'Request failed');
      error.status = response.status;
      throw error;
    }

    return response.blob();
  }

  const data = await response.json().catch(() => ({
    success: false,
    message: response.statusText || 'Request failed',
  }));

  if (!response.ok) {
    const error = new Error(data.message || 'Request failed');
    error.status = response.status;
    throw error;
  }

  return data;
};

export const loginAdmin = async ({ username, password }) => {
  const response = await request('/auth/login', {
    method: 'POST',
    body: { username, password },
  });

  const token = response?.data?.token || '';
  if (token) {
    setStoredToken(token);
  }

  return response;
};

export const fetchAdminProfile = () => request('/auth/me');
export const fetchAdminLiveSummary = () => request('/summary/admin/live');
export const fetchAdminDailySummary = (dateKey) =>
  request(`/summary/admin/daily?dateKey=${encodeURIComponent(dateKey || '')}`);

export const exportDailyWorkbook = async (dateKey) => {
  const blob = await request(
    `/export/admin/daily.xlsx?dateKey=${encodeURIComponent(dateKey || '')}`,
    { expectBlob: true }
  );
  const fileUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = fileUrl;
  anchor.download = `nptel-analytics-${dateKey || 'all'}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(fileUrl);
};
