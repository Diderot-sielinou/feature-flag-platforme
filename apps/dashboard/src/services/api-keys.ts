import apiClient, { endpoints } from './api-client';
import type { ApiKey, PaginatedResponse, PaginationParams } from '@/types';

export interface CreateApiKeyInput {
  name: string;
  environmentId: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string;
}

export const apiKeysService = {
  async list(
    projectId: string,
    params?: PaginationParams,
  ): Promise<PaginatedResponse<ApiKey>> {
    const response = await apiClient.get(endpoints.apiKeys.list(projectId), {
      params,
    });
    return response.data;
  },

  async get(projectId: string, keyId: string): Promise<ApiKey> {
    const response = await apiClient.get(
      endpoints.apiKeys.get(projectId, keyId),
    );
    return response.data;
  },

  async create(
    projectId: string,
    data: CreateApiKeyInput,
  ): Promise<ApiKeyWithSecret> {
    const response = await apiClient.post(
      endpoints.apiKeys.create(projectId),
      data,
    );
    return response.data;
  },

  async revoke(projectId: string, keyId: string): Promise<void> {
    await apiClient.post(endpoints.apiKeys.revoke(projectId, keyId));
  },

  async rotate(
    projectId: string,
    keyId: string,
  ): Promise<ApiKeyWithSecret> {
    const response = await apiClient.post(
      endpoints.apiKeys.rotate(projectId, keyId),
    );
    return response.data;
  },
};
