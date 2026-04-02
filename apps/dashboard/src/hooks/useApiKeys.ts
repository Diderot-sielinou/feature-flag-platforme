import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiKeysService, CreateApiKeyInput } from '@/services';
import type { ApiKey, PaginationParams } from '@/types';
import { toast } from '@/components/ui/toast';

export const apiKeyKeys = {
  all: ['apiKeys'] as const,
  lists: () => [...apiKeyKeys.all, 'list'] as const,
  list: (projectId: string, params?: PaginationParams) =>
    [...apiKeyKeys.lists(), projectId, params] as const,
  details: () => [...apiKeyKeys.all, 'detail'] as const,
  detail: (projectId: string, keyId: string) =>
    [...apiKeyKeys.details(), projectId, keyId] as const,
};

export function useApiKeys(projectId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: apiKeyKeys.list(projectId, params),
    queryFn: () => apiKeysService.list(projectId, params),
    enabled: !!projectId,
  });
}

export function useApiKey(projectId: string, keyId: string) {
  return useQuery({
    queryKey: apiKeyKeys.detail(projectId, keyId),
    queryFn: () => apiKeysService.get(projectId, keyId),
    enabled: !!projectId && !!keyId,
  });
}

export function useCreateApiKey(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateApiKeyInput) =>
      apiKeysService.create(projectId, data),
    onSuccess: (newKey) => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() });
      // Note: The key secret is only returned on creation
      // The calling component should handle displaying it to the user
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to create API key',
        description: error.message,
      });
    },
  });
}

export function useRevokeApiKey(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (keyId: string) => apiKeysService.revoke(projectId, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() });
      toast.success('API key revoked');
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to revoke API key',
        description: error.message,
      });
    },
  });
}

export function useDeleteApiKey(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (keyId: string) => apiKeysService.delete(projectId, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() });
      toast.success('API key deleted');
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to delete API key',
        description: error.message,
      });
    },
  });
}

export function useRegenerateApiKey(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (keyId: string) => apiKeysService.regenerate(projectId, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() });
      // Note: The new key secret is returned
      // The calling component should handle displaying it to the user
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to regenerate API key',
        description: error.message,
      });
    },
  });
}
