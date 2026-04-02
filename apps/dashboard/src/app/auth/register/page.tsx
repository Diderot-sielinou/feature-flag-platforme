'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, User, Sparkles, ArrowRight, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
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

type RegisterForm = z.infer<typeof registerSchema>;

const passwordRequirements = [
  { regex: /.{12,}/, text: 'At least 12 characters' },
  { regex: /[a-z]/, text: 'One lowercase letter' },
  { regex: /[A-Z]/, text: 'One uppercase letter' },
  { regex: /[0-9]/, text: 'One number' },
  { regex: /[^a-zA-Z0-9]/, text: 'One special character' },
];

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const watchPassword = watch('password');

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser(data.email, data.password, data.fullName);
      toast.success('Account created! Please check your email to verify.');
      router.push('/auth/verify?email=' + encodeURIComponent(data.email));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Decorative */}
      <div className="hidden lg:flex flex-1 relative bg-gradient-to-br from-tangerine/20 via-amber/10 to-rust/20">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <div className="h-32 w-32 rounded-3xl bg-gradient-to-br from-tangerine to-rust flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-tangerine/30">
              <Sparkles className="h-16 w-16 text-white" />
            </div>
            <h2 className="text-2xl font-display font-bold mb-2">Join LaunchLayer</h2>
            <p className="text-muted-foreground max-w-xs mx-auto">
              Start shipping features with confidence in minutes.
            </p>

            {/* Features */}
            <div className="mt-8 space-y-3 text-left max-w-xs mx-auto">
              {[
                'Unlimited feature flags',
                'Real-time updates',
                'Team collaboration',
                'Powerful targeting rules',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-tangerine/20 flex items-center justify-center">
                    <Check className="h-3 w-3 text-tangerine" />
                  </div>
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-tangerine to-rust shadow-lg shadow-tangerine/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-2xl font-bold">
              Launch<span className="text-tangerine">Layer</span>
            </span>
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-display font-bold mb-2">Create an account</h1>
            <p className="text-muted-foreground">
              Start your free trial. No credit card required.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                icon={<User className="h-4 w-4" />}
                error={!!errors.fullName}
                {...register('fullName')}
              />
              {errors.fullName && (
                <p className="text-sm text-destructive">{errors.fullName.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                icon={<Mail className="h-4 w-4" />}
                error={!!errors.email}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  icon={<Lock className="h-4 w-4" />}
                  error={!!errors.password}
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Password Requirements */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                {passwordRequirements.map((req) => (
                  <div
                    key={req.text}
                    className={cn(
                      'flex items-center gap-1.5 text-xs',
                      req.regex.test(watchPassword || '')
                        ? 'text-green-500'
                        : 'text-muted-foreground'
                    )}
                  >
                    <Check className="h-3 w-3" />
                    {req.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                icon={<Lock className="h-4 w-4" />}
                error={!!errors.confirmPassword}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Terms */}
            <p className="text-xs text-muted-foreground">
              By creating an account, you agree to our{' '}
              <Link href="/terms" className="text-tangerine hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-tangerine hover:underline">
                Privacy Policy
              </Link>
              .
            </p>

            {/* Submit */}
            <Button
              type="submit"
              variant="glow"
              className="w-full"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting || isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Sign In Link */}
          <p className="mt-8 text-center text-muted-foreground">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-tangerine hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
