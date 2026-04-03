import axios, { AxiosInstance, AxiosError } from 'axios';

// ========================================
// API CLIENT CONFIGURATION
// ========================================
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * Create a configured Axios instance.
 * Token injection is handled by setAuthToken() called from the ClerkTokenProvider.
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Response interceptor - Handle errors
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (error.response?.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = '/sign-in';
        }
      }

      const errorMessage = getErrorMessage(error);
      console.error('API Error:', errorMessage);

      return Promise.reject(error);
    },
  );

  return client;
}

function getErrorMessage(error: AxiosError): string {
  if (error.response?.data) {
    const data = error.response.data as { message?: string; error?: { message?: string } };
    return data.message || data.error?.message || 'An error occurred';
  }

  if (error.message) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

export const apiClient = createApiClient();

/**
 * Set the auth token on the API client.
 * Called by the ClerkTokenProvider whenever the token changes.
 */
export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
}

// ========================================
// API ENDPOINTS
// ========================================
export const endpoints = {
  auth: {
    me: '/auth/me',
    profile: '/auth/profile',
  },

  projects: {
    list: '/management/projects',
    create: '/management/projects',
    get: (id: string) => `/management/projects/${id}`,
    update: (id: string) => `/management/projects/${id}`,
    delete: (id: string) => `/management/projects/${id}`,
  },

  environments: {
    list: (projectId: string) => `/management/projects/${projectId}/environments`,
    create: (projectId: string) => `/management/projects/${projectId}/environments`,
    get: (projectId: string, id: string) => `/management/projects/${projectId}/environments/${id}`,
    update: (projectId: string, id: string) =>
      `/management/projects/${projectId}/environments/${id}`,
    delete: (projectId: string, id: string) =>
      `/management/projects/${projectId}/environments/${id}`,
  },

  flags: {
    list: (projectId: string) => `/management/projects/${projectId}/flags`,
    create: (projectId: string) => `/management/projects/${projectId}/flags`,
    get: (projectId: string, id: string) => `/management/projects/${projectId}/flags/${id}`,
    update: (projectId: string, id: string) => `/management/projects/${projectId}/flags/${id}`,
    delete: (projectId: string, id: string) => `/management/projects/${projectId}/flags/${id}`,
    toggle: (projectId: string, id: string) =>
      `/management/projects/${projectId}/flags/${id}/toggle`,
    states: (projectId: string, id: string) =>
      `/management/projects/${projectId}/flags/${id}/states`,
    updateState: (projectId: string, id: string, envId: string) =>
      `/management/projects/${projectId}/flags/${id}/states/${envId}`,
  },

  segments: {
    list: (projectId: string) => `/management/projects/${projectId}/segments`,
    create: (projectId: string) => `/management/projects/${projectId}/segments`,
    get: (projectId: string, id: string) => `/management/projects/${projectId}/segments/${id}`,
    update: (projectId: string, id: string) => `/management/projects/${projectId}/segments/${id}`,
    delete: (projectId: string, id: string) => `/management/projects/${projectId}/segments/${id}`,
  },

  schedules: {
    list: (projectId: string, flagId: string) =>
      `/management/projects/${projectId}/flags/${flagId}/schedules`,
    create: (projectId: string, flagId: string) =>
      `/management/projects/${projectId}/flags/${flagId}/schedules`,
    cancel: (projectId: string, flagId: string, id: string) =>
      `/management/projects/${projectId}/flags/${flagId}/schedules/${id}/cancel`,
  },

  apiKeys: {
    list: (projectId: string) => `/management/projects/${projectId}/api-keys`,
    create: (projectId: string) => `/management/projects/${projectId}/api-keys`,
    get: (projectId: string, id: string) => `/management/projects/${projectId}/api-keys/${id}`,
    revoke: (projectId: string, id: string) =>
      `/management/projects/${projectId}/api-keys/${id}/revoke`,
    rotate: (projectId: string, id: string) =>
      `/management/projects/${projectId}/api-keys/${id}/rotate`,
  },

  members: {
    list: (projectId: string) => `/management/projects/${projectId}/members`,
    invite: (projectId: string) => `/management/projects/${projectId}/members/invite`,
    get: (projectId: string, id: string) => `/management/projects/${projectId}/members/${id}`,
    update: (projectId: string, id: string) => `/management/projects/${projectId}/members/${id}`,
    remove: (projectId: string, id: string) => `/management/projects/${projectId}/members/${id}`,
    resendInvite: (projectId: string, id: string) =>
      `/management/projects/${projectId}/members/${id}/resend-invite`,
  },

  audit: {
    list: (projectId: string) => `/management/projects/${projectId}/audit`,
    get: (projectId: string, id: string) => `/management/projects/${projectId}/audit/${id}`,
  },

  analytics: {
    summary: (projectId: string) => `/management/projects/${projectId}/analytics/summary`,
    flagStats: (projectId: string, flagId: string) =>
      `/management/projects/${projectId}/analytics/flags/${flagId}`,
  },

  health: '/health',
};

export interface RequestConfig {
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
}

export default apiClient;
