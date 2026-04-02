'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Flag,
  FolderKanban,
  Users,
  Key,
  Settings,
  ChevronLeft,
  ChevronRight,
  Layers,
  Calendar,
  Activity,
  Sparkles,
  LogOut,
  Moon,
  Sun,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useTheme } from 'next-themes';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
}

const mainNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Projects', href: '/dashboard/projects', icon: <FolderKanban className="h-5 w-5" /> },
  { label: 'Feature Flags', href: '/dashboard/flags', icon: <Flag className="h-5 w-5" /> },
  { label: 'Segments', href: '/dashboard/segments', icon: <Layers className="h-5 w-5" /> },
  { label: 'Schedules', href: '/dashboard/schedules', icon: <Calendar className="h-5 w-5" /> },
];

const managementNavItems: NavItem[] = [
  { label: 'API Keys', href: '/dashboard/api-keys', icon: <Key className="h-5 w-5" /> },
  { label: 'Team', href: '/dashboard/members', icon: <Users className="h-5 w-5" /> },
  { label: 'Audit Logs', href: '/dashboard/audit', icon: <Activity className="h-5 w-5" /> },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 280 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          'fixed left-0 top-0 z-40 h-screen border-r border-border bg-card/50 backdrop-blur-xl',
          'flex flex-col',
          className
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-3">
            <motion.div
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-tangerine to-rust shadow-lg shadow-tangerine/20"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Sparkles className="h-5 w-5 text-white" />
            </motion.div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="font-display text-xl font-bold tracking-tight"
                >
                  Launch<span className="text-tangerine">Layer</span>
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-hide">
          {/* Main Navigation */}
          <div className="space-y-1">
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  Main
                </motion.p>
              )}
            </AnimatePresence>
            {mainNavItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                collapsed={collapsed}
              />
            ))}
          </div>

          <Separator className="my-4" />

          {/* Management Navigation */}
          <div className="space-y-1">
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  Management
                </motion.p>
              )}
            </AnimatePresence>
            {managementNavItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                collapsed={collapsed}
              />
            ))}
          </div>
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-border p-3 space-y-2">
          {/* Settings */}
          <NavLink
            item={{ label: 'Settings', href: '/dashboard/settings', icon: <Settings className="h-5 w-5" /> }}
            isActive={isActive('/dashboard/settings')}
            collapsed={collapsed}
          />

          {/* Theme Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={collapsed ? 'icon' : 'default'}
                className={cn(
                  'w-full justify-start gap-3',
                  collapsed && 'justify-center'
                )}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Toggle Theme</TooltipContent>}
          </Tooltip>

          {/* Collapse Toggle */}
          <Button
            variant="outline"
            size={collapsed ? 'icon' : 'default'}
            className={cn(
              'w-full justify-start gap-3',
              collapsed && 'justify-center'
            )}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}

interface NavLinkProps {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}

function NavLink({ item, isActive, collapsed }: NavLinkProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={item.href}>
          <motion.div
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
              'hover:bg-accent',
              isActive && 'bg-tangerine/10 text-tangerine',
              !isActive && 'text-muted-foreground hover:text-foreground',
              collapsed && 'justify-center px-2'
            )}
            whileHover={{ x: collapsed ? 0 : 4 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Active Indicator */}
            {isActive && (
              <motion.div
                layoutId="activeIndicator"
                className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-tangerine"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}

            {/* Icon */}
            <span className={cn(isActive && 'text-tangerine')}>{item.icon}</span>

            {/* Label */}
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>

            {/* Badge */}
            {item.badge && !collapsed && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-tangerine/20 px-1.5 text-xs font-semibold text-tangerine">
                {item.badge}
              </span>
            )}
          </motion.div>
        </Link>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
    </Tooltip>
  );
}

export default Sidebar;
