import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { segmentsService, CreateSegmentInput, UpdateSegmentInput } from '@/services';
import type { Segment, PaginationParams } from '@/types';
import { toast } from '@/components/ui/toast';

export const segmentKeys = {
  all: ['segments'] as const,
  lists: () => [...segmentKeys.all, 'list'] as const,
  list: (projectId: string, params?: PaginationParams) =>
    [...segmentKeys.lists(), projectId, params] as const,
  details: () => [...segmentKeys.all, 'detail'] as const,
  detail: (projectId: string, segmentId: string) =>
    [...segmentKeys.details(), projectId, segmentId] as const,
};

export function useSegments(projectId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: segmentKeys.list(projectId, params),
    queryFn: () => segmentsService.list(projectId, params),
    enabled: !!projectId,
  });
}

export function useSegment(projectId: string, segmentId: string) {
  return useQuery({
    queryKey: segmentKeys.detail(projectId, segmentId),
    queryFn: () => segmentsService.get(projectId, segmentId),
    enabled: !!projectId && !!segmentId,
  });
}

export function useCreateSegment(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSegmentInput) =>
      segmentsService.create(projectId, data),
    onSuccess: (newSegment) => {
      queryClient.invalidateQueries({ queryKey: segmentKeys.lists() });
      toast.success({
        title: 'Segment created',
        description: `${newSegment.name} has been created successfully`,
      });
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to create segment',
        description: error.message,
      });
    },
  });
}

export function useUpdateSegment(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      segmentId,
      data,
    }: {
      segmentId: string;
      data: UpdateSegmentInput;
    }) => segmentsService.update(projectId, segmentId, data),
    onSuccess: (updatedSegment) => {
      queryClient.invalidateQueries({ queryKey: segmentKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: segmentKeys.detail(projectId, updatedSegment.id),
      });
      toast.success({
        title: 'Segment updated',
        description: `${updatedSegment.name} has been updated`,
      });
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to update segment',
        description: error.message,
      });
    },
  });
}

export function useDeleteSegment(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (segmentId: string) =>
      segmentsService.delete(projectId, segmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: segmentKeys.lists() });
      toast.success('Segment deleted');
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to delete segment',
        description: error.message,
      });
    },
  });
}
