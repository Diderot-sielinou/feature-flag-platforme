'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Activity, AlertCircle, Clock, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/lib/utils';
import { useCurrentProject } from '@/stores';
import { useAuditLogs } from '@/hooks/useAuditLogs';

function getActionColor(action: string): string {
  if (action.includes('CREATED')) return 'bg-green-500/10 text-green-500';
  if (action.includes('DELETED') || action.includes('REMOVED')) return 'bg-red-500/10 text-red-500';
  if (action.includes('UPDATED') || action.includes('CHANGED')) return 'bg-blue-500/10 text-blue-500';
  if (action.includes('ENABLED')) return 'bg-green-500/10 text-green-500';
  if (action.includes('DISABLED')) return 'bg-amber-500/10 text-amber-500';
  if (action.includes('INVITED')) return 'bg-purple-500/10 text-purple-500';
  return 'bg-gray-500/10 text-gray-500';
}

export default function AuditLogsPage() {
  const project = useCurrentProject();
  const { data: logsData, isLoading } = useAuditLogs(project?.id || '');

  const logs = logsData?.data || [];

  if (!project) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <h2 className="text-lg font-medium mb-2">No project selected</h2>
        <p className="text-muted-foreground mb-4">Select a project first to view audit logs.</p>
        <Link href="/dashboard/projects">
          <Button variant="glow">Go to Projects</Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Audit Logs</h1>
        <p className="text-muted-foreground mt-1">
          Activity history for <span className="font-medium text-foreground">{project.name}</span>
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No activity yet</h3>
            <p className="text-muted-foreground">
              Actions like creating flags, inviting members, and changing settings will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${getActionColor(log.action)}`}>
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{log.action.replace(/_/g, ' ').toLowerCase()}</span>
                      {log.resourceId && (
                        <span className="text-muted-foreground"> on {log.resourceType?.toLowerCase()}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {log.user && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {log.user.fullName || log.user.email}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(log.createdAt)}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {log.action.split('_')[0]}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
