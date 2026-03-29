'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { supabase, Batch, Sale, Stream, ensureSettings } from '@/lib/supabase';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type ChartType = 'line' | 'bar';
type TimePeriod = 'daily' | 'weekly' | 'monthly';

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [feePct, setFeePct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Chart controls
  const [chartType, setChartType] = useState<ChartType>('line');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('weekly');

  // Log sale form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    batch_id: null as string | null, plant_name: '', buyer_name: '', sale_price: 0,
    cost_per_plant: 0, shipping_cost: 0, shipping_covered_by_us: false,
    date: new Date().toISOString().split('T')[0], notes: '', stream_id: null as string | null
  });

  // Refund modal
  const [refundModal, setRefundModal] = useState<{ sale: Sale | null; amount: string }>({ sale: null, amount: '' });
  const [error, setError] = useState<string | null>(null);

  // Stream creation
  const [streams, setStreams] = useState<Stream[]>([]);
  const [showStreamForm, setShowStreamForm] = useState(false);
  const [streamForm, setStreamForm] = useState({
    name: '', date: new Date().toISOString().split('T')[0], viewer_count: '' as string, notes: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [salesRes, batchRes, streamRes, settings] = await Promise.all([
        supabase.from('sales').select('*').order('date', { ascending: false }),
        supabase.from('batches').select('*').order('name'),
        supabase.from('streams').select('*').order('date', { ascending: false }),
        ensureSettings(),
      ]);
      if (salesRes.error) throw new Error(`Sales load failed: ${salesRes.error.message}`);
      if (batchRes.error) throw new Error(`Batches load failed: ${batchRes.error.message}`);
      setSales(salesRes.data || []);
      setBatches(batchRes.data || []);
      setStreams(streamRes.data || []);
      setFeePct(settings.palmstreet_fee_pct || 0);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Live profit calculation for form
  const liveShipping = form.shipping_covered_by_us ? form.shipping_cost : 0;
  const liveFee = form.sale_price * (feePct / 100);
  const liveProfit = form.sale_price - form.cost_per_plant - liveShipping - liveFee;

  function handleBatchSelect(batchId: string) {
    const batch = batches.find(b => b.id === batchId);
    setForm(f => ({ ...f, batch_id: batchId || null, cost_per_plant: batch ? batch.cost_per_plant : f.cost_per_plant }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const liveMargin = form.sale_price > 0 ? (liveProfit / form.sale_price) * 100 : 0;
      const { error: insertErr } = await supabase.from('sales').insert({
        ...form, palmstreet_fee_amount: parseFloat(liveFee.toFixed(2)),
        true_profit: parseFloat(liveProfit.toFixed(2)), true_margin_pct: parseFloat(liveMargin.toFixed(2)),
        refunded: false, refund_amount: 0,
      });
      if (insertErr) throw new Error(`Failed to save sale: ${insertErr.message}`);
      setForm({ batch_id: null, plant_name: '', buyer_name: '', sale_price: 0, cost_per_plant: 0, shipping_cost: 0, shipping_covered_by_us: false, date: new Date().toISOString().split('T')[0], notes: '', stream_id: null });
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  }

  async function handleRefund() {
    if (!refundModal.sale) return;
    setError(null);
    try {
      // Double-refund guard: re-check from DB before applying
      const { data: freshSale, error: checkErr } = await supabase
        .from('sales').select('refunded').eq('id', refundModal.sale.id).single();
      if (checkErr) throw new Error(`Refund check failed: ${checkErr.message}`);
      if (freshSale?.refunded) {
        setError('This sale has already been refunded.');
        setRefundModal({ sale: null, amount: '' });
        return;
      }

      const amount = parseFloat(refundModal.amount) || 0;
      const updatedProfit = refundModal.sale.true_profit - amount;
      const updatedMargin = refundModal.sale.sale_price > 0 ? (updatedProfit / refundModal.sale.sale_price) * 100 : 0;
      const { error: updateErr } = await supabase.from('sales').update({
        refunded: true, refund_amount: amount,
        true_profit: parseFloat(updatedProfit.toFixed(2)),
        true_margin_pct: parseFloat(updatedMargin.toFixed(2))
      }).eq('id', refundModal.sale.id);
      if (updateErr) throw new Error(`Refund failed: ${updateErr.message}`);
      setRefundModal({ sale: null, amount: '' });
      loadData();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  }

  async function handleDeleteSale(id: string) {
    if (!confirm('Delete this sale? This cannot be undone.')) return;
    setError(null);
    try {
      const { error: delErr } = await supabase.from('sales').delete().eq('id', id);
      if (delErr) throw new Error(`Failed to delete sale: ${delErr.message}`);
      loadData();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  }

  async function handleCreateStream(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      // Calculate stream stats from sales matching this date
      const dateSales = sales.filter(s => s.date === streamForm.date);
      const totalRevenue = dateSales.reduce((sum, s) => sum + s.sale_price, 0);
      const totalCost = dateSales.reduce((sum, s) => sum + s.cost_per_plant, 0);
      const trueProfit = dateSales.reduce((sum, s) => sum + s.true_profit, 0);
      const trueMargin = totalRevenue > 0 ? (trueProfit / totalRevenue) * 100 : 0;
      const avgSalePrice = dateSales.length > 0 ? totalRevenue / dateSales.length : 0;

      const { data: newStream, error: insertErr } = await supabase.from('streams').insert({
        name: streamForm.name,
        date: streamForm.date,
        notes: streamForm.notes,
        viewer_count: streamForm.viewer_count ? parseInt(streamForm.viewer_count) : null,
        total_revenue: parseFloat(totalRevenue.toFixed(2)),
        total_cost: parseFloat(totalCost.toFixed(2)),
        true_profit: parseFloat(trueProfit.toFixed(2)),
        true_margin_pct: parseFloat(trueMargin.toFixed(2)),
        total_plants_listed: dateSales.length,
        total_plants_sold: dateSales.length,
        sell_through_rate: 100,
        average_sale_price: parseFloat(avgSalePrice.toFixed(2)),
      }).select().single();

      if (insertErr) throw new Error(`Failed to create stream: ${insertErr.message}`);

      // Auto-link sales from that date to this stream
      if (newStream && dateSales.length > 0) {
        const saleIds = dateSales.filter(s => !s.stream_id).map(s => s.id);
        if (saleIds.length > 0) {
          await supabase.from('sales').update({ stream_id: newStream.id }).in('id', saleIds);
        }
      }

      setStreamForm({ name: '', date: new Date().toISOString().split('T')[0], viewer_count: '', notes: '' });
      setShowStreamForm(false);
      loadData();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  }

  function handleSort(field: string) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  }

  // Client-side sort + filter (no re-query needed)
  const sortedSales = [...sales].sort((a, b) => {
    const aVal = (a as unknown as Record<string, unknown>)[sortField];
    const bVal = (b as unknown as Record<string, unknown>)[sortField];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    const aStr = String(aVal || '');
    const bStr = String(bVal || '');
    return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  });

  const filteredSales = sortedSales.filter(s =>
    s.plant_name.toLowerCase().includes(search.toLowerCase()) ||
    s.buyer_name.toLowerCase().includes(search.toLowerCase())
  );

  // Chart data aggregation
  function getChartData() {
    if (sales.length === 0) return [];
    const sorted = [...sales].sort((a, b) => a.date.localeCompare(b.date));
    const groups: Record<string, { gross: number; net: number }> = {};

    sorted.forEach(s => {
      let key = s.date;
      if (timePeriod === 'weekly') {
        const d = new Date(s.date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        key = monday.toISOString().split('T')[0];
      } else if (timePeriod === 'monthly') {
        key = s.date.slice(0, 7);
      }
      if (!groups[key]) groups[key] = { gross: 0, net: 0 };
      groups[key].gross += s.sale_price;
      groups[key].net += s.true_profit;
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([label, data]) => ({
      label: timePeriod === 'monthly' ? label : label.slice(5), // trim year for readability
      gross: parseFloat(data.gross.toFixed(2)),
      net: parseFloat(data.net.toFixed(2)),
    }));
  }

  const chartData = getChartData();

  // Sales by plant type
  const plantMap: Record<string, { sold: number; gross: number; net: number }> = {};
  sales.forEach(s => {
    if (!plantMap[s.plant_name]) plantMap[s.plant_name] = { sold: 0, gross: 0, net: 0 };
    plantMap[s.plant_name].sold += 1;
    plantMap[s.plant_name].gross += s.sale_price;
    plantMap[s.plant_name].net += s.true_profit;
  });
  const plantStats = Object.entries(plantMap).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.gross - a.gross);

  // Export CSV
  async function handleExportCSV() {
    let csv = 'Plant Name,Buyer Name,Sale Price,Cost,Shipping,True Profit,Margin %,Date,Refunded\n';
    sales.forEach(s => {
      csv += `"${s.plant_name}","${s.buyer_name}",${s.sale_price},${s.cost_per_plant},${s.shipping_cost},${s.true_profit},${s.true_margin_pct},"${s.date}",${s.refunded}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jungle-lounge-sales-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="font-heading text-3xl text-hot-pink">Sales</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg transition-colors cursor-pointer">
              {showForm ? 'Cancel' : '+ Log Sale'}
            </button>
            <button onClick={() => setShowStreamForm(!showStreamForm)}
              className="px-4 py-2 bg-tropical-leaf/20 hover:bg-tropical-leaf/30 border border-tropical-leaf/40 text-tropical-leaf font-body text-sm rounded-lg transition-colors cursor-pointer">
              {showStreamForm ? 'Cancel' : '+ Stream'}
            </button>
            <button onClick={handleExportCSV}
              className="px-4 py-2 bg-warm-wood/20 hover:bg-warm-wood/30 border border-warm-wood/40 text-warm-wood font-body text-sm rounded-lg transition-colors cursor-pointer">
              Export CSV
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400 font-body text-sm">⚠️ {error}</p>
          </div>
        )}

        {/* Stream Creation Form (collapsible) */}
        {showStreamForm && (
          <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 mb-6">
            <h2 className="font-heading text-lg text-white mb-4">Create a Stream</h2>
            <p className="text-flamingo-blush/50 font-body text-xs mb-4">
              Sales matching the stream date will be auto-linked.
            </p>
            <form onSubmit={handleCreateStream} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Stream Name *</label>
                <input required value={streamForm.name}
                  onChange={e => setStreamForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. March 28 Stream"
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Date *</label>
                <input type="date" required value={streamForm.date}
                  onChange={e => setStreamForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Viewer Count</label>
                <input type="number" min="0" value={streamForm.viewer_count}
                  onChange={e => setStreamForm(f => ({ ...f, viewer_count: e.target.value }))}
                  placeholder="Optional"
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div className="flex items-end">
                <button type="submit"
                  className="px-6 py-2 bg-tropical-leaf hover:bg-tropical-leaf/80 text-white font-heading text-sm rounded-lg transition-colors cursor-pointer">
                  Create Stream
                </button>
              </div>
            </form>
            {/* Show how many sales match this date */}
            {streamForm.date && (
              <p className="text-flamingo-blush/50 font-body text-xs mt-3">
                {sales.filter(s => s.date === streamForm.date).length} sale(s) on {streamForm.date} will be linked to this stream
              </p>
            )}
          </div>
        )}

        {/* Log Sale Form (collapsible) */}
        {showForm && (
          <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 mb-6">
            <h2 className="font-heading text-lg text-white mb-4">Log a Sale</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Plant Name *</label>
                <input required value={form.plant_name} onChange={e => setForm(f => ({ ...f, plant_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Buyer Name *</label>
                <input required value={form.buyer_name} onChange={e => setForm(f => ({ ...f, buyer_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Sale Price ($) *</label>
                <input type="number" required min="0" step="0.01" value={form.sale_price || ''} onChange={e => setForm(f => ({ ...f, sale_price: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Link to Batch</label>
                <select value={form.batch_id || ''} onChange={e => handleBatchSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm">
                  <option value="">None</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.name} (${b.cost_per_plant.toFixed(2)})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Cost Per Plant ($)</label>
                <input type="number" min="0" step="0.01" value={form.cost_per_plant || ''} onChange={e => setForm(f => ({ ...f, cost_per_plant: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Shipping ($)</label>
                <input type="number" min="0" step="0.01" value={form.shipping_cost || ''} onChange={e => setForm(f => ({ ...f, shipping_cost: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={form.shipping_covered_by_us}
                    onChange={e => setForm(f => ({ ...f, shipping_covered_by_us: e.target.checked }))} className="sr-only peer" />
                  <div className="w-10 h-5 bg-dark-bg border border-deep-jungle rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-flamingo-blush after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-hot-pink/30 peer-checked:after:bg-hot-pink"></div>
                </label>
                <span className="text-sm text-flamingo-blush/70 font-body">We covered shipping</span>
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Date *</label>
                <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Link to Stream</label>
                <select value={form.stream_id || ''} onChange={e => setForm(f => ({ ...f, stream_id: e.target.value || null }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm">
                  <option value="">None</option>
                  {streams.map(s => <option key={s.id} value={s.id}>{s.name} ({s.date})</option>)}
                </select>
              </div>
              {/* Live Profit Preview */}
              <div className="lg:col-span-3 bg-dark-bg/40 rounded-lg p-3 flex flex-wrap items-center gap-6 text-sm">
                <span className="text-flamingo-blush/50 font-body">Fee ({feePct}%): <span className="text-hot-pink">-${liveFee.toFixed(2)}</span></span>
                <span className="text-flamingo-blush/50 font-body">Shipping: <span className="text-hot-pink">-${liveShipping.toFixed(2)}</span></span>
                <span className="font-body">Profit: <span className={`font-heading ${liveProfit >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>${liveProfit.toFixed(2)}</span></span>
              </div>
              <div>
                <button type="submit" className="px-6 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg transition-colors cursor-pointer">
                  Log Sale
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Sales Chart */}
        {!loading && chartData.length > 0 && (
          <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-heading text-lg text-white">Sales Overview</h2>
              <div className="flex gap-2">
                {/* Chart type toggle */}
                <div className="flex bg-dark-bg/50 rounded-lg overflow-hidden">
                  <button onClick={() => setChartType('line')}
                    className={`px-3 py-1.5 text-xs font-body cursor-pointer ${chartType === 'line' ? 'bg-hot-pink text-white' : 'text-flamingo-blush/60 hover:text-white'}`}>
                    Line
                  </button>
                  <button onClick={() => setChartType('bar')}
                    className={`px-3 py-1.5 text-xs font-body cursor-pointer ${chartType === 'bar' ? 'bg-hot-pink text-white' : 'text-flamingo-blush/60 hover:text-white'}`}>
                    Bar
                  </button>
                </div>
                {/* Time period toggle */}
                <div className="flex bg-dark-bg/50 rounded-lg overflow-hidden">
                  {(['daily', 'weekly', 'monthly'] as TimePeriod[]).map(p => (
                    <button key={p} onClick={() => setTimePeriod(p)}
                      className={`px-3 py-1.5 text-xs font-body capitalize cursor-pointer ${timePeriod === p ? 'bg-hot-pink text-white' : 'text-flamingo-blush/60 hover:text-white'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1A3D1F" />
                    <XAxis dataKey="label" stroke="#F4849A" fontSize={11} />
                    <YAxis stroke="#F4849A" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#0F2410', border: '1px solid #4A8C3F', borderRadius: '8px', fontFamily: 'Inter' }} />
                    <Line type="monotone" dataKey="gross" stroke="#F4607A" strokeWidth={2} name="Gross $" dot={{ fill: '#F4607A', r: 3 }} />
                    <Line type="monotone" dataKey="net" stroke="#4A8C3F" strokeWidth={2} name="Net $" dot={{ fill: '#4A8C3F', r: 3 }} />
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1A3D1F" />
                    <XAxis dataKey="label" stroke="#F4849A" fontSize={11} />
                    <YAxis stroke="#F4849A" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#0F2410', border: '1px solid #4A8C3F', borderRadius: '8px', fontFamily: 'Inter' }} />
                    <Bar dataKey="gross" fill="#F4607A" name="Gross $" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net" fill="#4A8C3F" name="Net $" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Sales Data Table */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="font-heading text-lg text-white">All Sales</h2>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by plant or buyer..."
              className="w-64 px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body text-sm" />
          </div>

          <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-flamingo-blush animate-pulse font-body">Loading...</div>
            ) : filteredSales.length === 0 ? (
              <div className="p-8 text-center text-flamingo-blush/50 font-body text-sm">
                {search ? 'No matching sales.' : 'No sales yet. Log your first sale above!'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-tropical-leaf/20">
                      {[
                        { key: 'plant_name', label: 'Plant' }, { key: 'buyer_name', label: 'Buyer' },
                        { key: 'sale_price', label: 'Price' }, { key: 'cost_per_plant', label: 'Cost' },
                        { key: 'true_profit', label: 'Profit' }, { key: 'date', label: 'Date' },
                      ].map(col => (
                        <th key={col.key} onClick={() => handleSort(col.key)}
                          className="px-3 py-3 text-left text-flamingo-blush/70 font-body font-medium cursor-pointer hover:text-hot-pink text-xs uppercase tracking-wide">
                          {col.label} {sortField === col.key && (sortDir === 'asc' ? '↑' : '↓')}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map(sale => (
                      <tr key={sale.id} className={`border-b border-tropical-leaf/10 hover:bg-tropical-leaf/5 ${sale.refunded ? 'bg-red-500/5' : ''}`}>
                        <td className="px-3 py-2.5 text-white font-body">{sale.plant_name}</td>
                        <td className="px-3 py-2.5 text-flamingo-blush/70 font-body">{sale.buyer_name}</td>
                        <td className="px-3 py-2.5 text-white font-body">${sale.sale_price.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-flamingo-blush/60 font-body">${sale.cost_per_plant.toFixed(2)}</td>
                        <td className={`px-3 py-2.5 font-heading text-sm ${sale.true_profit >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>
                          ${sale.true_profit.toFixed(2)}
                          {sale.refunded && <span className="ml-1 text-xs text-red-400 font-body">(R)</span>}
                        </td>
                        <td className="px-3 py-2.5 text-flamingo-blush/60 font-body">{sale.date}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {!sale.refunded && (
                              <button onClick={() => setRefundModal({ sale, amount: '' })}
                                className="text-yellow-400/70 hover:text-yellow-300 text-xs font-body cursor-pointer">Refund</button>
                            )}
                            <button onClick={() => handleDeleteSale(sale.id!)}
                              className="text-red-400/50 hover:text-red-300 text-xs font-body cursor-pointer">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sales by Plant Type */}
        {!loading && plantStats.length > 0 && (
          <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6">
            <h2 className="font-heading text-lg text-white mb-4">Sales by Plant Type</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-tropical-leaf/20">
                    <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase tracking-wide">Plant</th>
                    <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase tracking-wide"># Sold</th>
                    <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase tracking-wide">Gross</th>
                    <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase tracking-wide">Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {plantStats.map(p => (
                    <tr key={p.name} className="border-b border-tropical-leaf/10 hover:bg-tropical-leaf/5">
                      <td className="px-3 py-2.5 text-white font-body">{p.name}</td>
                      <td className="px-3 py-2.5 text-flamingo-blush/70 font-body">{p.sold}</td>
                      <td className="px-3 py-2.5 text-white font-body">${p.gross.toFixed(2)}</td>
                      <td className={`px-3 py-2.5 font-heading text-sm ${p.net >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>
                        ${p.net.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Refund Modal */}
        {refundModal.sale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-deep-jungle border border-tropical-leaf/30 rounded-xl p-6 w-full max-w-md">
              <h3 className="font-heading text-lg text-hot-pink mb-3">Log Refund</h3>
              <p className="text-flamingo-blush/70 text-sm font-body mb-4">
                {refundModal.sale.plant_name} — {refundModal.sale.buyer_name} — ${refundModal.sale.sale_price.toFixed(2)}
              </p>
              <div className="mb-4">
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Refund Amount ($)</label>
                <input type="number" min="0" step="0.01" value={refundModal.amount}
                  onChange={e => setRefundModal(m => ({ ...m, amount: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" autoFocus />
              </div>
              <div className="flex gap-3">
                <button onClick={handleRefund}
                  className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white font-heading text-sm rounded-lg cursor-pointer">Confirm</button>
                <button onClick={() => setRefundModal({ sale: null, amount: '' })}
                  className="px-4 py-2 bg-warm-wood/30 text-white font-body text-sm rounded-lg cursor-pointer">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
