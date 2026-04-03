'use client';

import { redirect } from 'next/navigation';

/**
 * Password reset is handled by Clerk automatically within the SignIn component.
 * Redirect to login if someone lands here.
 */
export default function ForgotPasswordPage() {
  redirect('/auth/login');
}
