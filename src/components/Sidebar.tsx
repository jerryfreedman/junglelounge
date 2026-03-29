'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { name: 'Dashboard', href: '/main', icon: '🏠' },
  { name: 'Sales', href: '/sales', icon: '💰' },
  { name: 'Expenses', href: '/expenses', icon: '📦' },
  { name: 'Buyers', href: '/buyers', icon: '👥' },
  { name: 'Pricing', href: '/pricing', icon: '🏷️' },
  { name: 'My Business', href: '/settings', icon: '⚙️' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed top-16 left-0 h-[calc(100vh-4rem)] w-56 bg-dark-bg border-r border-deep-jungle/50 z-50 transition-transform duration-300 lg:translate-x-0 overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-body text-sm font-medium ${
                  isActive
                    ? 'bg-hot-pink/15 text-hot-pink border-l-4 border-hot-pink'
                    : 'text-gray-300 hover:bg-deep-jungle/50 hover:text-white'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4 text-center">
          <p className="text-xs text-tropical-leaf/50 font-body">
            Flippi v3.0
          </p>
        </div>
      </aside>
    </>
  );
}
