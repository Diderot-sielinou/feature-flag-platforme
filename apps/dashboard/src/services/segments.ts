import apiClient, { endpoints } from './api-client';
import type { Segment, PaginatedResponse, PaginationParams } from '@/types';

export interface CreateSegmentInput {
  key: string;
  name: string;
  description?: string;
  rules: {
    attribute: string;
    operator: string;
    value: string;
    negate?: boolean;
  }[];
}

export interface UpdateSegmentInput {
  name?: string;
  description?: string;
  rules?: {
    attribute: string;
    operator: string;
    value: string;
    negate?: boolean;
  }[];
}

export const segmentsService = {
  async list(projectId: string, params?: PaginationParams): Promise<PaginatedResponse<Segment>> {
    const response = await apiClient.get(endpoints.segments.list(projectId), { params });
    return response.data;
  },

  async get(projectId: string, segmentId: string): Promise<Segment> {
    const response = await apiClient.get(endpoints.segments.get(projectId, segmentId));
    return response.data;
  },

  async create(projectId: string, data: CreateSegmentInput): Promise<Segment> {
    const response = await apiClient.post(endpoints.segments.create(projectId), data);
    return response.data;
  },

  async update(projectId: string, segmentId: string, data: UpdateSegmentInput): Promise<Segment> {
    const response = await apiClient.patch(
      endpoints.segments.update(projectId, segmentId),
      data,
    );
    return response.data;
  },

  async delete(projectId: string, segmentId: string): Promise<void> {
    await apiClient.delete(endpoints.segments.delete(projectId, segmentId));
  },
};

export default segmentsService;
