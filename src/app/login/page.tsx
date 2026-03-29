'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import { useAuth } from '@/lib/auth';

type Mode = 'login' | 'signup' | 'forgot';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const router = useRouter();
  const { user, isLoading: authLoading, signIn, signUp } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/main');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setIsLoading(false);
        return;
      }
      const { error: signUpError } = await signUp(email, password);
      if (signUpError) {
        setError(signUpError);
      } else {
        setMessage('Account created! You can now sign in.');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      }
    } else if (mode === 'login') {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError(signInError);
      } else {
        router.push('/main');
      }
    } else if (mode === 'forgot') {
      // Import supabase directly for password reset
      const { supabase } = await import('@/lib/supabase');
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (resetError) {
        setError(resetError.message);
      } else {
        setMessage('Check your email for a password reset link.');
      }
    }

    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen jungle-bg flex items-center justify-center">
        <div className="text-flamingo-blush animate-pulse font-heading text-xl">Loading...</div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen jungle-bg leaf-pattern flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-deep-jungle/80 border border-tropical-leaf/20 rounded-2xl shadow-2xl p-8 backdrop-blur-sm">
          <div className="flex justify-center mb-6">
            <Logo size={80} />
          </div>

          <h1 className="font-heading text-3xl text-center text-hot-pink mb-1">
            Flippi
          </h1>
          <p className="text-center text-flamingo-blush/70 text-sm mb-6 font-body">
            {mode === 'login' && 'Sign in to your reseller dashboard'}
            {mode === 'signup' && 'Create your free account'}
            {mode === 'forgot' && 'Reset your password'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm text-flamingo-blush/80 mb-1.5 font-body">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink focus:ring-1 focus:ring-hot-pink transition-colors font-body"
                autoFocus
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label htmlFor="password" className="block text-sm text-flamingo-blush/80 mb-1.5 font-body">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink focus:ring-1 focus:ring-hot-pink transition-colors font-body"
                />
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm text-flamingo-blush/80 mb-1.5 font-body">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink focus:ring-1 focus:ring-hot-pink transition-colors font-body"
                />
              </div>
            )}

            {error && (
              <p className="text-red-400 text-sm text-center font-body">{error}</p>
            )}
            {message && (
              <p className="text-tropical-leaf text-sm text-center font-body">{message}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-lg rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isLoading
                ? 'Loading...'
                : mode === 'login'
                  ? 'Sign In'
                  : mode === 'signup'
                    ? 'Create Account'
                    : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            {mode === 'login' && (
              <>
                <button
                  onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
                  className="text-flamingo-blush/70 hover:text-hot-pink text-sm font-body cursor-pointer transition-colors"
                >
                  Don&apos;t have an account? Sign up
                </button>
                <br />
                <button
                  onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
                  className="text-flamingo-blush/50 hover:text-flamingo-blush text-xs font-body cursor-pointer transition-colors"
                >
                  Forgot password?
                </button>
              </>
            )}
            {(mode === 'signup' || mode === 'forgot') && (
              <button
                onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                className="text-flamingo-blush/70 hover:text-hot-pink text-sm font-body cursor-pointer transition-colors"
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-flamingo-blush/30 text-xs font-body mt-4">
          Flippi — Reseller Intelligence
        </p>
      </div>
    </div>
  );
}
