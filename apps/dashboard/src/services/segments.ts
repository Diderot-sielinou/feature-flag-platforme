import apiClient, { API_ENDPOINTS } from './api-client';
import type { Segment, PaginatedResponse, PaginationParams } from '@/types';

export interface CreateSegmentInput {
  projectId: string;
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
  /**
   * Get all segments for a project
   */
  async list(projectId: string, params?: PaginationParams): Promise<PaginatedResponse<Segment>> {
    const response = await apiClient.get(API_ENDPOINTS.segments.list(projectId), { params });
    return response.data;
  },

  /**
   * Get a single segment
   */
  async get(projectId: string, segmentId: string): Promise<Segment> {
    const response = await apiClient.get(API_ENDPOINTS.segments.get(projectId, segmentId));
    return response.data;
  },

  /**
   * Create a new segment
   */
  async create(data: CreateSegmentInput): Promise<Segment> {
    const { projectId, ...body } = data;
    const response = await apiClient.post(API_ENDPOINTS.segments.create(projectId), body);
    return response.data;
  },

  /**
   * Update a segment
   */
  async update(projectId: string, segmentId: string, data: UpdateSegmentInput): Promise<Segment> {
    const response = await apiClient.patch(
      API_ENDPOINTS.segments.update(projectId, segmentId),
      data
    );
    return response.data;
  },

  /**
   * Delete a segment
   */
  async delete(projectId: string, segmentId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.segments.delete(projectId, segmentId));
  },
};

export default segmentsService;
