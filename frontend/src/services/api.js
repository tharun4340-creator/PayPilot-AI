// Single place that talks to the PayPilot AI backend.
// Every function below maps to one endpoint in documentation/api-documentation.md.

const BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
export const TOKEN_KEY = 'paypilot_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable */
  }
}
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

const GENERIC_MESSAGE = 'Something went wrong. Please check the details you entered and try again.';

function messageFromDetail(detail, status) {
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (status >= 500) return 'The server had a problem. Please try again in a moment.';
  return GENERIC_MESSAGE;
}

function buildQuery(query) {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.append(key, String(value));
  });
  const s = params.toString();
  return s ? `?${s}` : '';
}

function isAuthPath(path) {
  return path.startsWith('/auth/login') || path.startsWith('/auth/register');
}

async function send(path, { method = 'GET', body, query, headers = {} } = {}) {
  const finalHeaders = { Accept: 'application/json', ...headers };
  const token = getToken();
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}${buildQuery(query)}`, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      'Could not reach the server. Please check your connection and that the backend is running.',
      0,
      null,
    );
  }

  if (response.status === 401 && !isAuthPath(path)) {
    clearToken();
    if (unauthorizedHandler) unauthorizedHandler();
    else if (window.location.pathname !== '/login') window.location.assign('/login');
    throw new ApiError('Your session has ended. Please sign in again.', 401, null);
  }

  if (!response.ok) {
    let detail = null;
    try {
      const data = await response.json();
      detail = data && data.detail !== undefined ? data.detail : null;
    } catch {
      detail = null;
    }
    throw new ApiError(messageFromDetail(detail, response.status), response.status, detail);
  }
  return response;
}

async function request(path, options) {
  const response = await send(path, options);
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Fetch a protected file (needs the Authorization header) and save it through the browser. */
export async function downloadFile(path, filename, query) {
  const response = await send(path, { query, headers: { Accept: '*/*' } });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------ System ------------------------------ */
export const getSystemStatus = () => request('/system/status');

/* ------------------------------ Auth & profile ------------------------------ */
export const register = (body) => request('/auth/register', { method: 'POST', body });
export const login = (body) => request('/auth/login', { method: 'POST', body });
export const getMe = () => request('/auth/me');
export const logout = () => request('/auth/logout', { method: 'POST' });
export const updateMe = (body) => request('/users/me', { method: 'PATCH', body });

/* ------------------------------ Customers ------------------------------ */
export const getCustomers = () => request('/customers');
export const createCustomer = (body) => request('/customers', { method: 'POST', body });
export const getCustomer = (id) => request(`/customers/${encodeURIComponent(id)}`);

/* ------------------------------ Payments ------------------------------ */
export const getPayments = (query) => request('/payments', { query });
export const createPayment = (body) => request('/payments', { method: 'POST', body });
export const getPayment = (id) => request(`/payments/${encodeURIComponent(id)}`);
export const verifyPayment = (id) => request(`/payments/${encodeURIComponent(id)}/verify`, { method: 'POST' });
export const capturePayment = (id, body) =>
  request(`/payments/${encodeURIComponent(id)}/capture`, { method: 'POST', body });
export const getPaymentByOrder = (orderId) => request(`/payments/by-order/${encodeURIComponent(orderId)}`);

/* ------------------------------ Invoices ------------------------------ */
export const getInvoices = (query) => request('/invoices', { query });
export const createInvoice = (body) => request('/invoices', { method: 'POST', body });
export const getInvoice = (id) => request(`/invoices/${encodeURIComponent(id)}`);
export const updateInvoice = (id, body) =>
  request(`/invoices/${encodeURIComponent(id)}`, { method: 'PATCH', body });
export const downloadInvoicePdf = (id, filename) =>
  downloadFile(`/invoices/${encodeURIComponent(id)}/pdf`, filename || `invoice-${id}.pdf`);
export const payInvoice = (id, body) =>
  request(`/invoices/${encodeURIComponent(id)}/pay`, { method: 'POST', body });
export const sendInvoice = (id, body) =>
  request(`/invoices/${encodeURIComponent(id)}/send`, { method: 'POST', body });
export const checkInvoiceDuplicate = (body) =>
  request('/invoices/check-duplicate', { method: 'POST', body });
export const suggestDescription = (body) =>
  request('/invoices/suggest-description', { method: 'POST', body });

/* ------------------------------ Analytics ------------------------------ */
export const getDashboard = (query) => request('/analytics/dashboard', { query });
export const getInsights = (query) => request('/analytics/insights', { query });
export const askAnalytics = (body) => request('/analytics/ask', { method: 'POST', body });
export const getReport = (query) => request('/analytics/report', { query });
export const downloadReportCsv = (month, filename) =>
  downloadFile('/analytics/report.csv', filename || `paypilot-report-${month}.csv`, { month });

/* ------------------------------ Safety ------------------------------ */
export const getSafetyAlerts = (query) => request('/safety/alerts', { query });
export const getSafetyActivity = (query) => request('/safety/activity', { query });
export const checkPaymentSafety = (body) => request('/safety/check-payment', { method: 'POST', body });

/* ------------------------------ AI assistant ------------------------------ */
export const assistantChat = (body) => request('/assistant/chat', { method: 'POST', body });
export const confirmAssistantAction = (id, body) =>
  request(`/assistant/actions/${encodeURIComponent(id)}/confirm`, { method: 'POST', body });
export const cancelAssistantAction = (id) =>
  request(`/assistant/actions/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
export const getConversations = () => request('/assistant/conversations');
export const getConversation = (id) => request(`/assistant/conversations/${encodeURIComponent(id)}`);

/* ------------------------------ Notifications ------------------------------ */
export const getNotifications = () => request('/notifications');
export const markNotificationRead = (id) =>
  request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
export const markAllNotificationsRead = () => request('/notifications/read-all', { method: 'POST' });
export const generateReminders = () => request('/notifications/generate-reminders', { method: 'POST' });

/* ------------------------------ Demo data ------------------------------ */
export const seedDemoData = () => request('/demo/seed', { method: 'POST' });
export const removeDemoData = () => request('/demo', { method: 'DELETE' });
