'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { supabase, Sale, Batch, ensureSettings, requireUserId } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import CSVImportModal from '@/components/CSVImportModal';

export default function MainPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [feePct, setFeePct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const uid = await requireUserId();
      const [salesRes, batchRes, settings] = await Promise.all([
        supabase.from('sales').select('*').eq('user_id', uid).order('date', { ascending: false }),
        supabase.from('batches').select('*').eq('user_id', uid).order('name'),
        ensureSettings(),
      ]);
      if (salesRes.error) throw new Error(`Sales load failed: ${salesRes.error.message}`);
      if (batchRes.error) throw new Error(`Batches load failed: ${batchRes.error.message}`);
      setSales(salesRes.data || []);
      setBatches(batchRes.data || []);
      setFeePct(settings.palmstreet_fee_pct || 0);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function getWeekRange() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday.toISOString().split('T')[0], end: sunday.toISOString().split('T')[0] };
  }

  const week = getWeekRange();
  const weeklySales = sales.filter(s => s.date >= week.start && s.date <= week.end);

  const weeklyGross = weeklySales.reduce((sum, s) => sum + s.sale_price, 0);
  const weeklyNet = weeklySales.reduce((sum, s) => sum + s.true_profit, 0);
  const weeklyCount = weeklySales.length;
  const totalGross = sales.reduce((sum, s) => sum + s.sale_price, 0);
  const totalNet = sales.reduce((sum, s) => sum + s.true_profit, 0);

  const biz = profile?.business_name;
  const greeting = biz && biz !== 'My Business'
    ? `Welcome back, ${biz}`
    : 'Welcome to Flippi';

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading text-3xl md:text-4xl text-hot-pink mb-1">
            {greeting}
          </h1>
          <p className="text-flamingo-blush/60 font-body text-sm">
            Week of {week.start} to {week.end}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400 font-body text-sm">⚠️ {error}</p>
          </div>
        )}

        <div className="bg-deep-jungle/40 border-2 border-dashed border-tropical-leaf/30 rounded-xl p-8 mb-8 text-center hover:border-hot-pink/40 transition-colors">
          <div className="text-4xl mb-3">📊</div>
          <h2 className="font-heading text-lg text-white mb-2">Import Sales Data</h2>
          <p className="text-flamingo-blush/50 font-body text-sm mb-4">
            Upload your CSV export to sync sales
          </p>
          <button
            onClick={() => setShowImport(true)}
            className="px-6 py-3 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg transition-colors cursor-pointer"
          >
            Upload CSV
          </button>
        </div>

        {loading ? (
          <div className="text-flamingo-blush animate-pulse font-body text-center py-8">Loading data...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div onClick={() => router.push('/sales')}
                className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 cursor-pointer hover:border-hot-pink/40 transition-colors group">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading text-sm text-flamingo-blush/70 uppercase tracking-wide">Weekly Gross Sales</h3>
                  <span className="text-2xl">💰</span>
                </div>
                <div className="text-3xl font-heading text-hot-pink mb-1">
                  ${weeklyGross.toFixed(2)}
                </div>
                <p className="text-flamingo-blush/40 font-body text-xs">
                  {weeklyCount} sale{weeklyCount !== 1 ? 's' : ''} this week
                  <span className="ml-2 text-hot-pink/0 group-hover:text-hot-pink/60 transition-colors">View all →</span>
                </p>
              </div>

              <div onClick={() => router.push('/sales')}
                className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 cursor-pointer hover:border-hot-pink/40 transition-colors group">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading text-sm text-flamingo-blush/70 uppercase tracking-wide">Weekly Net Sales</h3>
                  <span className="text-2xl">📈</span>
                </div>
                <div className={`text-3xl font-heading mb-1 ${weeklyNet >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>
                  ${weeklyNet.toFixed(2)}
                </div>
                <p className="text-flamingo-blush/40 font-body text-xs">
                  After fees, costs & shipping
                  <span className="ml-2 text-hot-pink/0 group-hover:text-hot-pink/60 transition-colors">View all →</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div onClick={() => router.push('/sales')}
                className="bg-deep-jungle/30 border border-tropical-leaf/10 rounded-lg p-4 text-center cursor-pointer hover:border-hot-pink/30 transition-colors">
                <div className="text-lg font-heading text-white">${totalGross.toFixed(2)}</div>
                <div className="text-xs text-flamingo-blush/50 font-body">All-Time Revenue</div>
              </div>
              <div onClick={() => router.push('/sales')}
                className="bg-deep-jungle/30 border border-tropical-leaf/10 rounded-lg p-4 text-center cursor-pointer hover:border-hot-pink/30 transition-colors">
                <div className={`text-lg font-heading ${totalNet >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>${totalNet.toFixed(2)}</div>
                <div className="text-xs text-flamingo-blush/50 font-body">All-Time Profit</div>
              </div>
              <div onClick={() => router.push('/sales')}
                className="bg-deep-jungle/30 border border-tropical-leaf/10 rounded-lg p-4 text-center cursor-pointer hover:border-hot-pink/30 transition-colors">
                <div className="text-lg font-heading text-white">{sales.length}</div>
                <div className="text-xs text-flamingo-blush/50 font-body">Total Sales</div>
              </div>
              <div onClick={() => router.push('/expenses')}
                className="bg-deep-jungle/30 border border-tropical-leaf/10 rounded-lg p-4 text-center cursor-pointer hover:border-hot-pink/30 transition-colors">
                <div className="text-lg font-heading text-white">
                  {totalGross > 0 ? ((totalNet / totalGross) * 100).toFixed(1) : '0'}%
                </div>
                <div className="text-xs text-flamingo-blush/50 font-body">Profit Margin</div>
              </div>
            </div>

            {sales.length > 0 && (
              <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-tropical-leaf/20">
                  <h2 className="font-heading text-lg text-white">Recent Sales</h2>
                  <button onClick={() => router.push('/sales')}
                    className="text-hot-pink/70 hover:text-hot-pink text-xs font-body cursor-pointer">
                    View all →
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-tropical-leaf/20">
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Item</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Buyer</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Price</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Profit</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.slice(0, 5).map(s => (
                        <tr key={s.id} className="border-b border-tropical-leaf/10 hover:bg-tropical-leaf/5 cursor-pointer"
                          onClick={() => router.push('/sales')}>
                          <td className="px-3 py-2.5 text-white font-body">{s.plant_name}</td>
                          <td className="px-3 py-2.5 text-flamingo-blush/70 font-body">{s.buyer_name}</td>
                          <td className="px-3 py-2.5 text-white font-body">${s.sale_price.toFixed(2)}</td>
                          <td className={`px-3 py-2.5 font-heading text-sm ${s.true_profit >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>
                            ${s.true_profit.toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 text-flamingo-blush/60 font-body">{s.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        <CSVImportModal
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          onComplete={loadData}
          batches={batches}
          feePct={feePct}
        />
      </div>
    </AppShell>
  );
}
