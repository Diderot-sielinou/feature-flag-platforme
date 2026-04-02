'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  variant?: 'default' | 'page' | 'inline' | 'card';
  message?: string;
  className?: string;
}

export function LoadingState({ 
  variant = 'default', 
  message = 'Loading...', 
  className 
}: LoadingStateProps) {
  if (variant === 'page') {
    return (
      <div className={cn('min-h-screen flex items-center justify-center', className)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="h-16 w-16 rounded-2xl bg-gradient-to-br from-tangerine to-rust flex items-center justify-center mx-auto mb-4 shadow-lg shadow-tangerine/20"
          >
            <Sparkles className="h-8 w-8 text-white" />
          </motion.div>
          <p className="text-muted-foreground">{message}</p>
        </motion.div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-2 text-muted-foreground', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{message}</span>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={cn('flex items-center justify-center p-12', className)}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-tangerine mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative"
        >
          <div className="h-12 w-12 rounded-full border-2 border-muted animate-spin mx-auto" />
          <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-tangerine border-t-transparent animate-spin mx-auto" />
        </motion.div>
        <p className="mt-4 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// Skeleton loaders for specific content types
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-muted" />
        ))}
      </div>
      {/* Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 h-96 rounded-xl bg-muted" />
        <div className="h-96 rounded-xl bg-muted" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="h-12 bg-muted rounded-lg mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 bg-muted/50 rounded-lg mb-2" />
      ))}
    </div>
  );
}

export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-pulse">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="h-48 rounded-xl bg-muted" />
      ))}
    </div>
  );
}

export default LoadingState;
