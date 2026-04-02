'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Flag,
  FolderKanban,
  Users,
  Activity,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Zap,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatRelativeTime, formatNumber } from '@/lib/utils';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// Mock data
const stats = [
  {
    title: 'Total Projects',
    value: '12',
    change: '+2',
    trend: 'up',
    icon: FolderKanban,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    title: 'Active Flags',
    value: '48',
    change: '+7',
    trend: 'up',
    icon: Flag,
    color: 'text-tangerine',
    bgColor: 'bg-tangerine/10',
  },
  {
    title: 'Team Members',
    value: '8',
    change: '+1',
    trend: 'up',
    icon: Users,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    title: 'Evaluations Today',
    value: '24.5K',
    change: '+12%',
    trend: 'up',
    icon: Activity,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
];

const recentActivity = [
  {
    id: '1',
    action: 'Flag enabled',
    target: 'dark-mode',
    environment: 'production',
    user: 'John Doe',
    time: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: '2',
    action: 'Rules updated',
    target: 'beta-features',
    environment: 'staging',
    user: 'Sarah Chen',
    time: new Date(Date.now() - 30 * 60 * 1000),
  },
  {
    id: '3',
    action: 'Flag created',
    target: 'new-checkout',
    environment: 'development',
    user: 'Mike Wilson',
    time: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: '4',
    action: 'Member invited',
    target: 'alice@example.com',
    environment: '',
    user: 'John Doe',
    time: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
  {
    id: '5',
    action: 'Schedule created',
    target: 'holiday-promo',
    environment: 'production',
    user: 'Sarah Chen',
    time: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
];

const topFlags = [
  { name: 'dark-mode', evaluations: 12500, enabled: true },
  { name: 'new-checkout', evaluations: 8200, enabled: true },
  { name: 'beta-features', evaluations: 5400, enabled: false },
  { name: 'analytics-v2', evaluations: 3200, enabled: true },
  { name: 'ai-assistant', evaluations: 2100, enabled: false },
];

export default function DashboardPage() {
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
            Welcome back! Here&apos;s what&apos;s happening with your feature flags.
          </p>
        </div>
        <Link href="/dashboard/flags/new">
          <Button variant="glow" className="gap-2">
            <Plus className="h-4 w-4" />
            Create Flag
          </Button>
        </Link>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} variant="interactive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', stat.bgColor)}>
                  <stat.icon className={cn('h-5 w-5', stat.color)} />
                </div>
                <div
                  className={cn(
                    'flex items-center gap-1 text-sm font-medium',
                    stat.trend === 'up' ? 'text-green-500' : 'text-red-500'
                  )}
                >
                  {stat.change}
                  {stat.trend === 'up' ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity Feed */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                Recent Activity
              </CardTitle>
              <Link href="/dashboard/audit">
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-4 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <Avatar size="sm">
                      <AvatarFallback>
                        {activity.user
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{activity.user}</span>{' '}
                        <span className="text-muted-foreground">{activity.action}</span>{' '}
                        <span className="font-medium text-tangerine">{activity.target}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {activity.environment && (
                          <Badge
                            variant={
                              activity.environment === 'production'
                                ? 'production'
                                : activity.environment === 'staging'
                                ? 'staging'
                                : 'development'
                            }
                            size="sm"
                          >
                            {activity.environment}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(activity.time)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Flags */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-muted-foreground" />
                Top Flags
              </CardTitle>
              <Link href="/dashboard/flags">
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topFlags.map((flag, index) => (
                  <motion.div
                    key={flag.name}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full',
                        flag.enabled ? 'bg-green-500' : 'bg-muted-foreground/50'
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium truncate">{flag.name}</p>
                        <span className="text-xs text-muted-foreground">
                          {formatNumber(flag.evaluations)}
                        </span>
                      </div>
                      <Progress
                        value={(flag.evaluations / 12500) * 100}
                        className="h-1.5"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <QuickActionCard
                icon={<Flag className="h-5 w-5" />}
                title="Create Flag"
                description="Add a new feature flag"
                href="/dashboard/flags/new"
              />
              <QuickActionCard
                icon={<FolderKanban className="h-5 w-5" />}
                title="New Project"
                description="Start a new project"
                href="/dashboard/projects/new"
              />
              <QuickActionCard
                icon={<Users className="h-5 w-5" />}
                title="Invite Member"
                description="Add team members"
                href="/dashboard/members"
              />
              <QuickActionCard
                icon={<Activity className="h-5 w-5" />}
                title="View Logs"
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
