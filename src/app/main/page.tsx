'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { supabase, Sale, Batch, ensureSettings } from '@/lib/supabase';
import CSVImportModal from '@/components/CSVImportModal';

export default function MainPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [feePct, setFeePct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);

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

  async function handleExportAll() {
    setExporting(true);
    try {
      const [salesRes, batchRes, custRes] = await Promise.all([
        supabase.from('sales').select('*').order('date', { ascending: false }),
        supabase.from('batches').select('*').order('date', { ascending: false }),
        supabase.from('customers').select('*').order('total_spent', { ascending: false }),
      ]);

      let csv = '=== JUNGLE LOUNGE INTEL — FULL BACKUP ===\n';
      csv += `Export Date: ${new Date().toISOString().split('T')[0]}\n\n`;

      csv += '--- SALES ---\n';
      csv += 'Plant,Buyer,Sale Price,Cost,Shipping,Fee,True Profit,Margin %,Date,Refunded,Refund Amount\n';
      (salesRes.data || []).forEach((s: Sale) => {
        csv += `"${s.plant_name}","${s.buyer_name}",${s.sale_price},${s.cost_per_plant},${s.shipping_cost},${s.palmstreet_fee_amount},${s.true_profit},${s.true_margin_pct},"${s.date}",${s.refunded},${s.refund_amount}\n`;
      });

      csv += '\n--- BATCHES ---\n';
      csv += 'Plant,Supplier,Quantity,Total Cost,Cost Per Plant,Date\n';
      (batchRes.data || []).forEach((b: Batch) => {
        csv += `"${b.name}","${b.supplier}",${b.quantity},${b.total_cost},${b.cost_per_plant},"${b.date}"\n`;
      });

      csv += '\n--- CUSTOMERS ---\n';
      csv += 'Name,Total Spent,Orders,Avg Order,First Purchase,Last Purchase\n';
      interface CustomerRow { name: string; total_spent: number; total_orders: number; average_order_value: number; first_purchase_date: string; last_purchase_date: string }
      (custRes.data || []).forEach((c: CustomerRow) => {
        csv += `"${c.name}",${c.total_spent},${c.total_orders},${c.average_order_value},"${c.first_purchase_date}","${c.last_purchase_date}"\n`;
      });

      // P&L summary
      const totalRevenue = (salesRes.data || []).reduce((sum: number, s: Sale) => sum + s.sale_price, 0);
      const totalProfit = (salesRes.data || []).reduce((sum: number, s: Sale) => sum + s.true_profit, 0);
      const totalCost = (batchRes.data || []).reduce((sum: number, b: Batch) => sum + b.total_cost, 0);
      csv += '\n--- P&L SUMMARY ---\n';
      csv += `Total Revenue,${totalRevenue.toFixed(2)}\n`;
      csv += `Total Costs,${totalCost.toFixed(2)}\n`;
      csv += `Total Profit,${totalProfit.toFixed(2)}\n`;
      csv += `Margin %,${totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0'}\n`;

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jungle-lounge-backup-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
    setExporting(false);
  }

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
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl text-hot-pink mb-1">
              Welcome back to the Jungle
            </h1>
            <p className="text-flamingo-blush/60 font-body text-sm">
              Week of {week.start} to {week.end}
            </p>
          </div>
          <button
            onClick={handleExportAll}
            disabled={exporting}
            className="px-4 py-2 bg-tropical-leaf/20 border border-tropical-leaf/30 hover:bg-tropical-leaf/30 text-tropical-leaf font-body text-sm rounded-lg transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2"
          >
            {exporting ? (
              <>
                <span className="animate-spin">⏳</span>
                Exporting...
              </>
            ) : (
              <>
                <span>📥</span>
                Download Backup
              </>
            )}
          </button>
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
            {/* Weekly Cards — clickable → Sales page */}
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

            {/* All-Time Summary Row — clickable */}
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

            {/* Recent Sales Preview */}
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
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Plant</th>
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
