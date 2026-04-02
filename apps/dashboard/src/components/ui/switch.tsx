'use client';

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  size?: 'sm' | 'default' | 'lg';
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, size = 'default', ...props }, ref) => {
  const sizes = {
    sm: {
      root: 'h-4 w-7',
      thumb: 'h-3 w-3 data-[state=checked]:translate-x-3',
    },
    default: {
      root: 'h-6 w-11',
      thumb: 'h-5 w-5 data-[state=checked]:translate-x-5',
    },
    lg: {
      root: 'h-8 w-14',
      thumb: 'h-7 w-7 data-[state=checked]:translate-x-6',
    },
  };

  return (
    <SwitchPrimitives.Root
      className={cn(
        'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
        'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-tangerine data-[state=checked]:to-amber',
        'data-[state=checked]:shadow-md data-[state=checked]:shadow-tangerine/30',
        'data-[state=unchecked]:bg-input',
        sizes[size].root,
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'pointer-events-none block rounded-full bg-white shadow-lg ring-0',
          'transition-transform duration-200 data-[state=unchecked]:translate-x-0',
          sizes[size].thumb
        )}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
