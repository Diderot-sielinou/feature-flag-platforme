'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  ArrowLeft,
  Settings,
  Flag,
  Users,
  Key,
  Globe,
  Trash2,
  Plus,
  ChevronRight,
  Copy,
  Check,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/shared';
import { cn, formatRelativeTime, copyToClipboard, getInitials, getEnvironmentColor, getRoleColor } from '@/lib/utils';
import { useProject, useDeleteProject } from '@/hooks/use-projects';
import { useFlags } from '@/hooks/use-flags';
import { useMembers } from '@/hooks/useMembers';
import { useAppStore } from '@/stores';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: flagsData } = useFlags(projectId);
  const { data: membersData } = useMembers(projectId);
  const deleteProject = useDeleteProject();
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);

  const flags = flagsData?.data || [];
  const members = membersData?.data || [];

  // Set as current project when viewing
  useEffect(() => {
    if (project) {
      setCurrentProject(project);
    }
  }, [project, setCurrentProject]);

  const handleCopySlug = async () => {
    if (!project) return;
    await copyToClipboard(project.slug);
    setCopiedSlug(true);
    toast.success('Project slug copied');
    setTimeout(() => setCopiedSlug(false), 2000);
  };

  const handleDelete = async () => {
    await deleteProject.mutateAsync(projectId);
    toast.success('Project deleted');
    router.push('/dashboard/projects');
  };

  if (projectLoading) {
    return <ProjectDetailSkeleton />;
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <FolderKanban className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <h2 className="text-lg font-medium">Project not found</h2>
        <Link href="/dashboard/projects">
          <Button variant="outline" className="mt-4">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/projects" className="hover:text-foreground">
          Projects
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/dashboard/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-tangerine to-rust flex items-center justify-center">
                <FolderKanban className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-display font-bold">{project.name}</h1>
                <button
                  onClick={handleCopySlug}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground font-mono"
                >
                  {project.slug}
                  {copiedSlug ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
            {project.description && (
              <p className="text-muted-foreground max-w-2xl">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-tangerine/10 text-tangerine flex items-center justify-center">
                <Flag className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{project._count?.flags || flags.length}</p>
                <p className="text-xs text-muted-foreground">Feature Flags</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{project._count?.members || members.length}</p>
                <p className="text-xs text-muted-foreground">Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{project._count?.environments || project.environments?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Environments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{project._count?.apiKeys || 0}</p>
                <p className="text-xs text-muted-foreground">API Keys</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="environments">Environments</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Flags */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Feature Flags</CardTitle>
                  <Link href="/dashboard/flags">
                    <Button variant="ghost" size="sm">View all</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {flags.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No flags yet. Create your first flag to get started.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {flags.slice(0, 5).map((flag) => (
                      <div
                        key={flag.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Flag className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{flag.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{flag.key}</p>
                          </div>
                        </div>
                        <Badge variant={flag.enabled ? 'success' : 'secondary'}>
                          {flag.enabled ? 'On' : 'Off'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  <Link href="/dashboard/flags">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Flag className="h-4 w-4" />
                      Manage Feature Flags
                    </Button>
                  </Link>
                  <Link href="/dashboard/api-keys">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Key className="h-4 w-4" />
                      Manage API Keys
                    </Button>
                  </Link>
                  <Link href="/dashboard/members">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Users className="h-4 w-4" />
                      Manage Team
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Project Info */}
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Created</dt>
                  <dd className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {formatRelativeTime(project.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Last Updated</dt>
                  <dd className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {formatRelativeTime(project.updatedAt)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Environments Tab */}
        <TabsContent value="environments">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Environments</CardTitle>
                  <CardDescription>Deployment environments for this project</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(project.environments || []).map((env: { id: string; name: string; slug: string }) => (
                  <div
                    key={env.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', getEnvironmentColor(env.slug))}>
                        <Globe className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{env.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">{env.slug}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {(!project.environments || project.environments.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No environments configured.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>People with access to this project</CardDescription>
                </div>
                <Link href="/dashboard/members">
                  <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Invite Member
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={member.user?.avatarUrl || undefined} />
                        <AvatarFallback>
                          {getInitials(member.user?.fullName || member.user?.email || '?')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.user?.fullName || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{member.user?.email}</p>
                      </div>
                    </div>
                    <Badge className={getRoleColor(member.role)}>
                      {member.role}
                    </Badge>
                  </div>
                ))}
                {members.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No members yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Project"
        description="Are you sure you want to delete this project? This action cannot be undone and will permanently delete all flags, segments, and data."
        confirmLabel="Delete Project"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </motion.div>
  );
}

function ProjectDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-48" />
      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
