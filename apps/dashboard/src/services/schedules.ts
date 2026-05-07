import apiClient, { endpoints } from './api-client';
import type { PaginatedResponse, PaginationParams } from '@/types';

export interface Schedule {
  id: string;
  flagId: string;
  environmentId: string;
  action: 'ENABLE' | 'DISABLE';
  scheduledAt: string;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleInput {
  environmentId: string;
  action: 'ENABLE' | 'DISABLE';
  scheduledAt: string;
}

export const schedulesService = {
  async list(
    projectId: string,
    flagId: string,
    params?: PaginationParams,
  ): Promise<PaginatedResponse<Schedule>> {
    const response = await apiClient.get(endpoints.schedules.list(projectId, flagId), { params });
    return response.data;
  },

  async create(projectId: string, flagId: string, data: CreateScheduleInput): Promise<Schedule> {
    const response = await apiClient.post(endpoints.schedules.create(projectId, flagId), data);
    return response.data;
  },

  async cancel(projectId: string, flagId: string, scheduleId: string): Promise<Schedule> {
    const response = await apiClient.post(
      endpoints.schedules.cancel(projectId, flagId, scheduleId),
    );
    return response.data;
  },
};

export default schedulesService;
