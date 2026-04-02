'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user?: {
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
  onLogout?: () => void;
}

export function DashboardLayout({ children, user, onLogout }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="pl-[280px] transition-all duration-300">
        <Header user={user} onLogout={onLogout} />
        
        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-6"
        >
          {children}
        </motion.main>
      </div>

      {/* Background Decorations */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Gradient Orbs */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-tangerine/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber/5 rounded-full blur-3xl" />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-grid opacity-30" />
      </div>
    </div>
  );
}

export default DashboardLayout;
