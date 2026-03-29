'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { supabase, Sale, ensureSettings, requireUserId } from '@/lib/supabase';

interface PlantPerformance {
  name: string;
  timesSold: number;
  avgPrice: number;
  highPrice: number;
  lowPrice: number;
  avgProfit: number;
  avgMargin: number;
  lastSoldDate: string;
}

export default function PricingPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string>('avgProfit');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [bidPlant, setBidPlant] = useState('');
  const [buffer, setBuffer] = useState(20);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureSettings();
      const uid = await requireUserId();
      const { data, error: fetchErr } = await supabase.from('sales').select('*').eq('user_id', uid).order('date', { ascending: false });
      if (fetchErr) throw new Error(`Failed to load sales: ${fetchErr.message}`);
      setSales(data || []);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Aggregate plant performance
  const plantMap: Record<string, Sale[]> = {};
  sales.forEach(s => {
    if (!plantMap[s.plant_name]) plantMap[s.plant_name] = [];
    plantMap[s.plant_name].push(s);
  });

  const plantPerformance: PlantPerformance[] = Object.entries(plantMap).map(([name, plantSales]) => {
    const prices = plantSales.map(s => s.sale_price);
    const profits = plantSales.map(s => s.true_profit);
    const margins = plantSales.map(s => s.true_margin_pct);
    const dates = plantSales.map(s => s.date).sort();
    return {
      name,
      timesSold: plantSales.length,
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      highPrice: Math.max(...prices),
      lowPrice: Math.min(...prices),
      avgProfit: profits.reduce((a, b) => a + b, 0) / profits.length,
      avgMargin: margins.reduce((a, b) => a + b, 0) / margins.length,
      lastSoldDate: dates[dates.length - 1],
    };
  });

  // Sort
  const sorted = [...plantPerformance].sort((a, b) => {
    const aVal = (a as unknown as Record<string, unknown>)[sortField];
    const bVal = (b as unknown as Record<string, unknown>)[sortField];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
  });

  const filtered = sorted.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  function handleSort(field: string) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  }

  // Suggested Bid Calculator
  const bidData = plantPerformance.find(p => p.name.toLowerCase() === bidPlant.toLowerCase());
  const suggestedBid = bidData ? bidData.avgPrice * (1 - buffer / 100) : null;

  // Plants to Watch: avg price > $100, not sold in 60+ days
  const today = new Date();
  const plantsToWatch = plantPerformance.filter(p => {
    const daysSince = Math.floor((today.getTime() - new Date(p.lastSoldDate).getTime()) / (1000 * 60 * 60 * 24));
    return p.avgPrice > 100 && daysSince > 60;
  });

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <h1 className="font-heading text-3xl text-hot-pink mb-6">Pricing Intelligence</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400 font-body text-sm">⚠️ {error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-flamingo-blush animate-pulse font-body text-center py-8">Loading pricing data...</div>
        ) : (
          <>
            {/* Suggested Starting Bid Calculator */}
            <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 mb-6">
              <h2 className="font-heading text-lg text-white mb-4">Suggested Starting Bid</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Item Name</label>
                  <input
                    value={bidPlant}
                    onChange={e => setBidPlant(e.target.value)}
                    list="plant-names"
                    placeholder="Type or select a plant..."
                    className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body text-sm"
                  />
                  <datalist id="plant-names">
                    {plantPerformance.map(p => <option key={p.name} value={p.name} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Buffer: {buffer}%</label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={buffer}
                    onChange={e => setBuffer(parseInt(e.target.value))}
                    className="w-full accent-hot-pink"
                  />
                </div>
                <div>
                  {bidData && suggestedBid !== null ? (
                    <div className="bg-dark-bg/60 rounded-lg p-4 border border-hot-pink/20">
                      <p className="text-flamingo-blush/60 font-body text-xs mb-1">
                        Average sale: <span className="text-white">${bidData.avgPrice.toFixed(2)}</span> — {buffer}% buffer
                      </p>
                      <p className="text-2xl font-heading text-hot-pink">
                        Start at ${suggestedBid.toFixed(2)}
                      </p>
                      <p className="text-flamingo-blush/40 font-body text-xs mt-1">
                        Sold {bidData.timesSold}x · High: ${bidData.highPrice.toFixed(2)} · Low: ${bidData.lowPrice.toFixed(2)}
                      </p>
                    </div>
                  ) : bidPlant && !bidData ? (
                    <div className="bg-dark-bg/60 rounded-lg p-4 border border-tropical-leaf/20">
                      <p className="text-flamingo-blush/50 font-body text-sm">No sales history for this plant yet.</p>
                    </div>
                  ) : (
                    <div className="bg-dark-bg/60 rounded-lg p-4 border border-tropical-leaf/10">
                      <p className="text-flamingo-blush/40 font-body text-sm">Select a plant to see suggested bid.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Plant Performance Table */}
            <div className="mb-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h2 className="font-heading text-lg text-white">Plant Performance</h2>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search plants..."
                  className="w-64 px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body text-sm"
                />
              </div>

              <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl overflow-hidden">
                {filtered.length === 0 ? (
                  <div className="p-8 text-center text-flamingo-blush/50 font-body text-sm">
                    {search ? 'No matching plants.' : 'No sales data yet.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-tropical-leaf/20">
                          {[
                            { key: 'name', label: 'Plant' },
                            { key: 'timesSold', label: '# Sold' },
                            { key: 'avgPrice', label: 'Avg Price' },
                            { key: 'highPrice', label: 'High' },
                            { key: 'lowPrice', label: 'Low' },
                            { key: 'avgProfit', label: 'Avg Profit' },
                            { key: 'avgMargin', label: 'Margin %' },
                            { key: 'lastSoldDate', label: 'Last Sold' },
                          ].map(col => (
                            <th key={col.key} onClick={() => handleSort(col.key)}
                              className="px-3 py-3 text-left text-flamingo-blush/70 font-body font-medium cursor-pointer hover:text-hot-pink text-xs uppercase tracking-wide whitespace-nowrap">
                              {col.label} {sortField === col.key && (sortDir === 'asc' ? '↑' : '↓')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(p => (
                          <tr key={p.name} className="border-b border-tropical-leaf/10 hover:bg-tropical-leaf/5 cursor-pointer"
                            onClick={() => setBidPlant(p.name)}>
                            <td className="px-3 py-2.5 text-white font-body font-medium">{p.name}</td>
                            <td className="px-3 py-2.5 text-flamingo-blush/70 font-body">{p.timesSold}</td>
                            <td className="px-3 py-2.5 text-white font-body">${p.avgPrice.toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-tropical-leaf font-body">${p.highPrice.toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-flamingo-blush/60 font-body">${p.lowPrice.toFixed(2)}</td>
                            <td className={`px-3 py-2.5 font-heading text-sm ${p.avgProfit >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>
                              ${p.avgProfit.toFixed(2)}
                            </td>
                            <td className={`px-3 py-2.5 font-body ${p.avgMargin >= 50 ? 'text-tropical-leaf' : p.avgMargin >= 20 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {p.avgMargin.toFixed(1)}%
                            </td>
                            <td className="px-3 py-2.5 text-flamingo-blush/60 font-body">{p.lastSoldDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Plants to Watch */}
            <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6">
              <h2 className="font-heading text-lg text-white mb-4">Plants to Watch</h2>
              <p className="text-flamingo-blush/50 font-body text-xs mb-4">High-value plants (avg &gt; $100) not sold in 60+ days — restocking targets</p>
              {plantsToWatch.length === 0 ? (
                <div className="bg-dark-bg/40 rounded-lg p-6 text-center">
                  <div className="text-3xl mb-2">🌿</div>
                  <p className="text-flamingo-blush/50 font-body text-sm">
                    No plants qualify right now. All high-value plants have been selling recently — nice work!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plantsToWatch.map(p => {
                    const daysSince = Math.floor((today.getTime() - new Date(p.lastSoldDate).getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={p.name} className="bg-dark-bg/40 border border-hot-pink/20 rounded-lg p-4">
                        <h3 className="font-heading text-sm text-hot-pink mb-2">{p.name}</h3>
                        <div className="space-y-1 text-xs text-flamingo-blush/60 font-body">
                          <p>Avg sale: <span className="text-white">${p.avgPrice.toFixed(2)}</span></p>
                          <p>Last sold: <span className="text-yellow-400">{daysSince} days ago</span></p>
                          <p>Sold {p.timesSold} time{p.timesSold !== 1 ? 's' : ''}</p>
                        </div>
                        <p className="text-hot-pink/60 font-body text-xs mt-2 italic">Consider sourcing again</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
