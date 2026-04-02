'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Sparkles, ArrowRight, Loader2, KeyRound, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/use-auth';

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const resetSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain a special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ForgotForm = z.infer<typeof forgotSchema>;
type ResetForm = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { forgotPassword, confirmForgotPassword, isLoading } = useAuth();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');

  const forgotForm = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const resetForm = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { code: '', password: '', confirmPassword: '' },
  });

  const onForgotSubmit = async (data: ForgotForm) => {
    try {
      await forgotPassword(data.email);
      setEmail(data.email);
      setStep('reset');
      toast.success('Reset code sent to your email');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send reset code';
      toast.error(message);
    }
  };

  const onResetSubmit = async (data: ResetForm) => {
    try {
      await confirmForgotPassword(email, data.code, data.password);
      toast.success('Password reset successfully!');
      router.push('/auth/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset password';
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 mb-8 justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-tangerine to-rust shadow-lg shadow-tangerine/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-2xl font-bold">
            Launch<span className="text-tangerine">Layer</span>
          </span>
        </Link>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8">
          {step === 'email' ? (
            <>
              <div className="text-center mb-6">
                <div className="h-16 w-16 rounded-full bg-tangerine/10 flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="h-8 w-8 text-tangerine" />
                </div>
                <h1 className="text-2xl font-display font-bold mb-2">Forgot password?</h1>
                <p className="text-muted-foreground">
                  No worries, we&apos;ll send you reset instructions.
                </p>
              </div>

              <form onSubmit={forgotForm.handleSubmit(onForgotSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    icon={<Mail className="h-4 w-4" />}
                    error={!!forgotForm.formState.errors.email}
                    {...forgotForm.register('email')}
                  />
                  {forgotForm.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {forgotForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="glow"
                  className="w-full"
                  disabled={forgotForm.formState.isSubmitting || isLoading}
                >
                  {forgotForm.formState.isSubmitting || isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Reset Code
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-green-500" />
                </div>
                <h1 className="text-2xl font-display font-bold mb-2">Check your email</h1>
                <p className="text-muted-foreground">
                  We sent a code to <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>

              <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="code">Reset Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="text-center tracking-widest font-mono"
                    error={!!resetForm.formState.errors.code}
                    {...resetForm.register('code')}
                  />
                  {resetForm.formState.errors.code && (
                    <p className="text-sm text-destructive">
                      {resetForm.formState.errors.code.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a strong password"
                    error={!!resetForm.formState.errors.password}
                    {...resetForm.register('password')}
                  />
                  {resetForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {resetForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    error={!!resetForm.formState.errors.confirmPassword}
                    {...resetForm.register('confirmPassword')}
                  />
                  {resetForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive">
                      {resetForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="glow"
                  className="w-full"
                  disabled={resetForm.formState.isSubmitting || isLoading}
                >
                  {resetForm.formState.isSubmitting || isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      Reset Password
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <button
                onClick={() => setStep('email')}
                className="mt-4 text-sm text-muted-foreground hover:text-foreground w-full text-center"
              >
                ← Try another email
              </button>
            </>
          )}
        </div>

        {/* Back to login */}
        <p className="mt-6 text-center text-muted-foreground">
          Remember your password?{' '}
          <Link href="/auth/login" className="text-tangerine hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
