'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import { useAuth } from '@/lib/auth';
import { updateProfile, supabase, requireUserId } from '@/lib/supabase';

const STEPS = ['Welcome', 'Business', 'Platform', 'Fee', 'Tour'];

const BUSINESS_TYPES = [
  { value: 'plants', label: 'Plants & Botanicals', emoji: '🌿' },
  { value: 'fashion', label: 'Fashion & Apparel', emoji: '👗' },
  { value: 'electronics', label: 'Electronics & Gadgets', emoji: '📱' },
  { value: 'collectibles', label: 'Collectibles & Cards', emoji: '🃏' },
  { value: 'vintage', label: 'Vintage & Antiques', emoji: '🏺' },
  { value: 'art', label: 'Art & Handmade', emoji: '🎨' },
  { value: 'reseller', label: 'General Reseller', emoji: '📦' },
  { value: 'other', label: 'Other', emoji: '✨' },
];

const PLATFORMS = [
  { value: 'Palmstreet', label: 'Palmstreet' },
  { value: 'Whatnot', label: 'Whatnot' },
  { value: 'eBay', label: 'eBay' },
  { value: 'Mercari', label: 'Mercari' },
  { value: 'Poshmark', label: 'Poshmark' },
  { value: 'Depop', label: 'Depop' },
  { value: 'Facebook Marketplace', label: 'Facebook Marketplace' },
  { value: 'Etsy', label: 'Etsy' },
  { value: 'Amazon', label: 'Amazon' },
  { value: 'Shopify', label: 'Shopify' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, isLoading, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [platformName, setPlatformName] = useState('');
  const [customPlatform, setCustomPlatform] = useState('');
  const [feePct, setFeePct] = useState('');

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
    if (!isLoading && profile?.onboarding_complete) {
      router.replace('/main');
    }
  }, [isLoading, user, profile, router]);

  async function handleFinish() {
    setSaving(true);
    try {
      const finalPlatform = platformName === '__custom__' ? customPlatform : platformName;

      await updateProfile({
        business_name: businessName || 'My Business',
        business_type: businessType || 'reseller',
        platform_name: finalPlatform || '',
        onboarding_complete: true,
      });

      // Create initial settings row with fee
      const uid = await requireUserId();
      const fee = parseFloat(feePct) || 0;
      const { data: existingRows } = await supabase
        .from('settings')
        .select('id')
        .eq('user_id', uid)
        .limit(1);
      const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

      if (existing) {
        await supabase.from('settings').update({ palmstreet_fee_pct: fee }).eq('id', existing.id);
      } else {
        await supabase.from('settings').insert({ palmstreet_fee_pct: fee, user_id: uid });
      }

      await refreshProfile();
      router.push('/main');
    } catch (err) {
      console.error('Onboarding error:', err);
    }
    setSaving(false);
  }

  function canAdvance(): boolean {
    if (step === 1) return businessName.trim().length > 0 && businessType !== '';
    if (step === 2) return platformName !== '' && (platformName !== '__custom__' || customPlatform.trim().length > 0);
    return true;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen jungle-bg flex items-center justify-center">
        <div className="text-flamingo-blush animate-pulse font-heading text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen jungle-bg leaf-pattern flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-lg">
        {/* Progress bar */}
        <div className="flex items-center gap-1 mb-6 px-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex items-center gap-1">
              <div className={`h-1.5 rounded-full flex-1 transition-colors duration-300 ${
                i <= step ? 'bg-hot-pink' : 'bg-deep-jungle'
              }`} />
            </div>
          ))}
        </div>

        <div className="bg-deep-jungle/80 border border-tropical-leaf/20 rounded-2xl shadow-2xl p-8 backdrop-blur-sm">

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <Logo size={80} />
              </div>
              <h1 className="font-heading text-3xl text-hot-pink mb-3">
                Welcome to Flippi
              </h1>
              <p className="text-flamingo-blush/70 font-body mb-2">
                Reseller Intelligence
              </p>
              <p className="text-flamingo-blush/50 font-body text-sm mb-8 max-w-sm mx-auto">
                Let&apos;s get your account set up in under a minute. We&apos;ll personalize your dashboard, email templates, and profit tracking.
              </p>
              <button
                onClick={() => setStep(1)}
                className="px-8 py-3 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-lg rounded-lg transition-colors cursor-pointer"
              >
                Let&apos;s Go
              </button>
            </div>
          )}

          {/* Step 1: Business Name & Type */}
          {step === 1 && (
            <div>
              <h2 className="font-heading text-2xl text-white mb-1">Your Business</h2>
              <p className="text-flamingo-blush/50 font-body text-sm mb-6">What should we call your business?</p>

              <div className="mb-5">
                <label className="block text-sm text-flamingo-blush/80 mb-1.5 font-body">Business Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. My Shop, Vintage Finds NYC"
                  autoFocus
                  className="w-full px-4 py-3 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body"
                />
              </div>

              <div>
                <label className="block text-sm text-flamingo-blush/80 mb-2 font-body">What do you sell?</label>
                <div className="grid grid-cols-2 gap-2">
                  {BUSINESS_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setBusinessType(t.value)}
                      className={`px-3 py-2.5 rounded-lg border text-left font-body text-sm transition-all cursor-pointer ${
                        businessType === t.value
                          ? 'border-hot-pink bg-hot-pink/15 text-white'
                          : 'border-deep-jungle bg-dark-bg/50 text-flamingo-blush/70 hover:border-tropical-leaf/40'
                      }`}
                    >
                      <span className="mr-2">{t.emoji}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Selling Platform */}
          {step === 2 && (
            <div>
              <h2 className="font-heading text-2xl text-white mb-1">Where do you sell?</h2>
              <p className="text-flamingo-blush/50 font-body text-sm mb-6">Pick your primary selling platform</p>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {PLATFORMS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => { setPlatformName(p.value); setCustomPlatform(''); }}
                    className={`px-3 py-2.5 rounded-lg border text-left font-body text-sm transition-all cursor-pointer ${
                      platformName === p.value
                        ? 'border-hot-pink bg-hot-pink/15 text-white'
                        : 'border-deep-jungle bg-dark-bg/50 text-flamingo-blush/70 hover:border-tropical-leaf/40'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => setPlatformName('__custom__')}
                  className={`px-3 py-2.5 rounded-lg border text-left font-body text-sm transition-all cursor-pointer ${
                    platformName === '__custom__'
                      ? 'border-hot-pink bg-hot-pink/15 text-white'
                      : 'border-deep-jungle bg-dark-bg/50 text-flamingo-blush/70 hover:border-tropical-leaf/40'
                  }`}
                >
                  Other...
                </button>
              </div>

              {platformName === '__custom__' && (
                <input
                  type="text"
                  value={customPlatform}
                  onChange={(e) => setCustomPlatform(e.target.value)}
                  placeholder="Type your platform name"
                  autoFocus
                  className="w-full px-4 py-3 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body"
                />
              )}
            </div>
          )}

          {/* Step 3: Platform Fee */}
          {step === 3 && (
            <div>
              <h2 className="font-heading text-2xl text-white mb-1">Platform Fee</h2>
              <p className="text-flamingo-blush/50 font-body text-sm mb-6">
                What percentage does <span className="text-hot-pink">{platformName === '__custom__' ? customPlatform : platformName}</span> take on each sale? You can always change this later in settings.
              </p>

              <div className="flex items-center gap-3 mb-4">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={feePct}
                  onChange={(e) => setFeePct(e.target.value)}
                  placeholder="e.g. 15"
                  autoFocus
                  className="flex-1 px-4 py-3 bg-dark-bg border border-deep-jungle rounded-lg text-white text-2xl font-heading text-center placeholder-gray-500 focus:outline-none focus:border-hot-pink"
                />
                <span className="text-flamingo-blush text-2xl font-heading">%</span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map(v => (
                  <button
                    key={v}
                    onClick={() => setFeePct(String(v))}
                    className={`py-2 rounded-lg border text-center font-body text-sm transition-all cursor-pointer ${
                      feePct === String(v)
                        ? 'border-hot-pink bg-hot-pink/15 text-white'
                        : 'border-deep-jungle bg-dark-bg/50 text-flamingo-blush/70 hover:border-tropical-leaf/40'
                    }`}
                  >
                    {v}%
                  </button>
                ))}
              </div>

              <p className="text-flamingo-blush/30 font-body text-xs mt-4 text-center">
                Not sure? Leave it at 0 for now and set it later in the gear icon.
              </p>
            </div>
          )}

          {/* Step 4: Quick Tour */}
          {step === 4 && (
            <div>
              <h2 className="font-heading text-2xl text-white mb-1">You&apos;re all set!</h2>
              <p className="text-flamingo-blush/50 font-body text-sm mb-6">
                Here&apos;s a quick look at what Flippi can do for <span className="text-hot-pink">{businessName}</span>:
              </p>

              <div className="space-y-3 mb-6">
                {[
                  { icon: '🏠', title: 'Dashboard', desc: 'Weekly and all-time P&L at a glance. Export your full data as CSV anytime.' },
                  { icon: '💰', title: 'Sales', desc: 'Log sales, import CSVs, track refunds. Every sale auto-calculates true profit after fees and shipping.' },
                  { icon: '📦', title: 'Expenses', desc: 'Track inventory batches by supplier. Upload invoices and AI extracts the line items for you.' },
                  { icon: '👥', title: 'Buyers', desc: 'Auto-built customer profiles. See VIPs, active, and cold buyers. Generate personalized emails in one click.' },
                  { icon: '🏷️', title: 'Pricing', desc: 'See what sells best, suggested starting bids, and high-value items to restock.' },
                  { icon: '⚙️', title: 'Settings', desc: 'Update your business profile, selling platform, and fee percentage anytime.' },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3 p-3 rounded-lg bg-dark-bg/40 border border-tropical-leaf/10">
                    <span className="text-xl mt-0.5">{item.icon}</span>
                    <div>
                      <h3 className="font-heading text-sm text-white">{item.title}</h3>
                      <p className="text-flamingo-blush/50 font-body text-xs">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          {step > 0 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-tropical-leaf/10">
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 text-flamingo-blush/60 hover:text-white font-body text-sm cursor-pointer transition-colors"
              >
                Back
              </button>

              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep(s => s + 1)}
                  disabled={!canAdvance()}
                  className="px-6 py-2.5 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="px-6 py-2.5 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Setting up...' : 'Go to Dashboard →'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Step indicator */}
        <p className="text-center text-flamingo-blush/30 text-xs font-body mt-4">
          {step > 0 && step < STEPS.length - 1 ? `Step ${step} of ${STEPS.length - 2}` : ''}
        </p>
      </div>
    </div>
  );
}
