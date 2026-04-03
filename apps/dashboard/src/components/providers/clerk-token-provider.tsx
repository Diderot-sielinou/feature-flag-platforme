'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { setAuthToken } from '@/services/api-client';

/**
 * Syncs the Clerk session token to the API client.
 * Must be rendered inside <ClerkProvider>.
 */
export function ClerkTokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) {
      setAuthToken(null);
      return;
    }

    // Set token immediately
    getToken().then(setAuthToken);

    // Refresh token periodically (Clerk tokens expire in ~60s)
    const interval = setInterval(async () => {
      const token = await getToken();
      setAuthToken(token);
    }, 50_000);

    return () => clearInterval(interval);
  }, [getToken, isSignedIn]);

  return <>{children}</>;
}
