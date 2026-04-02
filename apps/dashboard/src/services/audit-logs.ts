import { apiClient } from './api-client';
import type { AuditLog, PaginatedResponse, PaginationParams } from '@/types';

export type AuditAction =
  | 'FLAG_CREATED'
  | 'FLAG_UPDATED'
  | 'FLAG_DELETED'
  | 'FLAG_ENABLED'
  | 'FLAG_DISABLED'
  | 'FLAG_ROLLOUT_CHANGED'
  | 'SEGMENT_CREATED'
  | 'SEGMENT_UPDATED'
  | 'SEGMENT_DELETED'
  | 'SCHEDULE_CREATED'
  | 'SCHEDULE_UPDATED'
  | 'SCHEDULE_CANCELLED'
  | 'SCHEDULE_EXECUTED'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED'
  | 'API_KEY_DELETED'
  | 'MEMBER_INVITED'
  | 'MEMBER_JOINED'
  | 'MEMBER_REMOVED'
  | 'MEMBER_ROLE_CHANGED'
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_DELETED'
  | 'ENVIRONMENT_CREATED'
  | 'ENVIRONMENT_UPDATED'
  | 'ENVIRONMENT_DELETED';

export type AuditResource =
  | 'FLAG'
  | 'SEGMENT'
  | 'SCHEDULE'
  | 'API_KEY'
  | 'MEMBER'
  | 'PROJECT'
  | 'ENVIRONMENT';

export interface AuditLogFilters extends PaginationParams {
  action?: AuditAction;
  resource?: AuditResource;
  resourceId?: string;
  userId?: string;
  environmentId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogExportOptions {
  format: 'csv' | 'json';
  filters?: AuditLogFilters;
}

export const auditLogsService = {
  async list(
    projectId: string,
    filters?: AuditLogFilters
  ): Promise<PaginatedResponse<AuditLog>> {
    const response = await apiClient.get(`/projects/${projectId}/audit-logs`, {
      params: filters,
    });
    return response.data;
  },

  async get(projectId: string, logId: string): Promise<AuditLog> {
    const response = await apiClient.get(
      `/projects/${projectId}/audit-logs/${logId}`
    );
    return response.data;
  },

  async export(
    projectId: string,
    options: AuditLogExportOptions
  ): Promise<Blob> {
    const response = await apiClient.get(
      `/projects/${projectId}/audit-logs/export`,
      {
        params: {
          format: options.format,
          ...options.filters,
        },
        responseType: 'blob',
      }
    );
    return response.data;
  },

  async getByResource(
    projectId: string,
    resource: AuditResource,
    resourceId: string,
    params?: PaginationParams
  ): Promise<PaginatedResponse<AuditLog>> {
    const response = await apiClient.get(`/projects/${projectId}/audit-logs`, {
      params: {
        resource,
        resourceId,
        ...params,
      },
    });
    return response.data;
  },

  async getByUser(
    projectId: string,
    userId: string,
    params?: PaginationParams
  ): Promise<PaginatedResponse<AuditLog>> {
    const response = await apiClient.get(`/projects/${projectId}/audit-logs`, {
      params: {
        userId,
        ...params,
      },
    });
    return response.data;
  },
};
