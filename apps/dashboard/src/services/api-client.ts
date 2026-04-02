import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

// ========================================
// API CLIENT CONFIGURATION
// ========================================
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * Create a configured Axios instance
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor - Add auth token
  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.accessToken?.toString();
        
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        // User is not authenticated, continue without token
        console.debug('No auth session available');
      }
      
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor - Handle errors
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config;

      // Handle 401 - Token expired
      if (error.response?.status === 401 && originalRequest) {
        try {
          // Try to refresh the session
          const session = await fetchAuthSession({ forceRefresh: true });
          const newToken = session.tokens?.accessToken?.toString();
          
          if (newToken && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return client(originalRequest);
          }
        } catch (refreshError) {
          // Redirect to login if refresh fails
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
          }
        }
      }

      // Handle other errors
      const errorMessage = getErrorMessage(error);
      console.error('API Error:', errorMessage);
      
      return Promise.reject(error);
    }
  );

  return client;
}

/**
 * Extract error message from Axios error
 */
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

// Create and export the API client instance
export const apiClient = createApiClient();

// ========================================
// API ENDPOINTS
// ========================================
export const endpoints = {
  // Auth (handled by Cognito, but we might need some endpoints)
  auth: {
    me: '/auth/me',
    profile: '/auth/profile',
  },

  // Projects
  projects: {
    list: '/management/projects',
    create: '/management/projects',
    get: (id: string) => `/management/projects/${id}`,
    update: (id: string) => `/management/projects/${id}`,
    delete: (id: string) => `/management/projects/${id}`,
  },

  // Environments
  environments: {
    list: (projectId: string) => `/management/projects/${projectId}/environments`,
    create: (projectId: string) => `/management/projects/${projectId}/environments`,
    get: (projectId: string, id: string) => `/management/projects/${projectId}/environments/${id}`,
    update: (projectId: string, id: string) => `/management/projects/${projectId}/environments/${id}`,
    delete: (projectId: string, id: string) => `/management/projects/${projectId}/environments/${id}`,
  },

  // Flags
  flags: {
    list: (projectId: string) => `/management/projects/${projectId}/flags`,
    create: (projectId: string) => `/management/projects/${projectId}/flags`,
    get: (projectId: string, id: string) => `/management/projects/${projectId}/flags/${id}`,
    update: (projectId: string, id: string) => `/management/projects/${projectId}/flags/${id}`,
    delete: (projectId: string, id: string) => `/management/projects/${projectId}/flags/${id}`,
    toggle: (projectId: string, id: string) => `/management/projects/${projectId}/flags/${id}/toggle`,
    states: (projectId: string, id: string) => `/management/projects/${projectId}/flags/${id}/states`,
    updateState: (projectId: string, id: string, envId: string) => 
      `/management/projects/${projectId}/flags/${id}/states/${envId}`,
  },

  // Segments
  segments: {
    list: (projectId: string) => `/management/projects/${projectId}/segments`,
    create: (projectId: string) => `/management/projects/${projectId}/segments`,
    get: (projectId: string, id: string) => `/management/projects/${projectId}/segments/${id}`,
    update: (projectId: string, id: string) => `/management/projects/${projectId}/segments/${id}`,
    delete: (projectId: string, id: string) => `/management/projects/${projectId}/segments/${id}`,
  },

  // Schedules
  schedules: {
    list: (projectId: string, flagId: string) => 
      `/management/projects/${projectId}/flags/${flagId}/schedules`,
    create: (projectId: string, flagId: string) => 
      `/management/projects/${projectId}/flags/${flagId}/schedules`,
    cancel: (projectId: string, flagId: string, id: string) => 
      `/management/projects/${projectId}/flags/${flagId}/schedules/${id}/cancel`,
  },

  // API Keys
  apiKeys: {
    list: (projectId: string) => `/management/projects/${projectId}/api-keys`,
    create: (projectId: string) => `/management/projects/${projectId}/api-keys`,
    get: (projectId: string, id: string) => `/management/projects/${projectId}/api-keys/${id}`,
    revoke: (projectId: string, id: string) => `/management/projects/${projectId}/api-keys/${id}/revoke`,
    rotate: (projectId: string, id: string) => `/management/projects/${projectId}/api-keys/${id}/rotate`,
  },

  // Members
  members: {
    list: (projectId: string) => `/management/projects/${projectId}/members`,
    invite: (projectId: string) => `/management/projects/${projectId}/members/invite`,
    get: (projectId: string, id: string) => `/management/projects/${projectId}/members/${id}`,
    update: (projectId: string, id: string) => `/management/projects/${projectId}/members/${id}`,
    remove: (projectId: string, id: string) => `/management/projects/${projectId}/members/${id}`,
    resendInvite: (projectId: string, id: string) => 
      `/management/projects/${projectId}/members/${id}/resend-invite`,
  },

  // Audit Logs
  audit: {
    list: (projectId: string) => `/management/projects/${projectId}/audit`,
    get: (projectId: string, id: string) => `/management/projects/${projectId}/audit/${id}`,
  },

  // Analytics
  analytics: {
    summary: (projectId: string) => `/management/projects/${projectId}/analytics/summary`,
    flagStats: (projectId: string, flagId: string) => 
      `/management/projects/${projectId}/analytics/flags/${flagId}`,
  },

  // Health
  health: '/health',
};

// ========================================
// HELPER TYPES
// ========================================
export interface RequestConfig {
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
}

export default apiClient;
