'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  size?: 'sm' | 'default' | 'lg';
  showValue?: boolean;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, variant = 'default', size = 'default', showValue, ...props }, ref) => {
  const variants = {
    default: 'bg-gradient-to-r from-tangerine to-amber',
    success: 'bg-gradient-to-r from-green-500 to-green-400',
    warning: 'bg-gradient-to-r from-amber to-yellow-400',
    destructive: 'bg-gradient-to-r from-red-500 to-red-400',
  };

  const sizes = {
    sm: 'h-1.5',
    default: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className="relative w-full">
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-secondary',
          sizes[size],
          className
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            'h-full w-full flex-1 transition-all duration-500 ease-out rounded-full',
            variants[variant]
          )}
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      </ProgressPrimitive.Root>
      {showValue && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground ml-2">
          {value}%
        </span>
      )}
    </div>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
