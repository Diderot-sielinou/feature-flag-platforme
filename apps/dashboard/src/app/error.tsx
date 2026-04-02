'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-lg"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.5 }}
          className="h-24 w-24 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-8"
        >
          <AlertTriangle className="h-12 w-12 text-destructive" />
        </motion.div>

        {/* Title */}
        <h1 className="text-4xl font-display font-bold mb-4">
          Something went wrong
        </h1>

        {/* Description */}
        <p className="text-lg text-muted-foreground mb-2">
          We apologize for the inconvenience. An unexpected error has occurred.
        </p>

        {/* Error Details (Development) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Error details
            </summary>
            <div className="mt-2 p-4 rounded-lg bg-muted text-sm font-mono overflow-auto max-h-48">
              <p className="text-destructive font-semibold">{error.name}</p>
              <p className="text-muted-foreground">{error.message}</p>
              {error.digest && (
                <p className="text-xs text-muted-foreground mt-2">
                  Digest: {error.digest}
                </p>
              )}
            </div>
          </details>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          <Button variant="outline" onClick={reset} className="gap-2 w-full sm:w-auto">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="glow" className="gap-2 w-full">
              <Home className="h-4 w-4" />
              Go Home
            </Button>
          </Link>
        </div>

        {/* Report Issue */}
        <p className="text-sm text-muted-foreground mt-8">
          If this problem persists, please{' '}
          <a
            href="https://github.com/launchlayer/launchlayer/issues/new?template=bug_report.yml"
            target="_blank"
            rel="noopener noreferrer"
            className="text-tangerine hover:underline inline-flex items-center gap-1"
          >
            report an issue
            <Bug className="h-3 w-3" />
          </a>
        </p>
      </motion.div>
    </div>
  );
}
