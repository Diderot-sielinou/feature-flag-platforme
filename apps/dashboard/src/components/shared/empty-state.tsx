'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('text-center py-12', className)}
    >
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground mb-4 max-w-sm mx-auto">{description}</p>
      )}
      {action && (
        <Button variant="glow" onClick={action.onClick} className="gap-2">
          {action.icon}
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}

export default EmptyState;
