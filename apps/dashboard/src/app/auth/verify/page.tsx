'use client';

import { redirect } from 'next/navigation';

/**
 * Email verification is handled by Clerk automatically.
 * Redirect to login if someone lands here.
 */
export default function VerifyPage() {
  redirect('/auth/login');
}
