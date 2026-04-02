'use client';

import { Toaster as Sonner } from 'sonner';
import { useTheme } from 'next-themes';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-elevation-3 group-[.toaster]:rounded-xl',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          success:
            'group-[.toaster]:border-green-500/30 group-[.toaster]:bg-green-500/10',
          error:
            'group-[.toaster]:border-destructive/30 group-[.toaster]:bg-destructive/10',
          warning:
            'group-[.toaster]:border-amber/30 group-[.toaster]:bg-amber/10',
          info:
            'group-[.toaster]:border-blue-500/30 group-[.toaster]:bg-blue-500/10',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
