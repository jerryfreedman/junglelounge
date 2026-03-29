'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const router = useRouter();
  const { user, profile, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/login');
      } else if (profile && !profile.onboarding_complete) {
        router.replace('/onboarding');
      } else if (profile && profile.onboarding_complete) {
        router.replace('/main');
      }
      // If profile is null but user exists, wait for profile to load
    }
  }, [user, profile, isLoading, router]);

  return (
    <div className="min-h-screen jungle-bg flex items-center justify-center">
      <div className="text-flamingo-blush animate-pulse font-heading text-xl">
        Loading...
      </div>
    </div>
  );
}
