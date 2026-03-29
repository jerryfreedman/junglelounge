'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (password === '123456') {
      localStorage.setItem('authenticated', 'true');
      router.push('/main');
    } else {
      setError('Wrong password. Try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen jungle-bg leaf-pattern flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-deep-jungle/80 border border-tropical-leaf/20 rounded-2xl shadow-2xl p-8 backdrop-blur-sm">
          <div className="flex justify-center mb-6">
            <Logo size={100} />
          </div>

          <h1 className="font-heading text-3xl text-center text-hot-pink mb-2">
            Jungle Lounge Intel
          </h1>
          <p className="text-center text-flamingo-blush text-sm mb-8 font-body">
            Business Intelligence Dashboard
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm text-flamingo-blush mb-2 font-body">
                Enter Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full px-4 py-3 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink focus:ring-1 focus:ring-hot-pink transition-colors font-body"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-hot-pink text-sm text-center font-body">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-lg rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? 'Entering the jungle...' : 'Enter the Jungle 🌿'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
