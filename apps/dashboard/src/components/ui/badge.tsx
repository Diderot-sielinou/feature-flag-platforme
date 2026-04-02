import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground',
        primary: 'bg-tangerine/15 text-tangerine border border-tangerine/20',
        secondary: 'bg-secondary text-secondary-foreground',
        success: 'bg-green-500/15 text-green-400 border border-green-500/20',
        warning: 'bg-amber/15 text-amber border border-amber/20',
        destructive: 'bg-destructive/15 text-destructive border border-destructive/20',
        outline: 'border border-border text-foreground',
        ghost: 'bg-transparent text-muted-foreground',
        // Environment specific
        development: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
        staging: 'bg-amber/15 text-amber border border-amber/20',
        production: 'bg-green-500/15 text-green-400 border border-green-500/20',
        // Role specific
        admin: 'bg-purple-500/15 text-purple-400 border border-purple-500/20',
        owner: 'bg-tangerine/15 text-tangerine border border-tangerine/20',
        editor: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
        viewer: 'bg-gray-500/15 text-gray-400 border border-gray-500/20',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0 text-2xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  dotColor?: string;
}

function Badge({ className, variant, size, dot, dotColor, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'mr-1.5 h-1.5 w-1.5 rounded-full',
            dotColor || 'bg-current'
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
