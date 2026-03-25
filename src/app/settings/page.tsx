'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const [feePct, setFeePct] = useState('');
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code === 'PGRST116') {
      const { data: newRow } = await supabase
        .from('settings')
        .insert({ palmstreet_fee_pct: 0 })
        .select()
        .single();
      if (newRow) {
        setSettingsId(newRow.id);
        setFeePct('0');
      }
    } else if (data) {
      setSettingsId(data.id);
      setFeePct(String(data.palmstreet_fee_pct || 0));
    }
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settingsId) return;
    setSaving(true);
    setSaved(false);

    const newFee = parseFloat(feePct) || 0;
    const { error } = await supabase
      .from('settings')
      .update({ palmstreet_fee_pct: newFee })
      .eq('id', settingsId);

    if (error) {
      console.error('Settings save error:', error);
      alert('Failed to save settings: ' + error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <h1 className="font-heading text-3xl text-hot-pink mb-6">Settings</h1>

        {loading ? (
          <div className="text-flamingo-blush animate-pulse">Loading settings...</div>
        ) : (
          <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6">
            <h2 className="font-heading text-xl text-white mb-4">Palmstreet Platform Fee</h2>
            <p className="text-flamingo-blush/70 text-sm mb-6 font-body">
              This fee percentage is applied to every sale to calculate true profit across the entire app.
            </p>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm text-flamingo-blush mb-2 font-body">
                  Fee Percentage (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={feePct}
                    onChange={(e) => setFeePct(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink focus:ring-1 focus:ring-hot-pink transition-colors font-body pr-10"
                    placeholder="e.g. 15"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-flamingo-blush/50">%</span>
                </div>
                <p className="text-flamingo-blush/50 text-xs mt-2 font-body">
                  Example: Enter 15 for a 15% platform fee
                </p>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 bg-hot-pink hover:bg-flamingo-blush text-white font-heading rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
                {saved && (
                  <span className="text-tropical-leaf font-body text-sm animate-pulse">
                    ✓ Settings saved!
                  </span>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </AppShell>
  );
}
