import apiClient, { API_ENDPOINTS } from './api-client';
import type { Schedule, PaginatedResponse, PaginationParams } from '@/types';

export interface CreateScheduleInput {
  projectId: string;
  flagId: string;
  environmentId: string;
  name: string;
  description?: string;
  action: 'ENABLE' | 'DISABLE' | 'UPDATE_VALUE' | 'UPDATE_ROLLOUT';
  scheduledAt: string;
  value?: any;
  rolloutPercentage?: number;
}

export interface UpdateScheduleInput {
  name?: string;
  description?: string;
  scheduledAt?: string;
  action?: 'ENABLE' | 'DISABLE' | 'UPDATE_VALUE' | 'UPDATE_ROLLOUT';
  value?: any;
  rolloutPercentage?: number;
}

export const schedulesService = {
  /**
   * Get all schedules for a project
   */
  async list(projectId: string, params?: PaginationParams): Promise<PaginatedResponse<Schedule>> {
    const response = await apiClient.get(API_ENDPOINTS.schedules.list(projectId), { params });
    return response.data;
  },

  /**
   * Get a single schedule
   */
  async get(projectId: string, scheduleId: string): Promise<Schedule> {
    const response = await apiClient.get(API_ENDPOINTS.schedules.get(projectId, scheduleId));
    return response.data;
  },

  /**
   * Create a new schedule
   */
  async create(data: CreateScheduleInput): Promise<Schedule> {
    const { projectId, ...body } = data;
    const response = await apiClient.post(API_ENDPOINTS.schedules.create(projectId), body);
    return response.data;
  },

  /**
   * Update a schedule
   */
  async update(
    projectId: string,
    scheduleId: string,
    data: UpdateScheduleInput
  ): Promise<Schedule> {
    const response = await apiClient.patch(
      API_ENDPOINTS.schedules.update(projectId, scheduleId),
      data
    );
    return response.data;
  },

  /**
   * Cancel a schedule
   */
  async cancel(projectId: string, scheduleId: string): Promise<Schedule> {
    const response = await apiClient.post(
      API_ENDPOINTS.schedules.cancel(projectId, scheduleId)
    );
    return response.data;
  },

  /**
   * Delete a schedule
   */
  async delete(projectId: string, scheduleId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.schedules.delete(projectId, scheduleId));
  },
};

export default schedulesService;
