import { apiClient } from './api-client';
import type { ApiKey, PaginatedResponse, PaginationParams } from '@/types';

export interface CreateApiKeyInput {
  name: string;
  type: 'SDK' | 'SERVER';
  environmentId: string;
  permissions?: {
    read: boolean;
    write: boolean;
    admin: boolean;
  };
  expiresAt?: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string; // Only returned on creation
}

export const apiKeysService = {
  async list(
    projectId: string,
    params?: PaginationParams
  ): Promise<PaginatedResponse<ApiKey>> {
    const response = await apiClient.get(`/projects/${projectId}/api-keys`, {
      params,
    });
    return response.data;
  },

  async get(projectId: string, keyId: string): Promise<ApiKey> {
    const response = await apiClient.get(
      `/projects/${projectId}/api-keys/${keyId}`
    );
    return response.data;
  },

  async create(
    projectId: string,
    data: CreateApiKeyInput
  ): Promise<ApiKeyWithSecret> {
    const response = await apiClient.post(
      `/projects/${projectId}/api-keys`,
      data
    );
    return response.data;
  },

  async revoke(projectId: string, keyId: string): Promise<void> {
    await apiClient.post(`/projects/${projectId}/api-keys/${keyId}/revoke`);
  },

  async delete(projectId: string, keyId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/api-keys/${keyId}`);
  },

  async regenerate(
    projectId: string,
    keyId: string
  ): Promise<ApiKeyWithSecret> {
    const response = await apiClient.post(
      `/projects/${projectId}/api-keys/${keyId}/regenerate`
    );
    return response.data;
  },
};
