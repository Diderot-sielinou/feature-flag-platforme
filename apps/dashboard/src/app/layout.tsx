
import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { Providers } from '@/components/providers';
import '../../src/app/style/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'LaunchLayer - Feature Flags Platform',
    template: '%s | LaunchLayer',
  },
  description:
    'Modern feature flags platform for progressive rollouts, A/B testing, and instant kill switches.',
  keywords: ['feature flags', 'feature toggles', 'A/B testing', 'rollouts', 'LaunchLayer'],
  authors: [{ name: 'LaunchLayer Team' }],
  creator: 'LaunchLayer',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://launchlayer.io',
    title: 'LaunchLayer - Feature Flags Platform',
    description:
      'Modern feature flags platform for progressive rollouts, A/B testing, and instant kill switches.',
    siteName: 'LaunchLayer',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LaunchLayer - Feature Flags Platform',
    description:
      'Modern feature flags platform for progressive rollouts, A/B testing, and instant kill switches.',
    creator: '@launchlayer',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0E0503' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        </head>
        <body className="min-h-screen bg-background font-sans antialiased">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
