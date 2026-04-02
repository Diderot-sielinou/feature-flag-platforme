'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/services/projects';
import type { Project, CreateProjectDto, UpdateProjectDto, PaginationParams } from '@/types';

// Query keys
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (params?: PaginationParams) => [...projectKeys.lists(), params] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

/**
 * Hook to fetch all projects
 */
export function useProjects(params?: PaginationParams) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => projectsApi.list(params),
  });
}

/**
 * Hook to fetch a single project
 */
export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectsApi.get(id),
    enabled: Boolean(id),
  });
}

/**
 * Hook to create a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProjectDto) => projectsApi.create(data),
    onSuccess: (newProject) => {
      // Invalidate and refetch projects list
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      // Optionally set the new project in cache
      queryClient.setQueryData(projectKeys.detail(newProject.id), newProject);
    },
  });
}

/**
 * Hook to update a project
 */
export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProjectDto) => projectsApi.update(id, data),
    onSuccess: (updatedProject) => {
      // Update the project in cache
      queryClient.setQueryData(projectKeys.detail(id), updatedProject);
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
    // Optimistic update
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(id) });
      
      const previousProject = queryClient.getQueryData<Project>(projectKeys.detail(id));
      
      if (previousProject) {
        queryClient.setQueryData(projectKeys.detail(id), {
          ...previousProject,
          ...data,
        });
      }
      
      return { previousProject };
    },
    onError: (err, data, context) => {
      // Rollback on error
      if (context?.previousProject) {
        queryClient.setQueryData(projectKeys.detail(id), context.previousProject);
      }
    },
  });
}

/**
 * Hook to delete a project
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}
