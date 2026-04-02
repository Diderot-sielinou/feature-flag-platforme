'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  description?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  change,
  trend = 'neutral',
  icon: Icon,
  iconColor = 'text-tangerine',
  iconBgColor = 'bg-tangerine/10',
  description,
  className,
}: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card variant="interactive" className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', iconBgColor)}>
              <Icon className={cn('h-5 w-5', iconColor)} />
            </div>
            {change && (
              <div
                className={cn(
                  'flex items-center gap-1 text-sm font-medium',
                  trend === 'up' && 'text-green-500',
                  trend === 'down' && 'text-red-500',
                  trend === 'neutral' && 'text-muted-foreground'
                )}
              >
                {change}
                {trend === 'up' && <ArrowUpRight className="h-4 w-4" />}
                {trend === 'down' && <ArrowDownRight className="h-4 w-4" />}
              </div>
            )}
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{title}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default StatCard;
