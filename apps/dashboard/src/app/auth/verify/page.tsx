'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Sparkles, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/use-auth';

const verifySchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

type VerifyForm = z.infer<typeof verifySchema>;

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const { verifyEmail, isLoading } = useAuth();
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyForm>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      code: '',
    },
  });

  const onSubmit = async (data: VerifyForm) => {
    try {
      await verifyEmail(email, data.code);
      toast.success('Email verified successfully!');
      router.push('/auth/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      toast.error(message);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      // In a real app, you'd call the resend confirmation code API
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success('Verification code resent');
    } catch (error) {
      toast.error('Failed to resend code');
    } finally {
      setResending(false);
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
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-tangerine/10 flex items-center justify-center mx-auto mb-6">
            <Mail className="h-8 w-8 text-tangerine" />
          </div>

          <h1 className="text-2xl font-display font-bold mb-2">Verify your email</h1>
          <p className="text-muted-foreground mb-6">
            We sent a verification code to<br />
            <span className="font-medium text-foreground">{email || 'your email'}</span>
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="code" className="sr-only">Verification Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                error={!!errors.code}
                {...register('code')}
              />
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code.message}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="glow"
              className="w-full"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting || isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify Email
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Resend */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground mb-3">
              Didn&apos;t receive the code?
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResend}
              disabled={resending}
              className="gap-2"
            >
              {resending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Resend Code
            </Button>
          </div>
        </div>

        {/* Back to login */}
        <p className="mt-6 text-center text-muted-foreground">
          <Link href="/auth/login" className="text-tangerine hover:underline font-medium">
            ← Back to login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
