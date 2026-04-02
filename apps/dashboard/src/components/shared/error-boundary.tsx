'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          reset={() => this.setState({ hasError: false })}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error?: Error;
  reset?: () => void;
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-display font-bold mb-2">Something went wrong</h2>
        <p className="text-muted-foreground mb-6">
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="flex items-center justify-center gap-4">
          {reset && (
            <Button variant="outline" onClick={reset} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
          <Button variant="glow" onClick={() => window.location.href = '/dashboard'} className="gap-2">
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundary;
