'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const auth = localStorage.getItem('authenticated');
    if (auth === 'true') {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen jungle-bg flex items-center justify-center">
      <div className="text-flamingo-blush animate-pulse font-heading text-xl">
        Loading the jungle...
      </div>
    </div>
  );
}
