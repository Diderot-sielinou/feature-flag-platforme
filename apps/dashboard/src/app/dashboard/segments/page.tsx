'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Search, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/shared';
import { useCurrentProject } from '@/stores';
import { useSegments, useDeleteSegment } from '@/hooks/useSegments';

export default function SegmentsPage() {
  const project = useCurrentProject();
  const { data: segmentsData, isLoading } = useSegments(project?.id || '');
  const deleteSegment = useDeleteSegment(project?.id || '');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const segments = segmentsData?.data || [];
  const filtered = segments.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.key?.toLowerCase().includes(search.toLowerCase()),
  );

  if (!project) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <h2 className="text-lg font-medium mb-2">No project selected</h2>
        <p className="text-muted-foreground mb-4">Select a project first to manage segments.</p>
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
          <h1 className="text-3xl font-display font-bold">Segments</h1>
          <p className="text-muted-foreground mt-1">
            User segments for <span className="font-medium text-foreground">{project.name}</span>
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search segments..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Layers className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {search ? 'No segments match your search' : 'No segments yet'}
            </h3>
            <p className="text-muted-foreground">
              {search ? 'Try a different search term.' : 'Segments let you target specific groups of users.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((segment) => (
              <motion.div key={segment.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <Card variant="interactive">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <Layers className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{segment.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">{segment.key}</p>
                        {segment.description && (
                          <p className="text-xs text-muted-foreground mt-1">{segment.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{segment.rules?.length || 0} rules</Badge>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ id: segment.id, name: segment.name })}>
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
        title="Delete Segment"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteSegment.mutateAsync({ projectId: project.id, segmentId: deleteTarget.id });
            toast.success('Segment deleted');
            setDeleteTarget(null);
          }
        }}
      />
    </motion.div>
  );
}
