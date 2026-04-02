'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  resetPassword,
  confirmResetPassword,
  getCurrentUser,
  fetchUserAttributes,
  type SignInInput,
  type SignUpInput,
} from 'aws-amplify/auth';
import type { User, AuthState } from '@/types';

interface UseAuthReturn extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

/**
 * Authentication hook using AWS Amplify/Cognito
 */
export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    accessToken: null,
  });
  const [error, setError] = useState<string | null>(null);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch current user
  const refreshUser = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      
      const cognitoUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();

      const user: User = {
        id: cognitoUser.userId,
        email: attributes.email || '',
        firstName: attributes.given_name,
        lastName: attributes.family_name,
        fullName: attributes.name,
        emailVerified: attributes.email_verified === 'true',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        accessToken: null, // Token is managed by Amplify
      });
    } catch {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        accessToken: null,
      });
    }
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Login
  const login = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      setState((prev) => ({ ...prev, isLoading: true }));

      const input: SignInInput = {
        username: email,
        password,
      };

      const { isSignedIn, nextStep } = await signIn(input);

      if (isSignedIn) {
        await refreshUser();
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        throw new Error('Please verify your email first');
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        throw new Error('Please set a new password');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      setState((prev) => ({ ...prev, isLoading: false }));
      throw err;
    }
  }, [refreshUser]);

  // Register
  const register = useCallback(async (email: string, password: string, fullName?: string) => {
    console.log(`ỳvan bienvenue $${email}, fullName: ${fullName}`)
    try {
      setError(null);
      setState((prev) => ({ ...prev, isLoading: true }));

      const input: SignUpInput = {
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            ...(fullName && { name: fullName }),
          },
        },
      };

      const { isSignUpComplete, nextStep } = await signUp(input);

      if (!isSignUpComplete && nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        // User needs to verify email
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      // If sign up is complete, sign in the user
      await login(email, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      setState((prev) => ({ ...prev, isLoading: false }));
      throw err;
    }
  }, [login]);

  // Logout
  const logout = useCallback(async () => {
    try {
      setError(null);
      await signOut();
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        accessToken: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Logout failed';
      setError(message);
      throw err;
    }
  }, []);

  // Verify email
  const verifyEmail = useCallback(async (email: string, code: string) => {
    try {
      setError(null);
      await confirmSignUp({
        username: email,
        confirmationCode: code,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      setError(message);
      throw err;
    }
  }, []);

  // Forgot password
  const forgotPassword = useCallback(async (email: string) => {
    try {
      setError(null);
      await resetPassword({ username: email });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset code';
      setError(message);
      throw err;
    }
  }, []);

  // Confirm forgot password
  const confirmForgotPassword = useCallback(
    async (email: string, code: string, newPassword: string) => {
      try {
        setError(null);
        await confirmResetPassword({
          username: email,
          confirmationCode: code,
          newPassword,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to reset password';
        setError(message);
        throw err;
      }
    },
    []
  );

  return {
    ...state,
    login,
    register,
    logout,
    verifyEmail,
    forgotPassword,
    confirmForgotPassword,
    refreshUser,
    error,
    clearError,
  };
}

export default useAuth;
