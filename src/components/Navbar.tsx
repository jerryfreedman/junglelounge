'use client';

import { useRouter } from 'next/navigation';
import Logo from './Logo';

interface NavbarProps {
  onMenuToggle: () => void;
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('authenticated');
    router.push('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-dark-bg/95 border-b border-deep-jungle z-50 flex items-center justify-between px-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden text-white p-2 hover:bg-deep-jungle rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Logo size={40} />
        <h1 className="font-heading text-xl text-hot-pink hidden sm:block">
          Jungle Lounge Intel
        </h1>
      </div>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2 px-4 py-2 text-sm text-flamingo-blush hover:text-white hover:bg-deep-jungle rounded-lg transition-colors font-body cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Logout
      </button>
    </header>
  );
}
