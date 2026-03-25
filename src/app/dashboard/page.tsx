'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { supabase, Sale } from '@/lib/supabase';

export default function DashboardPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales() {
    setLoading(true);
    const { data } = await supabase.from('sales').select('*').order('date', { ascending: false });
    if (data) setSales(data);
    setLoading(false);
  }

  // Filter by date range
  const filtered = sales.filter(s => {
    if (startDate && s.date < startDate) return false;
    if (endDate && s.date > endDate) return false;
    return true;
  });

  const totalRevenue = filtered.reduce((sum, s) => sum + s.sale_price, 0);
  const totalProfit = filtered.reduce((sum, s) => sum + s.true_profit, 0);
  const totalSales = filtered.length;
  const avgSalePrice = totalSales > 0 ? totalRevenue / totalSales : 0;
  const grossMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const totalRefunds = filtered.filter(s => s.refunded).reduce((sum, s) => sum + s.refund_amount, 0);

  // Top 10 plants by true profit
  const plantProfits: Record<string, { name: string; profit: number; count: number }> = {};
  filtered.forEach(s => {
    if (!plantProfits[s.plant_name]) plantProfits[s.plant_name] = { name: s.plant_name, profit: 0, count: 0 };
    plantProfits[s.plant_name].profit += s.true_profit;
    plantProfits[s.plant_name].count += 1;
  });
  const topPlants = Object.values(plantProfits).sort((a, b) => b.profit - a.profit).slice(0, 10);

  const cards = [
    { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}`, icon: '💰', color: 'text-tropical-leaf' },
    { label: 'True Profit', value: `$${totalProfit.toFixed(2)}`, icon: '📈', color: totalProfit >= 0 ? 'text-tropical-leaf' : 'text-red-400' },
    { label: 'Gross Margin', value: `${grossMargin.toFixed(1)}%`, icon: '📊', color: 'text-flamingo-blush' },
    { label: 'Total Sales', value: `${totalSales}`, icon: '🛒', color: 'text-white' },
    { label: 'Avg Sale Price', value: `$${avgSalePrice.toFixed(2)}`, icon: '🏷️', color: 'text-flamingo-blush' },
    { label: 'Refunds Issued', value: `$${totalRefunds.toFixed(2)}`, icon: '↩️', color: totalRefunds > 0 ? 'text-red-400' : 'text-flamingo-blush' },
  ];

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <h1 className="font-heading text-4xl md:text-5xl text-hot-pink mb-2">
          Welcome back to the Jungle 🌿🦩
        </h1>
        <p className="text-flamingo-blush/70 font-body mb-6">
          Your real-time business intelligence dashboard
        </p>

        {/* Date Range Filter */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-sm text-flamingo-blush font-body">Filter:</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-1.5 bg-dark-bg border border-deep-jungle rounded-lg text-white text-sm font-body focus:outline-none focus:border-hot-pink" />
          <span className="text-flamingo-blush/50">to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-1.5 bg-dark-bg border border-deep-jungle rounded-lg text-white text-sm font-body focus:outline-none focus:border-hot-pink" />
          {(startDate || endDate) && (
            <button onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-xs text-hot-pink hover:text-flamingo-blush font-body cursor-pointer">
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-flamingo-blush animate-pulse font-body">Loading dashboard data...</div>
        ) : (
          <>
            {/* Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {cards.map(card => (
                <div key={card.label} className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-4 text-center hover:border-hot-pink/30 transition-colors">
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <div className={`font-heading text-xl ${card.color}`}>{card.value}</div>
                  <div className="text-xs text-flamingo-blush/60 font-body mt-1">{card.label}</div>
                </div>
              ))}
            </div>

            {/* Top 10 Plants by Profit */}
            <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6">
              <h2 className="font-heading text-xl text-white mb-4">Top 10 Plants by True Profit</h2>
              {topPlants.length === 0 ? (
                <p className="text-flamingo-blush/50 font-body text-sm">No sales data yet. Start logging sales to see your top performers!</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-tropical-leaf/20">
                        <th className="px-4 py-3 text-left text-flamingo-blush font-body">#</th>
                        <th className="px-4 py-3 text-left text-flamingo-blush font-body">Plant Name</th>
                        <th className="px-4 py-3 text-left text-flamingo-blush font-body">Times Sold</th>
                        <th className="px-4 py-3 text-left text-flamingo-blush font-body">True Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPlants.map((plant, i) => (
                        <tr key={plant.name} className="border-b border-tropical-leaf/10 hover:bg-tropical-leaf/5 transition-colors">
                          <td className="px-4 py-3 text-flamingo-blush/50 font-body">{i + 1}</td>
                          <td className="px-4 py-3 text-white font-body">{plant.name}</td>
                          <td className="px-4 py-3 text-flamingo-blush/70 font-body">{plant.count}</td>
                          <td className={`px-4 py-3 font-heading ${plant.profit >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>
                            ${plant.profit.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
