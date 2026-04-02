'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flagsApi } from '@/services/flags';
import type {
  Flag,
  CreateFlagDto,
  UpdateFlagDto,
  ToggleFlagDto,
  PaginationParams,
  FilterParams,
} from '@/types';

// Query keys
export const flagKeys = {
  all: ['flags'] as const,
  lists: () => [...flagKeys.all, 'list'] as const,
  list: (projectId: string, params?: PaginationParams & FilterParams) =>
    [...flagKeys.lists(), projectId, params] as const,
  details: () => [...flagKeys.all, 'detail'] as const,
  detail: (projectId: string, flagId: string) =>
    [...flagKeys.details(), projectId, flagId] as const,
  states: (projectId: string, flagId: string) =>
    [...flagKeys.detail(projectId, flagId), 'states'] as const,
};

/**
 * Hook to fetch all flags for a project
 */
export function useFlags(projectId: string, params?: PaginationParams & FilterParams) {
  return useQuery({
    queryKey: flagKeys.list(projectId, params),
    queryFn: () => flagsApi.list(projectId, params),
    enabled: Boolean(projectId),
  });
}

/**
 * Hook to fetch a single flag
 */
export function useFlag(projectId: string, flagId: string) {
  return useQuery({
    queryKey: flagKeys.detail(projectId, flagId),
    queryFn: () => flagsApi.get(projectId, flagId),
    enabled: Boolean(projectId) && Boolean(flagId),
  });
}

/**
 * Hook to fetch flag states across environments
 */
export function useFlagStates(projectId: string, flagId: string) {
  return useQuery({
    queryKey: flagKeys.states(projectId, flagId),
    queryFn: () => flagsApi.getStates(projectId, flagId),
    enabled: Boolean(projectId) && Boolean(flagId),
  });
}

/**
 * Hook to create a new flag
 */
export function useCreateFlag(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFlagDto) => flagsApi.create(projectId, data),
    onSuccess: (newFlag) => {
      queryClient.invalidateQueries({ queryKey: flagKeys.lists() });
      queryClient.setQueryData(flagKeys.detail(projectId, newFlag.id), newFlag);
    },
  });
}

/**
 * Hook to update a flag
 */
export function useUpdateFlag(projectId: string, flagId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateFlagDto) => flagsApi.update(projectId, flagId, data),
    onSuccess: (updatedFlag) => {
      queryClient.setQueryData(flagKeys.detail(projectId, flagId), updatedFlag);
      queryClient.invalidateQueries({ queryKey: flagKeys.lists() });
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: flagKeys.detail(projectId, flagId) });
      
      const previousFlag = queryClient.getQueryData<Flag>(flagKeys.detail(projectId, flagId));
      
      if (previousFlag) {
        queryClient.setQueryData(flagKeys.detail(projectId, flagId), {
          ...previousFlag,
          ...data,
        });
      }
      
      return { previousFlag };
    },
    onError: (err, data, context) => {
      if (context?.previousFlag) {
        queryClient.setQueryData(flagKeys.detail(projectId, flagId), context.previousFlag);
      }
    },
  });
}

/**
 * Hook to delete a flag
 */
export function useDeleteFlag(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (flagId: string) => flagsApi.delete(projectId, flagId),
    onSuccess: (_, flagId) => {
      queryClient.removeQueries({ queryKey: flagKeys.detail(projectId, flagId) });
      queryClient.invalidateQueries({ queryKey: flagKeys.lists() });
    },
  });
}

/**
 * Hook to toggle a flag
 */
export function useToggleFlag(projectId: string, flagId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ToggleFlagDto) => flagsApi.toggle(projectId, flagId, data),
    onSuccess: (updatedFlag) => {
      queryClient.setQueryData(flagKeys.detail(projectId, flagId), updatedFlag);
      queryClient.invalidateQueries({ queryKey: flagKeys.states(projectId, flagId) });
      queryClient.invalidateQueries({ queryKey: flagKeys.lists() });
    },
    // Optimistic toggle
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: flagKeys.detail(projectId, flagId) });
      
      const previousFlag = queryClient.getQueryData<Flag>(flagKeys.detail(projectId, flagId));
      
      if (previousFlag && previousFlag.states) {
        const updatedStates = previousFlag.states.map((state) =>
          state.environmentId === data.environmentId
            ? { ...state, enabled: data.enabled }
            : state
        );
        
        queryClient.setQueryData(flagKeys.detail(projectId, flagId), {
          ...previousFlag,
          states: updatedStates,
        });
      }
      
      return { previousFlag };
    },
    onError: (err, data, context) => {
      if (context?.previousFlag) {
        queryClient.setQueryData(flagKeys.detail(projectId, flagId), context.previousFlag);
      }
    },
  });
}

/**
 * Hook to update flag state for an environment
 */
export function useUpdateFlagState(projectId: string, flagId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      environmentId,
      ...data
    }: {
      environmentId: string;
      enabled?: boolean;
      value?: unknown;
      rules?: unknown[];
      rolloutPercentage?: number;
    }) => flagsApi.updateState(projectId, flagId, environmentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flagKeys.states(projectId, flagId) });
      queryClient.invalidateQueries({ queryKey: flagKeys.detail(projectId, flagId) });
    },
  });
}
