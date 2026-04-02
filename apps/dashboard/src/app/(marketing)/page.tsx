'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Flag,
  Zap,
  Shield,
  BarChart3,
  Users,
  Clock,
  Code2,
  Layers,
  ArrowRight,
  Check,
  Sparkles,
  Github,
  Twitter,
  Linkedin,
  ChevronRight,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navbar */}
      <Navbar />

      {/* Hero Section */}
      <HeroSection />

      {/* Features Section */}
      <FeaturesSection />

      {/* How It Works Section */}
      <HowItWorksSection />

      {/* Pricing Section */}
      <PricingSection />

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <Footer />
    </div>
  );
}

function Navbar() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl"
    >
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-tangerine to-rust">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold">
              Launch<span className="text-tangerine">Layer</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="#docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Docs
            </Link>
            <Link href="#blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Blog
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/auth/register">
              <Button variant="glow" size="sm">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}

function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32">
      {/* Background Effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-radial from-tangerine/20 via-transparent to-transparent blur-3xl" />
        <div className="absolute inset-0 bg-grid opacity-20" />
      </div>

      <div className="container mx-auto px-6">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          {/* Badge */}
          <motion.div variants={fadeInUp} className="mb-6">
            <Badge variant="primary" className="gap-2 px-4 py-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Now in Public Beta
            </Badge>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeInUp}
            className="text-4xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight mb-6"
          >
            Ship Features with{' '}
            <span className="gradient-text">Confidence</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={fadeInUp}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            LaunchLayer is the modern feature flags platform that lets you control 
            releases, run experiments, and manage rollouts without redeploying.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/auth/register">
              <Button variant="glow" size="xl" className="gap-2 min-w-[200px]">
                Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="outline" size="xl" className="gap-2 min-w-[200px]">
              <Play className="h-5 w-5" />
              Watch Demo
            </Button>
          </motion.div>

          {/* Social Proof */}
          <motion.div
            variants={fadeInUp}
            className="mt-16 flex flex-col items-center gap-4"
          >
            <p className="text-sm text-muted-foreground">Trusted by innovative teams</p>
            <div className="flex items-center gap-8 opacity-50">
              {/* Placeholder logos */}
              {['Company A', 'Company B', 'Company C', 'Company D'].map((company) => (
                <div key={company} className="text-lg font-semibold text-muted-foreground">
                  {company}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Hero Image/Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mt-20 relative max-w-6xl mx-auto"
        >
          <div className="relative rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden shadow-2xl shadow-tangerine/10">
            {/* Browser Chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs text-muted-foreground">app.launchlayer.io/dashboard</span>
              </div>
            </div>
            {/* Dashboard Preview */}
            <div className="aspect-[16/9] bg-gradient-to-br from-obsidian-400 to-obsidian-600 flex items-center justify-center">
              <div className="text-muted-foreground">Dashboard Preview</div>
            </div>
          </div>
          
          {/* Floating Elements */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            className="absolute -left-8 top-1/4 hidden lg:block"
          >
            <div className="bg-card border border-border rounded-lg p-4 shadow-elevation-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Flag Enabled</p>
                  <p className="text-xs text-muted-foreground">dark-mode • prod</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1 }}
            className="absolute -right-8 bottom-1/4 hidden lg:block"
          >
            <div className="bg-card border border-border rounded-lg p-4 shadow-elevation-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-tangerine/20 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-tangerine" />
                </div>
                <div>
                  <p className="text-sm font-medium">12.5k</p>
                  <p className="text-xs text-muted-foreground">Evaluations/min</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: <Flag className="h-6 w-6" />,
    title: 'Feature Flags',
    description: 'Toggle features on/off instantly without code changes. Perfect for progressive rollouts and kill switches.',
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: 'A/B Testing',
    description: 'Run experiments with variant allocation. Measure impact and make data-driven decisions.',
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: 'User Targeting',
    description: 'Target specific users, segments, or percentages. Powerful rules engine for precise control.',
  },
  {
    icon: <Clock className="h-6 w-6" />,
    title: 'Scheduled Releases',
    description: 'Plan your releases ahead. Schedule flag changes to activate at specific times.',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'Audit Logs',
    description: 'Complete visibility into every change. Track who did what and when for compliance.',
  },
  {
    icon: <Code2 className="h-6 w-6" />,
    title: 'SDK Support',
    description: 'Native SDKs for all major platforms. Easy integration with just a few lines of code.',
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-20 md:py-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4">Features</Badge>
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
            Everything you need to{' '}
            <span className="gradient-text">ship faster</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A complete feature management platform with powerful tools for modern development teams.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="group h-full p-6 rounded-xl border border-border bg-card/50 hover:bg-card hover:border-tangerine/30 transition-all duration-300 hover:shadow-lg hover:shadow-tangerine/5">
                <div className="h-12 w-12 rounded-lg bg-tangerine/10 text-tangerine flex items-center justify-center mb-4 group-hover:bg-tangerine group-hover:text-white transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const steps = [
  {
    number: '01',
    title: 'Create a flag',
    description: 'Define your feature flag with a unique key and configure default values.',
  },
  {
    number: '02',
    title: 'Integrate the SDK',
    description: 'Add a few lines of code to your app using our lightweight SDK.',
  },
  {
    number: '03',
    title: 'Control rollouts',
    description: 'Toggle features, target users, and manage releases from the dashboard.',
  },
];

function HowItWorksSection() {
  return (
    <section className="py-20 md:py-32 bg-muted/30">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4">How It Works</Badge>
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
            Up and running in{' '}
            <span className="gradient-text">minutes</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get started with LaunchLayer in three simple steps.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="relative"
            >
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-border to-transparent -translate-x-1/2" />
              )}
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-24 w-24 rounded-2xl bg-gradient-to-br from-tangerine/20 to-rust/20 border border-tangerine/20 mb-6">
                  <span className="text-3xl font-display font-bold gradient-text">{step.number}</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Code Example */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 max-w-3xl mx-auto"
        >
          <div className="rounded-xl border border-border bg-obsidian-400 overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-obsidian-300">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs text-muted-foreground font-mono">app.tsx</span>
            </div>
            <pre className="p-6 text-sm font-mono overflow-x-auto">
              <code className="text-green-400">
{`import { LaunchLayer } from '@launchlayer/react';

const client = new LaunchLayer({
  apiKey: 'your-api-key'
});

function App() {
  const { isEnabled } = client.useFlag('new-checkout');
  
  return isEnabled ? <NewCheckout /> : <OldCheckout />;
}`}
              </code>
            </pre>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const plans = [
  {
    name: 'Free',
    price: '$0',
    description: 'Perfect for side projects and testing.',
    features: [
      '1 Project',
      '5 Feature Flags',
      '10,000 Evaluations/month',
      '1 Team Member',
      'Community Support',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For growing teams shipping fast.',
    features: [
      'Unlimited Projects',
      'Unlimited Feature Flags',
      '1M Evaluations/month',
      '10 Team Members',
      'A/B Testing',
      'Scheduled Releases',
      'Priority Support',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For organizations with advanced needs.',
    features: [
      'Everything in Pro',
      'Unlimited Evaluations',
      'Unlimited Team Members',
      'SSO & SAML',
      'Audit Logs Retention',
      'SLA & Dedicated Support',
      'Custom Integrations',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

function PricingSection() {
  return (
    <section id="pricing" className="py-20 md:py-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4">Pricing</Badge>
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
            Simple, transparent{' '}
            <span className="gradient-text">pricing</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and scale as you grow. No hidden fees.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'relative rounded-2xl border bg-card p-8',
                plan.popular
                  ? 'border-tangerine shadow-lg shadow-tangerine/10'
                  : 'border-border'
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="primary">Most Popular</Badge>
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-display font-bold">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                </div>
                <p className="text-muted-foreground mt-2">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-tangerine flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.popular ? 'glow' : 'outline'}
                className="w-full"
              >
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const testimonials = [
  {
    quote: "LaunchLayer transformed how we ship features. We went from monthly releases to daily deployments with complete confidence.",
    author: 'Sarah Chen',
    role: 'CTO, TechStartup',
  },
  {
    quote: "The targeting rules are incredibly powerful. We can now run experiments and rollouts with precision we never had before.",
    author: 'Marcus Johnson',
    role: 'Lead Engineer, ScaleUp',
  },
  {
    quote: "Setup took 5 minutes. The SDK is clean, the dashboard is intuitive, and the team support is outstanding.",
    author: 'Emily Rodriguez',
    role: 'Product Manager, Enterprise Co',
  },
];

function TestimonialsSection() {
  return (
    <section className="py-20 md:py-32 bg-muted/30">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4">Testimonials</Badge>
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
            Loved by{' '}
            <span className="gradient-text">developers</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="rounded-xl border border-border bg-card p-6"
            >
              <p className="text-lg mb-6">&ldquo;{testimonial.quote}&rdquo;</p>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-tangerine to-rust" />
                <div>
                  <p className="font-semibold">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative max-w-4xl mx-auto text-center p-12 rounded-3xl bg-gradient-to-br from-tangerine/10 via-amber/10 to-rust/10 border border-tangerine/20"
        >
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
            Ready to ship faster?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of developers using LaunchLayer to deliver features with confidence.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/register">
              <Button variant="glow" size="xl" className="gap-2">
                Get Started for Free
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="outline" size="xl">
              Talk to Sales
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-tangerine to-rust">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-display text-xl font-bold">
                Launch<span className="text-tangerine">Layer</span>
              </span>
            </Link>
            <p className="text-muted-foreground mb-4 max-w-xs">
              The modern feature flags platform for teams that ship fast.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Github className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Changelog</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Roadmap</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">API Reference</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Community</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} LaunchLayer. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
