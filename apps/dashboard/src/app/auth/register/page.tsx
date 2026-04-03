'use client';

import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, Check } from 'lucide-react';

export default function RegisterPage() {
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

          {/* Clerk Sign Up */}
          <SignUp
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'bg-transparent shadow-none p-0 w-full',
                headerTitle: 'text-3xl font-display font-bold',
                headerSubtitle: 'text-muted-foreground',
                formButtonPrimary:
                  'bg-gradient-to-r from-tangerine to-rust hover:opacity-90 text-white',
                footerActionLink: 'text-tangerine hover:text-tangerine/80',
              },
            }}
            routing="path"
            path="/auth/register"
            signInUrl="/auth/login"
            forceRedirectUrl="/dashboard"
          />
        </motion.div>
      </div>
    </div>
  );
}
