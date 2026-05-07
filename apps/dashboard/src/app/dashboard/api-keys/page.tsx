'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, AlertCircle, Trash2, RotateCw, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/shared';
import { cn, formatRelativeTime, copyToClipboard } from '@/lib/utils';
import { useCurrentProject } from '@/stores';
import { useApiKeys, useRevokeApiKey } from '@/hooks/useApiKeys';

export default function ApiKeysPage() {
  const project = useCurrentProject();
  const { data: keysData, isLoading } = useApiKeys(project?.id || '');
  const revokeKey = useRevokeApiKey(project?.id || '');
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const keys = keysData?.data || [];

  const handleCopy = async (text: string, id: string) => {
    await copyToClipboard(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!project) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <h2 className="text-lg font-medium mb-2">No project selected</h2>
        <p className="text-muted-foreground mb-4">Select a project first to manage API keys.</p>
        <Link href="/dashboard/projects">
          <Button variant="glow">Go to Projects</Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">API Keys</h1>
          <p className="text-muted-foreground mt-1">
            Manage API keys for <span className="font-medium text-foreground">{project.name}</span>
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : keys.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Key className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No API keys yet</h3>
            <p className="text-muted-foreground">
              API keys are used by the SDK to evaluate feature flags.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {keys.map((apiKey) => (
              <motion.div key={apiKey.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <Card variant="interactive">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <Key className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{apiKey.name || 'API Key'}</p>
                          <Badge variant={apiKey.status === 'ACTIVE' ? 'success' : 'destructive'}>
                            {apiKey.status || 'Active'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground font-mono">
                            {apiKey.prefix ? `${apiKey.prefix}...` : '••••••••'}
                          </p>
                          <button
                            onClick={() => handleCopy(apiKey.prefix || apiKey.id, apiKey.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {copiedId === apiKey.id ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {formatRelativeTime(apiKey.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setRevokeTarget({ id: apiKey.id, name: apiKey.name || 'this key' })}
                    >
                      Revoke
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={() => setRevokeTarget(null)}
        title="Revoke API Key"
        description={`Are you sure you want to revoke "${revokeTarget?.name}"? Any SDKs using this key will stop working.`}
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={async () => {
          if (revokeTarget) {
            await revokeKey.mutateAsync({ projectId: project.id, keyId: revokeTarget.id });
            toast.success('API key revoked');
            setRevokeTarget(null);
          }
        }}
      />
    </motion.div>
  );
}
