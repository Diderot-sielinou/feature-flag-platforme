'use client';

import React, { useState } from 'react';
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
  BarChart3,
  Globe,
  Pencil,
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
import { toast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/shared';
import { cn, formatRelativeTime, copyToClipboard, getInitials } from '@/lib/utils';

// Mock project data
const mockProject = {
  id: '1',
  name: 'E-commerce Platform',
  slug: 'ecommerce-platform',
  description: 'Main e-commerce application with feature flags for checkout, payments, and user experience improvements.',
  createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  environments: [
    { id: 'dev', name: 'Development', slug: 'development', color: '#22c55e' },
    { id: 'staging', name: 'Staging', slug: 'staging', color: '#f59e0b' },
    { id: 'prod', name: 'Production', slug: 'production', color: '#ef4444' },
  ],
  stats: {
    flags: 24,
    segments: 8,
    members: 6,
    apiKeys: 4,
  },
  members: [
    { id: '1', fullName: 'John Doe', email: 'john@example.com', role: 'OWNER', avatarUrl: null },
    { id: '2', fullName: 'Sarah Chen', email: 'sarah@example.com', role: 'ADMIN', avatarUrl: null },
    { id: '3', fullName: 'Mike Johnson', email: 'mike@example.com', role: 'EDITOR', avatarUrl: null },
  ],
  recentFlags: [
    { id: '1', name: 'Dark Mode', key: 'dark-mode', enabled: true },
    { id: '2', name: 'New Checkout', key: 'new-checkout', enabled: true },
    { id: '3', name: 'Beta Features', key: 'beta-features', enabled: false },
  ],
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project] = useState(mockProject);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);

  const handleCopySlug = async () => {
    await copyToClipboard(project.slug);
    setCopiedSlug(true);
    toast.success('Project slug copied');
    setTimeout(() => setCopiedSlug(false), 2000);
  };

  const handleDelete = async () => {
    // API call would go here
    toast.success('Project deleted');
    router.push('/dashboard/projects');
  };

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
            <p className="text-muted-foreground max-w-2xl">{project.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/settings`}>
            <Button variant="outline" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </Link>
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
                <p className="text-2xl font-bold">{project.stats.flags}</p>
                <p className="text-xs text-muted-foreground">Feature Flags</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{project.stats.segments}</p>
                <p className="text-xs text-muted-foreground">Segments</p>
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
                <p className="text-2xl font-bold">{project.stats.members}</p>
                <p className="text-xs text-muted-foreground">Members</p>
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
                <p className="text-2xl font-bold">{project.stats.apiKeys}</p>
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
                  <CardTitle>Recent Flags</CardTitle>
                  <Link href="/dashboard/flags">
                    <Button variant="ghost" size="sm">
                      View all
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {project.recentFlags.map((flag) => (
                    <Link
                      key={flag.id}
                      href={`/dashboard/flags/${flag.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Flag className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{flag.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {flag.key}
                          </p>
                        </div>
                      </div>
                      <Badge variant={flag.enabled ? 'success' : 'secondary'}>
                        {flag.enabled ? 'On' : 'Off'}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  <Link href="/dashboard/flags/new">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Plus className="h-4 w-4" />
                      Create Feature Flag
                    </Button>
                  </Link>
                  <Link href="/dashboard/segments/new">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Plus className="h-4 w-4" />
                      Create Segment
                    </Button>
                  </Link>
                  <Link href="/dashboard/api-keys/new">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Plus className="h-4 w-4" />
                      Generate API Key
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
                  <CardDescription>
                    Manage deployment environments for this project
                  </CardDescription>
                </div>
                <Button variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Environment
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {project.environments.map((env) => (
                  <div
                    key={env.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${env.color}20` }}
                      >
                        <Globe className="h-5 w-5" style={{ color: env.color }} />
                      </div>
                      <div>
                        <p className="font-medium">{env.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {env.slug}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      Configure
                    </Button>
                  </div>
                ))}
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
                  <CardDescription>
                    People with access to this project
                  </CardDescription>
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
                {project.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={member.avatarUrl || undefined} />
                        <AvatarFallback>
                          {getInitials(member.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.fullName}</p>
                        <p className="text-sm text-muted-foreground">
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        member.role === 'OWNER'
                          ? 'default'
                          : member.role === 'ADMIN'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {member.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Project"
        description="Are you sure you want to delete this project? This action cannot be undone and will permanently delete all flags, segments, and data associated with this project."
        confirmLabel="Delete Project"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </motion.div>
  );
}
