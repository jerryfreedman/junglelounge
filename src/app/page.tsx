'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Logo from '@/components/Logo';

const features = [
  {
    icon: '💰',
    title: 'True Profit Tracking',
    desc: 'See your real margins after platform fees, shipping, and cost of goods. No more guessing.',
  },
  {
    icon: '📊',
    title: 'Smart Dashboard',
    desc: 'Weekly and all-time stats at a glance. Know exactly where your business stands.',
  },
  {
    icon: '📄',
    title: 'CSV Import',
    desc: 'Upload your platform exports and map columns once. Future imports auto-fill.',
  },
  {
    icon: '👥',
    title: 'Buyer Intelligence',
    desc: 'Auto-built CRM from your sales. See VIPs, cold buyers, and purchase history.',
  },
  {
    icon: '🏷️',
    title: 'Pricing Insights',
    desc: 'Historical price data, suggested starting bids, and high-value restocking alerts.',
  },
  {
    icon: '✉️',
    title: 'AI Email Studio',
    desc: 'Generate personalized buyer emails in your brand voice with one click.',
  },
];

const platforms = ['Whatnot', 'eBay', 'Mercari', 'Poshmark', 'Depop', 'Facebook Marketplace', 'Etsy', 'Amazon'];

export default function LandingPage() {
  const router = useRouter();
  const { user, profile, isLoading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (user && profile?.onboarding_complete) {
        router.replace('/main');
      } else if (user && profile && !profile.onboarding_complete) {
        router.replace('/onboarding');
      }
    }
  }, [user, profile, isLoading, router]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // If logged in, show loading while redirecting
  if (user) {
    return (
      <div className="min-h-screen jungle-bg flex items-center justify-center">
        <div className="text-flamingo-blush animate-pulse font-heading text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen jungle-bg leaf-pattern">
      {/* Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-dark-bg/95 backdrop-blur-sm border-b border-deep-jungle/50' : ''}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={36} />
            <span className="font-heading text-lg text-hot-pink">Flippi</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 text-flamingo-blush/80 hover:text-white font-body text-sm transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => router.push('/login?mode=signup')}
              className="px-5 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg transition-colors cursor-pointer"
            >
              Start Free Trial
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-hot-pink/10 border border-hot-pink/20 rounded-full mb-6">
            <span className="text-hot-pink font-body text-sm">30 days free — no credit card required</span>
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl text-white leading-tight mb-6">
            Know your <span className="text-hot-pink">true profit</span> on every sale
          </h1>

          <p className="text-flamingo-blush/70 font-body text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Flippi tracks your real margins after platform fees, shipping, and cost of goods. Built for resellers who sell on any platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button
              onClick={() => router.push('/login?mode=signup')}
              className="w-full sm:w-auto px-8 py-4 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-lg rounded-xl transition-colors cursor-pointer shadow-lg shadow-hot-pink/20"
            >
              Start Free Trial
            </button>
            <p className="text-flamingo-blush/40 font-body text-sm">
              Then $9/month. Cancel anytime.
            </p>
          </div>

          {/* Platform tags */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-flamingo-blush/40 font-body text-xs">Works with:</span>
            {platforms.map(p => (
              <span key={p} className="px-3 py-1 bg-deep-jungle/60 border border-tropical-leaf/15 rounded-full text-flamingo-blush/60 font-body text-xs">
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-heading text-3xl sm:text-4xl text-white mb-3">
              Everything you need to run smarter
            </h2>
            <p className="text-flamingo-blush/50 font-body text-base max-w-xl mx-auto">
              Stop guessing your margins. Flippi gives you the full picture.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-deep-jungle/40 border border-tropical-leaf/15 rounded-xl p-6 hover:border-hot-pink/30 transition-colors"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-heading text-lg text-white mb-2">{f.title}</h3>
                <p className="text-flamingo-blush/60 font-body text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-heading text-3xl sm:text-4xl text-white mb-3">
              Up and running in 2 minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Sign up', desc: 'Create your account and tell us what you sell and where.' },
              { step: '2', title: 'Import or log sales', desc: 'Upload a CSV from your platform or log sales manually.' },
              { step: '3', title: 'See your real numbers', desc: 'True profit, buyer insights, and pricing intelligence — instantly.' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 bg-hot-pink/15 border border-hot-pink/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="font-heading text-hot-pink text-lg">{s.step}</span>
                </div>
                <h3 className="font-heading text-lg text-white mb-2">{s.title}</h3>
                <p className="text-flamingo-blush/60 font-body text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="relative z-10 py-20 px-4 sm:px-6">
        <div className="max-w-lg mx-auto">
          <div className="bg-deep-jungle/60 border border-tropical-leaf/20 rounded-2xl p-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-tropical-leaf/15 border border-tropical-leaf/25 rounded-full mb-6">
              <span className="text-tropical-leaf font-body text-xs font-medium">SIMPLE PRICING</span>
            </div>

            <div className="mb-6">
              <span className="font-heading text-5xl text-white">$9</span>
              <span className="text-flamingo-blush/50 font-body text-lg">/month</span>
            </div>

            <ul className="text-left space-y-3 mb-8 max-w-xs mx-auto">
              {[
                '30-day free trial',
                'Unlimited sales & expenses',
                'CSV import from any platform',
                'Buyer CRM & smart lists',
                'Pricing intelligence',
                'AI email generation',
                'Full data export',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2.5 text-flamingo-blush/80 font-body text-sm">
                  <span className="text-tropical-leaf text-base">✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <button
              onClick={() => router.push('/login?mode=signup')}
              className="w-full py-4 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-lg rounded-xl transition-colors cursor-pointer"
            >
              Start Free Trial
            </button>
            <p className="text-flamingo-blush/30 font-body text-xs mt-3">
              No credit card required. Cancel anytime.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-10 px-4 border-t border-deep-jungle/50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-heading text-sm text-hot-pink">Flippi</span>
            <span className="text-flamingo-blush/30 font-body text-xs">— Reseller Intelligence</span>
          </div>
          <p className="text-flamingo-blush/30 font-body text-xs">
            © {new Date().getFullYear()} Flippi. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
