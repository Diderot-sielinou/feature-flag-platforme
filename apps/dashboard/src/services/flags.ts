import apiClient, { endpoints } from './api-client';
import type {
  Flag,
  FlagEnvironmentState,
  CreateFlagDto,
  UpdateFlagDto,
  ToggleFlagDto,
  TargetingRule,
  PaginatedResponse,
  PaginationParams,
  FilterParams,
} from '@/types';

/**
 * Flags API Service
 */
export const flagsApi = {
  /**
   * Get all flags for a project
   */
  async list(
    projectId: string,
    params?: PaginationParams & FilterParams
  ): Promise<PaginatedResponse<Flag>> {
    const response = await apiClient.get(endpoints.flags.list(projectId), { params });
    return response.data;
  },

  /**
   * Get a single flag by ID
   */
  async get(projectId: string, flagId: string): Promise<Flag> {
    const response = await apiClient.get(endpoints.flags.get(projectId, flagId));
    return response.data;
  },

  /**
   * Create a new flag
   */
  async create(projectId: string, data: CreateFlagDto): Promise<Flag> {
    const response = await apiClient.post(endpoints.flags.create(projectId), data);
    return response.data;
  },

  /**
   * Update a flag
   */
  async update(projectId: string, flagId: string, data: UpdateFlagDto): Promise<Flag> {
    const response = await apiClient.patch(endpoints.flags.update(projectId, flagId), data);
    return response.data;
  },

  /**
   * Delete a flag
   */
  async delete(projectId: string, flagId: string): Promise<void> {
    await apiClient.delete(endpoints.flags.delete(projectId, flagId));
  },

  /**
   * Toggle a flag on/off for an environment
   */
  async toggle(projectId: string, flagId: string, data: ToggleFlagDto): Promise<Flag> {
    const response = await apiClient.post(endpoints.flags.toggle(projectId, flagId), data);
    return response.data;
  },

  /**
   * Get all states for a flag across environments
   */
  async getStates(projectId: string, flagId: string): Promise<FlagEnvironmentState[]> {
    const response = await apiClient.get(endpoints.flags.states(projectId, flagId));
    return response.data;
  },

  /**
   * Update flag state for a specific environment
   */
  async updateState(
    projectId: string,
    flagId: string,
    environmentId: string,
    data: {
      enabled?: boolean;
      value?: unknown;
      rules?: TargetingRule[];
      rolloutPercentage?: number;
    }
  ): Promise<FlagEnvironmentState> {
    const response = await apiClient.patch(
      endpoints.flags.updateState(projectId, flagId, environmentId),
      data
    );
    return response.data;
  },
};

export default flagsApi;
