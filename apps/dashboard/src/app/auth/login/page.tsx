'use client';

import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
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

          {/* Clerk Sign In */}
          <SignIn
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
            path="/auth/login"
            signUpUrl="/auth/register"
            forceRedirectUrl="/dashboard"
          />
        </motion.div>
      </div>

      {/* Right Side - Decorative */}
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
            <h2 className="text-2xl font-display font-bold mb-2">Ship with Confidence</h2>
            <p className="text-muted-foreground max-w-xs mx-auto">
              Control feature releases, run experiments, and manage rollouts seamlessly.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
