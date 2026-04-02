import { useQuery, useMutation } from '@tanstack/react-query';
import {
  auditLogsService,
  AuditLogFilters,
  AuditLogExportOptions,
  AuditResource,
} from '@/services';
import type { AuditLog, PaginationParams } from '@/types';
import { toast } from '@/components/ui/toast';

export const auditLogKeys = {
  all: ['auditLogs'] as const,
  lists: () => [...auditLogKeys.all, 'list'] as const,
  list: (projectId: string, filters?: AuditLogFilters) =>
    [...auditLogKeys.lists(), projectId, filters] as const,
  details: () => [...auditLogKeys.all, 'detail'] as const,
  detail: (projectId: string, logId: string) =>
    [...auditLogKeys.details(), projectId, logId] as const,
  byResource: (
    projectId: string,
    resource: AuditResource,
    resourceId: string
  ) => [...auditLogKeys.all, 'resource', projectId, resource, resourceId] as const,
  byUser: (projectId: string, userId: string) =>
    [...auditLogKeys.all, 'user', projectId, userId] as const,
};

export function useAuditLogs(projectId: string, filters?: AuditLogFilters) {
  return useQuery({
    queryKey: auditLogKeys.list(projectId, filters),
    queryFn: () => auditLogsService.list(projectId, filters),
    enabled: !!projectId,
  });
}

export function useAuditLog(projectId: string, logId: string) {
  return useQuery({
    queryKey: auditLogKeys.detail(projectId, logId),
    queryFn: () => auditLogsService.get(projectId, logId),
    enabled: !!projectId && !!logId,
  });
}

export function useAuditLogsByResource(
  projectId: string,
  resource: AuditResource,
  resourceId: string,
  params?: PaginationParams
) {
  return useQuery({
    queryKey: auditLogKeys.byResource(projectId, resource, resourceId),
    queryFn: () =>
      auditLogsService.getByResource(projectId, resource, resourceId, params),
    enabled: !!projectId && !!resource && !!resourceId,
  });
}

export function useAuditLogsByUser(
  projectId: string,
  userId: string,
  params?: PaginationParams
) {
  return useQuery({
    queryKey: auditLogKeys.byUser(projectId, userId),
    queryFn: () => auditLogsService.getByUser(projectId, userId, params),
    enabled: !!projectId && !!userId,
  });
}

export function useExportAuditLogs(projectId: string) {
  return useMutation({
    mutationFn: (options: AuditLogExportOptions) =>
      auditLogsService.export(projectId, options),
    onSuccess: (blob, variables) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs.${variables.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Audit logs exported');
    },
    onError: (error: Error) => {
      toast.error({
        title: 'Failed to export audit logs',
        description: error.message,
      });
    },
  });
}
