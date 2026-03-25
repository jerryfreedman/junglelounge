'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { supabase, Batch, Sale } from '@/lib/supabase';
import CSVImportModal from '@/components/CSVImportModal';

const emptySale = {
  batch_id: null as string | null, plant_name: '', buyer_name: '', sale_price: 0,
  cost_per_plant: 0, shipping_cost: 0, shipping_covered_by_us: false,
  palmstreet_fee_amount: 0, refunded: false, refund_amount: 0,
  true_profit: 0, true_margin_pct: 0,
  date: new Date().toISOString().split('T')[0], notes: '', stream_id: null as string | null
};

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [form, setForm] = useState({ ...emptySale });
  const [feePct, setFeePct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [refundModal, setRefundModal] = useState<{ sale: Sale | null; amount: string }>({ sale: null, amount: '' });
  const [showImport, setShowImport] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [salesRes, batchRes, settingsRes] = await Promise.all([
      supabase.from('sales').select('*').order(sortField, { ascending: sortDir === 'asc' }),
      supabase.from('batches').select('*').order('name'),
      supabase.from('settings').select('*').limit(1).single()
    ]);
    if (salesRes.data) setSales(salesRes.data);
    if (batchRes.data) setBatches(batchRes.data);
    if (settingsRes.data) setFeePct(settingsRes.data.palmstreet_fee_pct || 0);
    setLoading(false);
  }, [sortField, sortDir]);

  useEffect(() => { loadData(); }, [loadData]);

  // Live profit calculation
  const liveShipping = form.shipping_covered_by_us ? form.shipping_cost : 0;
  const liveFee = form.sale_price * (feePct / 100);
  const liveProfit = form.sale_price - form.cost_per_plant - liveShipping - liveFee;
  const liveMargin = form.sale_price > 0 ? (liveProfit / form.sale_price) * 100 : 0;

  function handleBatchSelect(batchId: string) {
    const batch = batches.find(b => b.id === batchId);
    setForm(f => ({
      ...f,
      batch_id: batchId || null,
      cost_per_plant: batch ? batch.cost_per_plant : f.cost_per_plant
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      palmstreet_fee_amount: parseFloat(liveFee.toFixed(2)),
      true_profit: parseFloat(liveProfit.toFixed(2)),
      true_margin_pct: parseFloat(liveMargin.toFixed(2))
    };
    await supabase.from('sales').insert(payload);
    setForm({ ...emptySale, date: new Date().toISOString().split('T')[0] });
    loadData();
  }

  async function handleRefund() {
    if (!refundModal.sale) return;
    const amount = parseFloat(refundModal.amount) || 0;
    const updatedProfit = refundModal.sale.true_profit - amount;
    const updatedMargin = refundModal.sale.sale_price > 0 ? (updatedProfit / refundModal.sale.sale_price) * 100 : 0;

    await supabase.from('sales').update({
      refunded: true, refund_amount: amount,
      true_profit: parseFloat(updatedProfit.toFixed(2)),
      true_margin_pct: parseFloat(updatedMargin.toFixed(2))
    }).eq('id', refundModal.sale.id);

    setRefundModal({ sale: null, amount: '' });
    loadData();
  }

  function handleSort(field: string) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  const filteredSales = sales.filter(s =>
    s.plant_name.toLowerCase().includes(search.toLowerCase()) ||
    s.buyer_name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleExportCSV() {
    // Fetch all data fresh
    const [salesRes, batchRes, settingsRes] = await Promise.all([
      supabase.from('sales').select('*').order('date', { ascending: false }),
      supabase.from('batches').select('*').order('name'),
      supabase.from('settings').select('*').limit(1).single()
    ]);
    const allSales = salesRes.data || [];
    const allBatches = batchRes.data || [];
    const fee = settingsRes.data?.palmstreet_fee_pct || 0;

    let csv = '--- SALES ---\n';
    csv += 'Plant Name,Buyer Name,Sale Price,Cost Per Plant,Shipping Cost,Shipping Covered,Palmstreet Fee,True Profit,Margin %,Refunded,Refund Amount,Date,Notes\n';
    allSales.forEach(s => {
      csv += `"${s.plant_name}","${s.buyer_name}",${s.sale_price},${s.cost_per_plant},${s.shipping_cost},${s.shipping_covered_by_us},${s.palmstreet_fee_amount},${s.true_profit},${s.true_margin_pct},${s.refunded},${s.refund_amount},"${s.date}","${(s.notes || '').replace(/"/g, '""')}"\n`;
    });

    csv += '\n--- BATCHES ---\n';
    csv += 'Plant Name,Supplier,Quantity,Total Cost,Cost Per Plant,Reorder Threshold,Date,Notes\n';
    allBatches.forEach(b => {
      csv += `"${b.name}","${b.supplier}",${b.quantity},${b.total_cost},${b.cost_per_plant},${b.reorder_threshold},"${b.date}","${(b.notes || '').replace(/"/g, '""')}"\n`;
    });

    csv += '\n--- P&L SUMMARY ---\n';
    const totalRevenue = allSales.reduce((sum, s) => sum + s.sale_price, 0);
    const totalProfit = allSales.reduce((sum, s) => sum + s.true_profit, 0);
    const totalRefunds = allSales.filter(s => s.refunded).reduce((sum, s) => sum + s.refund_amount, 0);
    const totalCost = allSales.reduce((sum, s) => sum + s.cost_per_plant, 0);
    const totalFees = allSales.reduce((sum, s) => sum + s.palmstreet_fee_amount, 0);
    const totalShipping = allSales.filter(s => s.shipping_covered_by_us).reduce((sum, s) => sum + s.shipping_cost, 0);
    csv += `Total Revenue,$${totalRevenue.toFixed(2)}\n`;
    csv += `Total Cost of Goods,$${totalCost.toFixed(2)}\n`;
    csv += `Total Palmstreet Fees (${fee}%),$${totalFees.toFixed(2)}\n`;
    csv += `Total Shipping Covered,$${totalShipping.toFixed(2)}\n`;
    csv += `Total Refunds,$${totalRefunds.toFixed(2)}\n`;
    csv += `True Net Profit,$${totalProfit.toFixed(2)}\n`;
    csv += `Gross Margin,${totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%\n`;
    csv += `Total Sales,${allSales.length}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jungle-lounge-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="font-heading text-3xl text-hot-pink">Sales</h1>
          <div className="flex gap-3">
            <button onClick={() => setShowImport(true)}
              className="px-4 py-2 bg-tropical-leaf/20 hover:bg-tropical-leaf/30 border border-tropical-leaf/40 text-tropical-leaf font-heading text-sm rounded-lg transition-colors cursor-pointer">
              Import from Palmstreet
            </button>
            <button onClick={handleExportCSV}
              className="px-4 py-2 bg-warm-wood/20 hover:bg-warm-wood/30 border border-warm-wood/40 text-warm-wood font-heading text-sm rounded-lg transition-colors cursor-pointer">
              Export CSV
            </button>
          </div>
        </div>

        {/* Add Sale Form */}
        <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 mb-6">
          <h2 className="font-heading text-xl text-white mb-4">Log a Sale</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-flamingo-blush mb-1 font-body">Plant Name *</label>
              <input required value={form.plant_name} onChange={e => setForm(f => ({ ...f, plant_name: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
            </div>
            <div>
              <label className="block text-sm text-flamingo-blush mb-1 font-body">Buyer Name *</label>
              <input required value={form.buyer_name} onChange={e => setForm(f => ({ ...f, buyer_name: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
            </div>
            <div>
              <label className="block text-sm text-flamingo-blush mb-1 font-body">Sale Price ($) *</label>
              <input type="number" required min="0" step="0.01" value={form.sale_price || ''} onChange={e => setForm(f => ({ ...f, sale_price: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
            </div>
            <div>
              <label className="block text-sm text-flamingo-blush mb-1 font-body">Link to Batch</label>
              <select value={form.batch_id || ''} onChange={e => handleBatchSelect(e.target.value)}
                className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm">
                <option value="">No batch linked</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} (${b.cost_per_plant.toFixed(2)}/plant)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-flamingo-blush mb-1 font-body">Cost Per Plant ($)</label>
              <input type="number" min="0" step="0.01" value={form.cost_per_plant || ''} onChange={e => setForm(f => ({ ...f, cost_per_plant: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
            </div>
            <div>
              <label className="block text-sm text-flamingo-blush mb-1 font-body">Shipping Cost ($)</label>
              <input type="number" min="0" step="0.01" value={form.shipping_cost || ''} onChange={e => setForm(f => ({ ...f, shipping_cost: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={form.shipping_covered_by_us}
                  onChange={e => setForm(f => ({ ...f, shipping_covered_by_us: e.target.checked }))}
                  className="sr-only peer" />
                <div className="w-11 h-6 bg-dark-bg border border-deep-jungle rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-flamingo-blush after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hot-pink/30 peer-checked:after:bg-hot-pink"></div>
              </label>
              <span className="text-sm text-flamingo-blush font-body">We covered shipping</span>
            </div>
            <div>
              <label className="block text-sm text-flamingo-blush mb-1 font-body">Date *</label>
              <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-sm text-flamingo-blush mb-1 font-body">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
            </div>

            {/* Live Profit Preview */}
            <div className="lg:col-span-3 bg-dark-bg/50 rounded-lg p-4 border border-tropical-leaf/10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-xs text-flamingo-blush/50 font-body">Palmstreet Fee ({feePct}%)</div>
                  <div className="text-hot-pink font-heading">-${liveFee.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-flamingo-blush/50 font-body">Shipping Deducted</div>
                  <div className="text-hot-pink font-heading">-${liveShipping.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-flamingo-blush/50 font-body">True Profit</div>
                  <div className={`font-heading ${liveProfit >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>
                    ${liveProfit.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-flamingo-blush/50 font-body">Margin</div>
                  <div className={`font-heading ${liveMargin >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>
                    {liveMargin.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            <div>
              <button type="submit" className="px-6 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading rounded-lg transition-colors cursor-pointer">
                Log Sale
              </button>
            </div>
          </form>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sales by plant or buyer..."
            className="w-full max-w-md px-4 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body text-sm" />
        </div>

        {/* Sales Table */}
        <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-flamingo-blush animate-pulse">Loading sales...</div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center text-flamingo-blush/50 font-body">
              {search ? 'No matching sales found.' : 'No sales yet. Log your first sale above!'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-tropical-leaf/20">
                    {[
                      { key: 'plant_name', label: 'Plant' },
                      { key: 'buyer_name', label: 'Buyer' },
                      { key: 'sale_price', label: 'Sale Price' },
                      { key: 'cost_per_plant', label: 'Cost' },
                      { key: 'true_profit', label: 'True Profit' },
                      { key: 'true_margin_pct', label: 'Margin' },
                      { key: 'date', label: 'Date' },
                    ].map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)}
                        className="px-3 py-3 text-left text-flamingo-blush font-body cursor-pointer hover:text-hot-pink transition-colors whitespace-nowrap">
                        {col.label} {sortField === col.key && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-left text-flamingo-blush font-body">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map(sale => (
                    <tr key={sale.id} className={`border-b border-tropical-leaf/10 hover:bg-tropical-leaf/5 transition-colors ${sale.refunded ? 'bg-red-500/5' : ''}`}>
                      <td className="px-3 py-3 text-white font-body">{sale.plant_name}</td>
                      <td className="px-3 py-3 text-flamingo-blush/70 font-body">{sale.buyer_name}</td>
                      <td className="px-3 py-3 text-white font-body">${sale.sale_price.toFixed(2)}</td>
                      <td className="px-3 py-3 text-flamingo-blush/70 font-body">${sale.cost_per_plant.toFixed(2)}</td>
                      <td className={`px-3 py-3 font-heading ${sale.true_profit >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>
                        ${sale.true_profit.toFixed(2)}
                        {sale.refunded && <span className="ml-1 text-xs text-red-400">(refunded)</span>}
                      </td>
                      <td className="px-3 py-3 text-flamingo-blush/70 font-body">{sale.true_margin_pct.toFixed(1)}%</td>
                      <td className="px-3 py-3 text-flamingo-blush/70 font-body">{sale.date}</td>
                      <td className="px-3 py-3">
                        {!sale.refunded && (
                          <button onClick={() => setRefundModal({ sale, amount: '' })}
                            className="text-red-400 hover:text-red-300 text-xs font-body cursor-pointer whitespace-nowrap">
                            Mark Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Refund Modal */}
        {refundModal.sale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-deep-jungle border border-tropical-leaf/30 rounded-xl p-6 w-full max-w-md">
              <h3 className="font-heading text-xl text-hot-pink mb-4">Log Refund</h3>
              <p className="text-flamingo-blush text-sm font-body mb-4">
                Refunding <strong>{refundModal.sale.plant_name}</strong> sold to <strong>{refundModal.sale.buyer_name}</strong> for ${refundModal.sale.sale_price.toFixed(2)}
              </p>
              <div className="mb-4">
                <label className="block text-sm text-flamingo-blush mb-1 font-body">Refund Amount ($)</label>
                <input type="number" min="0" step="0.01" value={refundModal.amount}
                  onChange={e => setRefundModal(m => ({ ...m, amount: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm"
                  autoFocus />
              </div>
              <div className="flex gap-3">
                <button onClick={handleRefund}
                  className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white font-heading rounded-lg transition-colors cursor-pointer">
                  Confirm Refund
                </button>
                <button onClick={() => setRefundModal({ sale: null, amount: '' })}
                  className="px-4 py-2 bg-warm-wood/30 hover:bg-warm-wood/50 text-white font-body rounded-lg transition-colors cursor-pointer text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </div>
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
