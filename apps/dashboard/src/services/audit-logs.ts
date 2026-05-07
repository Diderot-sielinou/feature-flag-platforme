import apiClient, { endpoints } from './api-client';
import type { AuditLog, PaginatedResponse, PaginationParams } from '@/types';

export type AuditAction =
  | 'FLAG_CREATED'
  | 'FLAG_UPDATED'
  | 'FLAG_DELETED'
  | 'FLAG_ENABLED'
  | 'FLAG_DISABLED'
  | 'MEMBER_INVITED'
  | 'MEMBER_REMOVED'
  | 'MEMBER_ROLE_CHANGED'
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'ENVIRONMENT_CREATED'
  | 'ENVIRONMENT_UPDATED'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED';

export interface AuditLogFilters extends PaginationParams {
  action?: AuditAction;
  resourceId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export const auditLogsService = {
  async list(
    projectId: string,
    filters?: AuditLogFilters,
  ): Promise<PaginatedResponse<AuditLog>> {
    const response = await apiClient.get(endpoints.audit.list(projectId), {
      params: filters,
    });
    return response.data;
  },

  async get(projectId: string, logId: string): Promise<AuditLog> {
    const response = await apiClient.get(
      endpoints.audit.get(projectId, logId),
    );
    return response.data;
  },
};
