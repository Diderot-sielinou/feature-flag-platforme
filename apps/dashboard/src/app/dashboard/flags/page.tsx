'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, Plus, Search, ToggleLeft, ToggleRight, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/shared';
import { useCurrentProject } from '@/stores';
import { useFlags, useToggleFlag, useDeleteFlag } from '@/hooks/use-flags';

export default function FlagsPage() {
  const project = useCurrentProject();
  const { data: flagsData, isLoading } = useFlags(project?.id);
  const toggleFlag = useToggleFlag(project?.id || '');
  const deleteFlag = useDeleteFlag(project?.id || '');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const flags = flagsData?.data || [];
  const filtered = flags.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.key.toLowerCase().includes(search.toLowerCase()),
  );

  if (!project) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <h2 className="text-lg font-medium mb-2">No project selected</h2>
        <p className="text-muted-foreground mb-4">Select a project first to manage flags.</p>
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
          <h1 className="text-3xl font-display font-bold">Feature Flags</h1>
          <p className="text-muted-foreground mt-1">
            Manage feature flags for <span className="font-medium text-foreground">{project.name}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search flags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Flag className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {search ? 'No flags match your search' : 'No feature flags yet'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {search ? 'Try a different search term.' : 'Create your first flag to control feature rollouts.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((flag) => (
              <motion.div
                key={flag.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card variant="interactive">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className={`h-2 w-2 rounded-full ${flag.enabled ? 'bg-green-500' : 'bg-muted-foreground/50'}`} />
                      <div>
                        <p className="font-medium">{flag.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">{flag.key}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={flag.enabled ? 'success' : 'secondary'}>
                        {flag.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      <Switch
                        checked={flag.enabled}
                        onCheckedChange={(enabled) => {
                          toggleFlag.mutate(
                            { flagId: flag.id, data: { enabled } },
                            {
                              onSuccess: () =>
                                toast.success(`${flag.name} ${enabled ? 'enabled' : 'disabled'}`),
                            },
                          );
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget({ id: flag.id, name: flag.name })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Flag"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteFlag.mutateAsync(deleteTarget.id);
            toast.success('Flag deleted');
            setDeleteTarget(null);
          }
        }}
      />
    </motion.div>
  );
}
