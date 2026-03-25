'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { supabase, Sale, Batch } from '@/lib/supabase';

interface PlantStats {
  name: string;
  avgPrice: number;
  highPrice: number;
  lowPrice: number;
  avgProfit: number;
  avgMargin: number;
  timesSold: number;
  lastSold: string;
}

interface SupplierStats {
  name: string;
  totalInvested: number;
  totalRevenue: number;
  totalProfit: number;
  avgMargin: number;
  avgDaysToSale: number;
  topPlants: { name: string; profit: number }[];
  plantCount: number;
}

export default function PricingPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string>('avgProfit');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [bidPlant, setBidPlant] = useState('');
  const [bidBuffer, setBidBuffer] = useState(20);
  const [activeTab, setActiveTab] = useState<'pricing' | 'supplier'>('pricing');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [salesRes, batchRes] = await Promise.all([
      supabase.from('sales').select('*').order('date', { ascending: false }),
      supabase.from('batches').select('*').order('name'),
    ]);
    setSales(salesRes.data || []);
    setBatches(batchRes.data || []);
    setLoading(false);
  }

  // Plant Performance
  const plantMap: Record<string, Sale[]> = {};
  sales.forEach(s => {
    if (!plantMap[s.plant_name]) plantMap[s.plant_name] = [];
    plantMap[s.plant_name].push(s);
  });

  const plantStats: PlantStats[] = Object.entries(plantMap)
    .filter(([, sls]) => sls.length > 1)
    .map(([name, sls]) => {
      const prices = sls.map(s => s.sale_price);
      const profits = sls.map(s => s.true_profit);
      const margins = sls.map(s => s.true_margin_pct);
      const dates = sls.map(s => s.date).sort();
      return {
        name,
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        highPrice: Math.max(...prices),
        lowPrice: Math.min(...prices),
        avgProfit: profits.reduce((a, b) => a + b, 0) / profits.length,
        avgMargin: margins.reduce((a, b) => a + b, 0) / margins.length,
        timesSold: sls.length,
        lastSold: dates[dates.length - 1],
      };
    });

  const allPlantStats: PlantStats[] = Object.entries(plantMap)
    .map(([name, sls]) => {
      const prices = sls.map(s => s.sale_price);
      const profits = sls.map(s => s.true_profit);
      const margins = sls.map(s => s.true_margin_pct);
      const dates = sls.map(s => s.date).sort();
      return {
        name,
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        highPrice: Math.max(...prices),
        lowPrice: Math.min(...prices),
        avgProfit: profits.reduce((a, b) => a + b, 0) / profits.length,
        avgMargin: margins.reduce((a, b) => a + b, 0) / margins.length,
        timesSold: sls.length,
        lastSold: dates[dates.length - 1],
      };
    });

  function handleSort(field: string) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  }

  const sortedPlants = [...plantStats]
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aVal = a[sortField as keyof PlantStats];
      const bVal = b[sortField as keyof PlantStats];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

  // Suggested bid calculation
  const bidPlantData = allPlantStats.find(p => p.name.toLowerCase() === bidPlant.toLowerCase());
  const suggestedBid = bidPlantData ? bidPlantData.avgPrice * (1 - bidBuffer / 100) : null;

  // Plants to Watch: avg sale > $100, not listed in last 60 days
  function daysSince(dateStr: string) {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  }

  const plantsToWatch = allPlantStats.filter(p => p.avgPrice > 100 && daysSince(p.lastSold) > 60);

  // Supplier ROI
  const supplierMap: Record<string, { batches: Batch[]; sales: Sale[] }> = {};
  batches.forEach(b => {
    if (!supplierMap[b.supplier]) supplierMap[b.supplier] = { batches: [], sales: [] };
    supplierMap[b.supplier].batches.push(b);
  });

  // Link sales to suppliers via batch_id
  sales.forEach(s => {
    if (s.batch_id) {
      const batch = batches.find(b => b.id === s.batch_id);
      if (batch && supplierMap[batch.supplier]) {
        supplierMap[batch.supplier].sales.push(s);
      }
    }
  });

  const supplierStats: SupplierStats[] = Object.entries(supplierMap).map(([name, data]) => {
    const totalInvested = data.batches.reduce((sum, b) => sum + b.total_cost, 0);
    const totalRevenue = data.sales.reduce((sum, s) => sum + s.sale_price, 0);
    const totalProfit = data.sales.reduce((sum, s) => sum + s.true_profit, 0);
    const avgMargin = data.sales.length > 0
      ? data.sales.reduce((sum, s) => sum + s.true_margin_pct, 0) / data.sales.length
      : 0;

    // Avg days from batch to sale
    let totalDays = 0;
    let dayCount = 0;
    data.sales.forEach(s => {
      if (s.batch_id) {
        const batch = data.batches.find(b => b.id === s.batch_id);
        if (batch) {
          const batchDate = new Date(batch.date).getTime();
          const saleDate = new Date(s.date).getTime();
          totalDays += Math.max(0, Math.floor((saleDate - batchDate) / (1000 * 60 * 60 * 24)));
          dayCount++;
        }
      }
    });
    const avgDaysToSale = dayCount > 0 ? totalDays / dayCount : 0;

    // Top 3 plants by profit
    const plantProfits: Record<string, number> = {};
    data.sales.forEach(s => {
      if (!plantProfits[s.plant_name]) plantProfits[s.plant_name] = 0;
      plantProfits[s.plant_name] += s.true_profit;
    });
    const topPlants = Object.entries(plantProfits)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, profit]) => ({ name, profit }));

    return {
      name,
      totalInvested,
      totalRevenue,
      totalProfit,
      avgMargin,
      avgDaysToSale,
      topPlants,
      plantCount: data.batches.reduce((sum, b) => sum + b.quantity, 0),
    };
  }).sort((a, b) => b.totalProfit - a.totalProfit);

  const topSupplier = supplierStats.length > 0 ? supplierStats[0] : null;
  const lowestMarginSupplier = supplierStats.length > 0
    ? supplierStats.reduce((low, s) => s.avgMargin < low.avgMargin ? s : low, supplierStats[0])
    : null;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <h1 className="font-heading text-3xl text-hot-pink mb-6">Pricing & Supplier Intelligence</h1>

        {/* Tab toggle */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('pricing')}
            className={`px-4 py-2 rounded-lg text-sm font-heading transition-colors cursor-pointer ${activeTab === 'pricing' ? 'bg-hot-pink text-white' : 'bg-deep-jungle/40 text-flamingo-blush border border-tropical-leaf/20'}`}>
            Pricing Intelligence
          </button>
          <button onClick={() => setActiveTab('supplier')}
            className={`px-4 py-2 rounded-lg text-sm font-heading transition-colors cursor-pointer ${activeTab === 'supplier' ? 'bg-hot-pink text-white' : 'bg-deep-jungle/40 text-flamingo-blush border border-tropical-leaf/20'}`}>
            Supplier ROI
          </button>
        </div>

        {loading ? (
          <div className="text-flamingo-blush animate-pulse font-body">Loading data...</div>
        ) : activeTab === 'pricing' ? (
          <>
            {/* Suggested Starting Bid */}
            <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 mb-6">
              <h2 className="font-heading text-xl text-white mb-4">Suggested Starting Bid</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm text-flamingo-blush mb-1 font-body">Plant Name</label>
                  <input value={bidPlant} onChange={e => setBidPlant(e.target.value)}
                    list="plant-names"
                    placeholder="Type or select a plant..."
                    className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
                  <datalist id="plant-names">
                    {allPlantStats.map(p => <option key={p.name} value={p.name} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm text-flamingo-blush mb-1 font-body">Buffer: {bidBuffer}%</label>
                  <input type="range" min="0" max="50" value={bidBuffer} onChange={e => setBidBuffer(parseInt(e.target.value))}
                    className="w-full accent-hot-pink" />
                </div>
                <div>
                  {bidPlantData ? (
                    <div className="bg-dark-bg/50 rounded-lg p-4">
                      <div className="text-xs text-flamingo-blush/60 font-body mb-1">
                        Average sale: ${bidPlantData.avgPrice.toFixed(2)} — {bidBuffer}% buffer
                      </div>
                      <div className="text-2xl text-tropical-leaf font-heading">
                        Suggested: ${suggestedBid?.toFixed(2)}
                      </div>
                    </div>
                  ) : bidPlant ? (
                    <div className="text-flamingo-blush/50 text-sm font-body">No sales data found for this plant.</div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="mb-4">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plants..."
                className="w-full max-w-md px-4 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body text-sm" />
            </div>

            {/* Plant Performance Table */}
            <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl overflow-hidden mb-6">
              <h2 className="font-heading text-lg text-white p-4 pb-0">Plant Performance (sold 2+ times)</h2>
              {sortedPlants.length === 0 ? (
                <div className="p-8 text-center text-flamingo-blush/50 font-body">No plants with multiple sales yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-tropical-leaf/20">
                        {[
                          { key: 'name', label: 'Plant' },
                          { key: 'avgPrice', label: 'Avg Price' },
                          { key: 'highPrice', label: 'High' },
                          { key: 'lowPrice', label: 'Low' },
                          { key: 'avgProfit', label: 'Avg Profit' },
                          { key: 'avgMargin', label: 'Avg Margin' },
                          { key: 'timesSold', label: 'Times Sold' },
                          { key: 'lastSold', label: 'Last Sold' },
                        ].map(col => (
                          <th key={col.key} onClick={() => handleSort(col.key)}
                            className="px-3 py-3 text-left text-flamingo-blush font-body cursor-pointer hover:text-hot-pink transition-colors whitespace-nowrap">
                            {col.label} {sortField === col.key && (sortDir === 'asc' ? '↑' : '↓')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPlants.map(p => (
                        <tr key={p.name} className="border-b border-tropical-leaf/10 hover:bg-tropical-leaf/5 transition-colors">
                          <td className="px-3 py-3 text-white font-body">{p.name}</td>
                          <td className="px-3 py-3 text-white font-body">${p.avgPrice.toFixed(2)}</td>
                          <td className="px-3 py-3 text-tropical-leaf font-body">${p.highPrice.toFixed(2)}</td>
                          <td className="px-3 py-3 text-flamingo-blush/70 font-body">${p.lowPrice.toFixed(2)}</td>
                          <td className={`px-3 py-3 font-heading ${p.avgProfit >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>
                            ${p.avgProfit.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-flamingo-blush/70 font-body">{p.avgMargin.toFixed(1)}%</td>
                          <td className="px-3 py-3 text-white font-body">{p.timesSold}</td>
                          <td className="px-3 py-3 text-flamingo-blush/70 font-body">{p.lastSold}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Plants to Watch */}
            <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6">
              <h2 className="font-heading text-xl text-white mb-4">Plants to Watch</h2>
              <p className="text-flamingo-blush/60 text-sm font-body mb-4">
                High-value plants (avg sale &gt; $100) not listed in 60+ days — prime restocking targets.
              </p>
              {plantsToWatch.length === 0 ? (
                <div className="bg-dark-bg/50 rounded-lg p-6 text-center">
                  <div className="text-3xl mb-2">🌿</div>
                  <p className="text-flamingo-blush/70 font-body text-sm">
                    All high-value plants are actively listed! Keep up the great work.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {plantsToWatch.map(p => (
                    <div key={p.name} className="bg-dark-bg/50 border border-tropical-leaf/10 rounded-lg p-4">
                      <h3 className="text-white font-heading text-lg mb-1">{p.name}</h3>
                      <div className="text-sm font-body text-flamingo-blush/70 space-y-1">
                        <div>Avg Price: <span className="text-hot-pink font-heading">${p.avgPrice.toFixed(2)}</span></div>
                        <div>Last Sold: <span className="text-white">{p.lastSold}</span> ({daysSince(p.lastSold)}d ago)</div>
                      </div>
                      <div className="mt-2 text-xs text-tropical-leaf font-body">Source Again</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Supplier ROI Tab */
          <>
            {supplierStats.length === 0 ? (
              <div className="p-8 text-center text-flamingo-blush/50 font-body">
                No supplier data yet. Add batches with supplier info and link sales to see ROI.
              </div>
            ) : (
              <div className="space-y-4">
                {supplierStats.map(supplier => {
                  const isTop = topSupplier?.name === supplier.name;
                  const isLow = lowestMarginSupplier?.name === supplier.name && supplierStats.length > 1;

                  return (
                    <div key={supplier.name}
                      className={`bg-deep-jungle/40 border rounded-xl p-6 ${
                        isTop ? 'border-yellow-500/50' : isLow ? 'border-red-500/30' : 'border-tropical-leaf/20'
                      }`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <h3 className="font-heading text-xl text-white">{supplier.name}</h3>
                          {isTop && <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400 font-body">Top Supplier 🦩</span>}
                          {isLow && <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 font-body">Lowest Margin</span>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                        <div className="bg-dark-bg/50 rounded-lg p-3 text-center">
                          <div className="text-warm-wood font-heading">${supplier.totalInvested.toFixed(2)}</div>
                          <div className="text-xs text-flamingo-blush/50 font-body">Invested</div>
                        </div>
                        <div className="bg-dark-bg/50 rounded-lg p-3 text-center">
                          <div className="text-hot-pink font-heading">${supplier.totalRevenue.toFixed(2)}</div>
                          <div className="text-xs text-flamingo-blush/50 font-body">Revenue</div>
                        </div>
                        <div className="bg-dark-bg/50 rounded-lg p-3 text-center">
                          <div className={`font-heading ${supplier.totalProfit >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>
                            ${supplier.totalProfit.toFixed(2)}
                          </div>
                          <div className="text-xs text-flamingo-blush/50 font-body">True Profit</div>
                        </div>
                        <div className="bg-dark-bg/50 rounded-lg p-3 text-center">
                          <div className="text-flamingo-blush font-heading">{supplier.avgMargin.toFixed(1)}%</div>
                          <div className="text-xs text-flamingo-blush/50 font-body">Avg Margin</div>
                        </div>
                        <div className="bg-dark-bg/50 rounded-lg p-3 text-center">
                          <div className="text-white font-heading">{supplier.avgDaysToSale.toFixed(0)}d</div>
                          <div className="text-xs text-flamingo-blush/50 font-body">Avg Days to Sale</div>
                        </div>
                        <div className="bg-dark-bg/50 rounded-lg p-3 text-center">
                          <div className="text-white font-heading">{supplier.plantCount}</div>
                          <div className="text-xs text-flamingo-blush/50 font-body">Plants Sourced</div>
                        </div>
                      </div>

                      {/* Top plants */}
                      {supplier.topPlants.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs text-flamingo-blush/60 font-body mb-1">Top 3 Plants by Profit:</div>
                          <div className="flex flex-wrap gap-2">
                            {supplier.topPlants.map(p => (
                              <span key={p.name} className="px-3 py-1 bg-tropical-leaf/10 rounded text-sm font-body text-white">
                                {p.name} <span className="text-tropical-leaf font-heading">${p.profit.toFixed(2)}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className={`text-xs font-body mt-2 ${isTop ? 'text-tropical-leaf' : isLow ? 'text-red-400/70' : 'text-flamingo-blush/50'}`}>
                        {isTop ? 'Invest more here' : isLow ? 'Review sourcing' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
