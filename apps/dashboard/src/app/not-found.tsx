"use client";

import Link from 'next/link';
import { Search, Home, ArrowLeft, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="text-center max-w-lg">
        {/* 404 Animation */}
        <div className="relative mb-8">
          <div className="text-[150px] font-display font-bold text-muted/20 leading-none select-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-tangerine to-rust flex items-center justify-center shadow-lg shadow-tangerine/20">
              <Flag className="h-10 w-10 text-white" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-display font-bold mb-4">
          Page not found
        </h1>

        {/* Description */}
        <p className="text-lg text-muted-foreground mb-8">
          Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
        </p>

        {/* Suggestions */}
        <div className="bg-muted/30 rounded-xl p-6 mb-8 text-left">
          <h2 className="font-semibold mb-3">Here are some helpful links:</h2>
          <ul className="space-y-2">
            <li>
              <Link
                href="/dashboard"
                className="text-tangerine hover:underline flex items-center gap-2"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-tangerine" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/flags"
                className="text-tangerine hover:underline flex items-center gap-2"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-tangerine" />
                Feature Flags
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/projects"
                className="text-tangerine hover:underline flex items-center gap-2"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-tangerine" />
                Projects
              </Link>
            </li>
            <li>
              <a
                href="https://docs.launchlayer.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-tangerine hover:underline flex items-center gap-2"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-tangerine" />
                Documentation
              </a>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2 w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="glow" className="gap-2 w-full">
              <Home className="h-4 w-4" />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
