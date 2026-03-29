'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/lib/auth';
import { updateProfile, supabase, requireUserId } from '@/lib/supabase';

export default function SettingsPage() {
  const { profile, refreshProfile, user } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('reseller');
  const [platformName, setPlatformName] = useState('');
  const [feePct, setFeePct] = useState('');
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setBusinessName(profile.business_name || '');
      setBusinessType(profile.business_type || 'reseller');
      setPlatformName(profile.platform_name || '');
    }
    loadFee();
  }, [profile]);

  async function loadFee() {
    try {
      const uid = await requireUserId();
      const { data: rows } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', uid)
        .limit(1);

      const data = rows && rows.length > 0 ? rows[0] : null;

      if (!data) {
        const { data: newRows } = await supabase
          .from('settings')
          .insert({ palmstreet_fee_pct: 0, user_id: uid })
          .select();
        const newRow = newRows && newRows.length > 0 ? newRows[0] : null;
        if (newRow) { setSettingsId(newRow.id); setFeePct('0'); }
      } else {
        setSettingsId(data.id);
        setFeePct(String(data.palmstreet_fee_pct || 0));
      }
    } catch {
      // Not ready yet
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateProfile({
        business_name: businessName,
        business_type: businessType,
        platform_name: platformName,
      });

      // Save fee
      if (settingsId) {
        await supabase.from('settings').update({ palmstreet_fee_pct: parseFloat(feePct) || 0 }).eq('id', settingsId);
      }

      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setSaving(false);
  }

  const feeLabel = platformName ? `${platformName} Fee` : 'Platform Fee';

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <h1 className="font-heading text-3xl text-hot-pink mb-2">My Business</h1>
        <p className="text-flamingo-blush/60 font-body text-sm mb-8">
          Configure your business profile. This personalizes your dashboard and email templates.
        </p>

        <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm text-flamingo-blush/80 mb-1.5 font-body">
              Business Name
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. My Shop, Vintage Finds"
              className="w-full px-4 py-3 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body"
            />
          </div>

          <div>
            <label className="block text-sm text-flamingo-blush/80 mb-1.5 font-body">
              What do you sell?
            </label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full px-4 py-3 bg-dark-bg border border-deep-jungle rounded-lg text-white font-body focus:outline-none focus:border-hot-pink"
            >
              <option value="reseller">General Reseller</option>
              <option value="plants">Plants & Botanicals</option>
              <option value="fashion">Fashion & Apparel</option>
              <option value="electronics">Electronics & Gadgets</option>
              <option value="collectibles">Collectibles & Trading Cards</option>
              <option value="vintage">Vintage & Antiques</option>
              <option value="art">Art & Handmade</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-flamingo-blush/80 mb-1.5 font-body">
              Primary Selling Platform
            </label>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder="e.g. Whatnot, eBay, Mercari, Poshmark"
              className="w-full px-4 py-3 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body"
            />
          </div>

          <div className="pt-4 border-t border-tropical-leaf/10">
            <label className="block text-sm text-flamingo-blush/80 mb-1.5 font-body">
              {feeLabel} (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={feePct}
                onChange={(e) => setFeePct(e.target.value)}
                className="flex-1 px-4 py-3 bg-dark-bg border border-deep-jungle rounded-lg text-white font-body focus:outline-none focus:border-hot-pink"
                placeholder="e.g. 15"
              />
              <span className="text-flamingo-blush/50 text-sm">%</span>
            </div>
            <p className="text-flamingo-blush/40 text-xs font-body mt-1.5">
              This is deducted from every sale to calculate your true profit
            </p>
          </div>

          <div className="pt-2 border-t border-tropical-leaf/10">
            <p className="text-flamingo-blush/40 text-xs font-body mb-1">
              Signed in as: {user?.email}
            </p>
          </div>

          {error && (
            <p className="text-red-400 text-sm font-body">{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
