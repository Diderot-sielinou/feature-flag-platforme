import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schedulesService, CreateScheduleInput, UpdateScheduleInput } from '@/services';
import type { Schedule, PaginationParams } from '@/types';
import { toast } from '@/components/ui/toast';

export const scheduleKeys = {
  all: ['schedules'] as const,
  lists: () => [...scheduleKeys.all, 'list'] as const,
  list: (projectId: string, params?: PaginationParams) =>
    [...scheduleKeys.lists(), projectId, params] as const,
  details: () => [...scheduleKeys.all, 'detail'] as const,
  detail: (projectId: string, scheduleId: string) =>
    [...scheduleKeys.details(), projectId, scheduleId] as const,
};

export function useSchedules(projectId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: scheduleKeys.list(projectId, params),
    queryFn: () => schedulesService.list(projectId, params),
    enabled: !!projectId,
  });
}

export function useSchedule(projectId: string, scheduleId: string) {
  return useQuery({
    queryKey: scheduleKeys.detail(projectId, scheduleId),
    queryFn: () => schedulesService.get(projectId, scheduleId),
    enabled: !!projectId && !!scheduleId,
  });
}

export function useCreateSchedule(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateScheduleInput) =>
      schedulesService.create(projectId, data),
    onSuccess: (newSchedule) => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
      toast.success({
        title: 'Schedule created',
        description: `${newSchedule.name} has been scheduled`,
      });
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to create schedule',
        description: error.message,
      });
    },
  });
}

export function useUpdateSchedule(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scheduleId,
      data,
    }: {
      scheduleId: string;
      data: UpdateScheduleInput;
    }) => schedulesService.update(projectId, scheduleId, data),
    onSuccess: (updatedSchedule) => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: scheduleKeys.detail(projectId, updatedSchedule.id),
      });
      toast.success({
        title: 'Schedule updated',
        description: `${updatedSchedule.name} has been updated`,
      });
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to update schedule',
        description: error.message,
      });
    },
  });
}

export function useCancelSchedule(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) =>
      schedulesService.cancel(projectId, scheduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
      toast.success('Schedule cancelled');
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to cancel schedule',
        description: error.message,
      });
    },
  });
}

export function useDeleteSchedule(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) =>
      schedulesService.delete(projectId, scheduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
      toast.success('Schedule deleted');
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to delete schedule',
        description: error.message,
      });
    },
  });
}
