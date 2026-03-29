'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    } else if (!isLoading && profile && !profile.onboarding_complete) {
      router.replace('/onboarding');
    }
  }, [isLoading, user, profile, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen jungle-bg flex items-center justify-center">
        <div className="text-flamingo-blush animate-pulse font-heading text-xl">
          Loading...
        </div>
      </div>
    );
  }

  if (!user || (profile && !profile.onboarding_complete)) {
    return null;
  }

  return (
    <div className="min-h-screen jungle-bg leaf-pattern">
      <Navbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="relative z-10 pt-16 lg:pl-56 min-h-screen">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
