'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bell,
  Search,
  ChevronDown,
  Settings,
  LogOut,
  User,
  HelpCircle,
  Plus,
  Command,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  user?: {
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
  onLogout?: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur-xl"
    >
      <div className="flex h-full items-center justify-between px-6">
        {/* Search */}
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search flags, projects, segments..."
              className="pl-10 pr-12 bg-muted/50 border-transparent hover:border-border focus:border-tangerine"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <Command className="h-3 w-3" />K
            </kbd>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* Create Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="glow" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>
                <Link href="/dashboard/projects/new" className="flex items-center gap-2 w-full">
                  New Project
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/dashboard/flags/new" className="flex items-center gap-2 w-full">
                  New Feature Flag
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/dashboard/segments/new" className="flex items-center gap-2 w-full">
                  New Segment
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Link href="/dashboard/api-keys/new" className="flex items-center gap-2 w-full">
                  New API Key
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Help */}
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <HelpCircle className="h-5 w-5" />
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-tangerine text-[10px] font-semibold text-white">
                  3
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                Notifications
                <Badge variant="primary" size="sm">3 new</Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-80 overflow-y-auto">
                <NotificationItem
                  title="Flag enabled in production"
                  description="dark-mode was enabled by John"
                  time="2 minutes ago"
                  unread
                />
                <NotificationItem
                  title="New team member"
                  description="Sarah joined your project"
                  time="1 hour ago"
                  unread
                />
                <NotificationItem
                  title="API key expiring soon"
                  description="prod-api-key expires in 7 days"
                  time="3 hours ago"
                  unread
                />
                <NotificationItem
                  title="Schedule executed"
                  description="beta-feature was enabled as scheduled"
                  time="1 day ago"
                />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="justify-center text-tangerine cursor-pointer">
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar size="sm">
                  <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-sm font-medium">{user?.name || 'User'}</span>
                  <span className="text-xs text-muted-foreground">{user?.email || 'user@example.com'}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.header>
  );
}

interface NotificationItemProps {
  title: string;
  description: string;
  time: string;
  unread?: boolean;
}

function NotificationItem({ title, description, time, unread }: NotificationItemProps) {
  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3 hover:bg-accent cursor-pointer transition-colors',
        unread && 'bg-tangerine/5'
      )}
    >
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{title}</p>
          {unread && <span className="h-2 w-2 rounded-full bg-tangerine" />}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}

export default Header;
