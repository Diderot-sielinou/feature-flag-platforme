'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Flag,
  FolderKanban,
  Users,
  Activity,
  ArrowUpRight,
  Clock,
  Zap,
  Plus,
  Key,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useProjects } from '@/hooks/use-projects';
import { useCurrentProject } from '@/stores';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const { data: projectsData, isLoading } = useProjects();
  const currentProject = useCurrentProject();

  const projects = projectsData?.data || [];
  const projectCount = projects.length;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here&apos;s an overview of your feature flags platform.
          </p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button variant="glow" className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </Link>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card variant="interactive">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-blue-500/10">
                <FolderKanban className="h-5 w-5 text-blue-500" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold">{projectCount}</p>
              <p className="text-sm text-muted-foreground">Total Projects</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="interactive">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-tangerine/10">
                <Flag className="h-5 w-5 text-tangerine" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold">
                {projects.reduce((sum, p) => sum + (p._count?.flags || 0), 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Flags</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="interactive">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-purple-500/10">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold">
                {projects.reduce((sum, p) => sum + (p._count?.members || 0), 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Members</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Projects List */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-muted-foreground" />
              Your Projects
            </CardTitle>
            <Link href="/dashboard/projects">
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="text-center py-12">
                <FolderKanban className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No projects yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first project to start managing feature flags.
                </p>
                <Link href="/dashboard/projects/new">
                  <Button variant="glow" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create First Project
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.slice(0, 5).map((project) => (
                  <Link
                    key={project.id}
                    href={`/dashboard/projects/${project.id}`}
                    className="flex items-center justify-between p-4 rounded-lg hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-tangerine/10 text-tangerine flex items-center justify-center font-bold text-sm">
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium group-hover:text-tangerine transition-colors">
                          {project.name}
                        </p>
                        <p className="text-sm text-muted-foreground">{project.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Flag className="h-3.5 w-3.5" />
                        {project._count?.flags || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {project._count?.members || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Key className="h-3.5 w-3.5" />
                        {project._count?.environments || 0} envs
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <QuickActionCard
                icon={<FolderKanban className="h-5 w-5" />}
                title="New Project"
                description="Start a new project"
                href="/dashboard/projects/new"
              />
              <QuickActionCard
                icon={<Flag className="h-5 w-5" />}
                title="Feature Flags"
                description="Manage feature flags"
                href={currentProject ? `/dashboard/projects/${currentProject.id}` : '/dashboard/projects'}
              />
              <QuickActionCard
                icon={<Users className="h-5 w-5" />}
                title="Team"
                description="Manage team members"
                href="/dashboard/members"
              />
              <QuickActionCard
                icon={<Activity className="h-5 w-5" />}
                title="Audit Logs"
                description="Check audit history"
                href="/dashboard/audit"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-96 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-8 w-16 mt-4" />
              <Skeleton className="h-4 w-24 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

interface QuickActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}

function QuickActionCard({ icon, title, description, href }: QuickActionCardProps) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-tangerine/30 hover:shadow-lg hover:shadow-tangerine/5 transition-all cursor-pointer group"
      >
        <div className="h-12 w-12 rounded-lg bg-tangerine/10 text-tangerine flex items-center justify-center group-hover:bg-tangerine group-hover:text-white transition-colors">
          {icon}
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </motion.div>
    </Link>
  );
}
