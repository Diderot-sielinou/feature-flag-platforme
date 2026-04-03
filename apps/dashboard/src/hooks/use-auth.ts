'use client';

import { useUser, useAuth as useClerkAuth } from '@clerk/nextjs';
import type { User, AuthState } from '@/types';

interface UseAuthReturn extends AuthState {
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

/**
 * Authentication hook using Clerk.
 * Login/register/verify/forgot-password are handled by Clerk's
 * hosted UI or <SignIn/> / <SignUp/> components — no manual flows needed.
 */
export function useAuth(): UseAuthReturn {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerkAuth();

  const user: User | null = clerkUser
    ? {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || '',
        firstName: clerkUser.firstName || undefined,
        lastName: clerkUser.lastName || undefined,
        fullName: clerkUser.fullName || undefined,
        avatarUrl: clerkUser.imageUrl || undefined,
        emailVerified: clerkUser.primaryEmailAddress?.verification?.status === 'verified',
        createdAt: clerkUser.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: clerkUser.updatedAt?.toISOString() || new Date().toISOString(),
      }
    : null;

  const logout = async () => {
    await signOut();
  };

  const refreshUser = async () => {
    await clerkUser?.reload();
  };

  return {
    user,
    isAuthenticated: !!isSignedIn,
    isLoading: !isLoaded,
    accessToken: null, // Managed by Clerk — use getToken() from useAuth()
    logout,
    refreshUser,
    error: null,
    clearError: () => {},
  };
}

export default useAuth;
