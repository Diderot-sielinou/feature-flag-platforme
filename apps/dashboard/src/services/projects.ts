import apiClient, { endpoints } from './api-client';
import type {
  Project,
  CreateProjectDto,
  UpdateProjectDto,
  PaginatedResponse,
  PaginationParams,
} from '@/types';

/**
 * Projects API Service
 */
export const projectsApi = {
  /**
   * Get all projects
   */
  async list(params?: PaginationParams): Promise<PaginatedResponse<Project>> {
    const response = await apiClient.get(endpoints.projects.list, { params });
    return response.data;
  },

  /**
   * Get a single project by ID
   */
  async get(id: string): Promise<Project> {
    const response = await apiClient.get(endpoints.projects.get(id));
    return response.data;
  },

  /**
   * Create a new project
   */
  async create(data: CreateProjectDto): Promise<Project> {
    const response = await apiClient.post(endpoints.projects.create, data);
    return response.data;
  },

  /**
   * Update a project
   */
  async update(id: string, data: UpdateProjectDto): Promise<Project> {
    const response = await apiClient.patch(endpoints.projects.update(id), data);
    return response.data;
  },

  /**
   * Delete a project
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(endpoints.projects.delete(id));
  },
};

export default projectsApi;
