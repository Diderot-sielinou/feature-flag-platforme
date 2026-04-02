'use client';

import { useState, useCallback } from 'react';

interface UseCopyToClipboardReturn {
  copy: (text: string) => Promise<boolean>;
  copied: boolean;
  error: Error | null;
  reset: () => void;
}

/**
 * Hook for copying text to clipboard with status feedback
 */
export function useCopyToClipboard(resetDelay: number = 2000): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        if (!navigator?.clipboard) {
          throw new Error('Clipboard API not available');
        }

        await navigator.clipboard.writeText(text);
        setCopied(true);
        setError(null);

        // Reset after delay
        setTimeout(() => {
          setCopied(false);
        }, resetDelay);

        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to copy');
        setError(error);
        setCopied(false);
        return false;
      }
    },
    [resetDelay]
  );

  const reset = useCallback(() => {
    setCopied(false);
    setError(null);
  }, []);

  return { copy, copied, error, reset };
}

export default useCopyToClipboard;
