'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '@/components/AppShell';
import { supabase, Sale, Batch, ensureSettings } from '@/lib/supabase';
import CSVImportModal from '@/components/CSVImportModal';

export default function MainPage() {
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
      const [salesRes, batchRes, settings] = await Promise.all([
        supabase.from('sales').select('*').order('date', { ascending: false }),
        supabase.from('batches').select('*').order('name'),
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

  // Get current week boundaries (Mon-Sun)
  function getWeekRange() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
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

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl md:text-4xl text-hot-pink mb-1">
            Welcome back to the Jungle
          </h1>
          <p className="text-flamingo-blush/60 font-body text-sm">
            Week of {week.start} to {week.end}
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400 font-body text-sm">⚠️ {error}</p>
          </div>
        )}

        {/* CSV Upload Area */}
        <div className="bg-deep-jungle/40 border-2 border-dashed border-tropical-leaf/30 rounded-xl p-8 mb-8 text-center hover:border-hot-pink/40 transition-colors">
          <div className="text-4xl mb-3">📊</div>
          <h2 className="font-heading text-lg text-white mb-2">Import Sales Data</h2>
          <p className="text-flamingo-blush/50 font-body text-sm mb-4">
            Upload your Palmstreet CSV export to sync sales
          </p>
          <button
            onClick={() => setShowImport(true)}
            className="px-6 py-3 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg transition-colors cursor-pointer"
          >
            Upload CSV
          </button>
        </div>

        {/* Weekly Cards */}
        {loading ? (
          <div className="text-flamingo-blush animate-pulse font-body text-center py-8">Loading data...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Weekly Gross Sales */}
              <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading text-sm text-flamingo-blush/70 uppercase tracking-wide">Weekly Gross Sales</h3>
                  <span className="text-2xl">💰</span>
                </div>
                <div className="text-3xl font-heading text-hot-pink mb-1">
                  ${weeklyGross.toFixed(2)}
                </div>
                <p className="text-flamingo-blush/40 font-body text-xs">
                  {weeklyCount} sale{weeklyCount !== 1 ? 's' : ''} this week
                </p>
              </div>

              {/* Weekly Net Sales */}
              <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading text-sm text-flamingo-blush/70 uppercase tracking-wide">Weekly Net Sales</h3>
                  <span className="text-2xl">📈</span>
                </div>
                <div className={`text-3xl font-heading mb-1 ${weeklyNet >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>
                  ${weeklyNet.toFixed(2)}
                </div>
                <p className="text-flamingo-blush/40 font-body text-xs">
                  After fees, costs & shipping
                </p>
              </div>
            </div>

            {/* All-Time Summary Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-deep-jungle/30 border border-tropical-leaf/10 rounded-lg p-4 text-center">
                <div className="text-lg font-heading text-white">${totalGross.toFixed(2)}</div>
                <div className="text-xs text-flamingo-blush/50 font-body">All-Time Revenue</div>
              </div>
              <div className="bg-deep-jungle/30 border border-tropical-leaf/10 rounded-lg p-4 text-center">
                <div className={`text-lg font-heading ${totalNet >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>${totalNet.toFixed(2)}</div>
                <div className="text-xs text-flamingo-blush/50 font-body">All-Time Profit</div>
              </div>
              <div className="bg-deep-jungle/30 border border-tropical-leaf/10 rounded-lg p-4 text-center">
                <div className="text-lg font-heading text-white">{sales.length}</div>
                <div className="text-xs text-flamingo-blush/50 font-body">Total Sales</div>
              </div>
              <div className="bg-deep-jungle/30 border border-tropical-leaf/10 rounded-lg p-4 text-center">
                <div className="text-lg font-heading text-white">
                  {totalGross > 0 ? ((totalNet / totalGross) * 100).toFixed(1) : '0'}%
                </div>
                <div className="text-xs text-flamingo-blush/50 font-body">Profit Margin</div>
              </div>
            </div>
          </>
        )}

        {/* CSV Import Modal */}
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
