'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Logo from './Logo';
import { supabase } from '@/lib/supabase';

interface NavbarProps {
  onMenuToggle: () => void;
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [feePct, setFeePct] = useState('');
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    }
    if (showSettings) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  async function loadSettings() {
    const { data, error } = await supabase.from('settings').select('*').limit(1).single();
    if (error && error.code === 'PGRST116') {
      const { data: newRow } = await supabase.from('settings').insert({ palmstreet_fee_pct: 0 }).select().single();
      if (newRow) { setSettingsId(newRow.id); setFeePct('0'); }
    } else if (data) {
      setSettingsId(data.id);
      setFeePct(String(data.palmstreet_fee_pct || 0));
    }
  }

  async function handleSave() {
    if (!settingsId) return;
    setSaving(true);
    setSaved(false);
    await supabase.from('settings').update({ palmstreet_fee_pct: parseFloat(feePct) || 0 }).eq('id', settingsId);
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  }

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

      <div className="flex items-center gap-2">
        {/* Settings Gear */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-flamingo-blush hover:text-white hover:bg-deep-jungle rounded-lg transition-colors cursor-pointer"
            aria-label="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {showSettings && (
            <div className="absolute right-0 top-12 w-72 bg-deep-jungle border border-tropical-leaf/30 rounded-xl shadow-2xl p-4 z-50">
              <h3 className="font-heading text-sm text-white mb-3">Palmstreet Fee</h3>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={feePct}
                  onChange={(e) => setFeePct(e.target.value)}
                  className="flex-1 px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white font-body text-sm focus:outline-none focus:border-hot-pink"
                  placeholder="e.g. 15"
                />
                <span className="text-flamingo-blush/50 text-sm">%</span>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm text-flamingo-blush hover:text-white hover:bg-deep-jungle rounded-lg transition-colors font-body cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
