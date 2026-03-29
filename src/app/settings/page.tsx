'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/lib/auth';
import { updateProfile } from '@/lib/supabase';

export default function SettingsPage() {
  const { profile, refreshProfile, user } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('reseller');
  const [platformName, setPlatformName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setBusinessName(profile.business_name || '');
      setBusinessType(profile.business_type || 'reseller');
      setPlatformName(profile.platform_name || '');
    }
  }, [profile]);

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
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setSaving(false);
  }

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
              placeholder="e.g. Jungle Lounge, RarePlant Co"
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
              placeholder="e.g. Palmstreet, Whatnot, eBay, Mercari"
              className="w-full px-4 py-3 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body"
            />
            <p className="text-flamingo-blush/40 text-xs font-body mt-1.5">
              Used to label your platform fee in the settings gear
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
