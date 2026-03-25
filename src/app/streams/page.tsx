'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { supabase, Stream, Sale } from '@/lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function StreamsPage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
  const [form, setForm] = useState({
    name: '', date: new Date().toISOString().split('T')[0],
    viewer_count: '' as string, notes: '', total_plants_listed: '' as string
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [streamsRes, salesRes] = await Promise.all([
      supabase.from('streams').select('*').order('date', { ascending: false }),
      supabase.from('sales').select('*').order('date', { ascending: false }),
    ]);
    setStreams(streamsRes.data || []);
    setSales(salesRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function getStreamSales(stream: Stream): Sale[] {
    return sales.filter(s => s.stream_id === stream.id || (s.date === stream.date && !s.stream_id));
  }

  async function handleCreateStream(e: React.FormEvent) {
    e.preventDefault();

    const streamDate = form.date;
    const viewerCount = form.viewer_count ? parseInt(form.viewer_count) : null;
    const totalPlantsListed = form.total_plants_listed ? parseInt(form.total_plants_listed) : 0;

    // Find sales matching this date
    const matchingSales = sales.filter(s => s.date === streamDate);
    const totalRevenue = matchingSales.reduce((sum, s) => sum + s.sale_price, 0);
    const totalCost = matchingSales.reduce((sum, s) => sum + s.cost_per_plant, 0);
    const trueProfit = matchingSales.reduce((sum, s) => sum + s.true_profit, 0);
    const totalPlantsSold = matchingSales.length;
    const avgSalePrice = totalPlantsSold > 0 ? totalRevenue / totalPlantsSold : 0;
    const sellThroughRate = totalPlantsListed > 0 ? (totalPlantsSold / totalPlantsListed) * 100 : 0;
    const trueMarginPct = totalRevenue > 0 ? (trueProfit / totalRevenue) * 100 : 0;

    const { data: newStream } = await supabase.from('streams').insert({
      name: form.name,
      date: streamDate,
      notes: form.notes,
      viewer_count: viewerCount,
      total_revenue: parseFloat(totalRevenue.toFixed(2)),
      total_cost: parseFloat(totalCost.toFixed(2)),
      true_profit: parseFloat(trueProfit.toFixed(2)),
      true_margin_pct: parseFloat(trueMarginPct.toFixed(2)),
      total_plants_listed: totalPlantsListed,
      total_plants_sold: totalPlantsSold,
      sell_through_rate: parseFloat(sellThroughRate.toFixed(1)),
      average_sale_price: parseFloat(avgSalePrice.toFixed(2)),
    }).select().single();

    // Associate sales with this stream
    if (newStream) {
      await supabase.from('sales').update({ stream_id: newStream.id }).eq('date', streamDate).is('stream_id', null);
    }

    setForm({ name: '', date: new Date().toISOString().split('T')[0], viewer_count: '', notes: '', total_plants_listed: '' });
    setShowForm(false);
    loadData();
  }

  // Chart data
  const chartData = [...streams]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({
      name: s.name.length > 12 ? s.name.slice(0, 12) + '...' : s.name,
      date: s.date,
      revenue: s.total_revenue,
      profit: s.true_profit,
    }));

  const bestStream = streams.length > 0 ? streams.reduce((best, s) => s.true_profit > best.true_profit ? s : best, streams[0]) : null;
  const worstStream = streams.length > 0 ? streams.reduce((worst, s) => s.true_profit < worst.true_profit ? s : worst, streams[0]) : null;

  // Month-over-month totals
  const monthlyData: Record<string, { revenue: number; profit: number }> = {};
  streams.forEach(s => {
    const month = s.date.slice(0, 7); // YYYY-MM
    if (!monthlyData[month]) monthlyData[month] = { revenue: 0, profit: 0 };
    monthlyData[month].revenue += s.total_revenue;
    monthlyData[month].profit += s.true_profit;
  });

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="font-heading text-3xl text-hot-pink">Streams</h1>
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg transition-colors cursor-pointer">
            {showForm ? 'Cancel' : '+ New Stream'}
          </button>
        </div>

        {/* New Stream Form */}
        {showForm && (
          <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 mb-6">
            <h2 className="font-heading text-xl text-white mb-4">Create Jungle Lounge Stream</h2>
            <form onSubmit={handleCreateStream} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-flamingo-blush mb-1 font-body">Stream Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. March 25 Stream"
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush mb-1 font-body">Date *</label>
                <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush mb-1 font-body">Viewer Count</label>
                <input type="number" min="0" value={form.viewer_count} onChange={e => setForm(f => ({ ...f, viewer_count: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush mb-1 font-body">Total Plants Listed</label>
                <input type="number" min="0" value={form.total_plants_listed} onChange={e => setForm(f => ({ ...f, total_plants_listed: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-flamingo-blush mb-1 font-body">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div>
                <button type="submit" className="px-6 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading rounded-lg transition-colors cursor-pointer">
                  Create Stream
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-flamingo-blush animate-pulse font-body">Loading streams...</div>
        ) : (
          <>
            {/* Performance Trend Chart */}
            {chartData.length > 1 && (
              <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 mb-6">
                <h2 className="font-heading text-xl text-white mb-4">Performance Trend</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1A3D1F" />
                      <XAxis dataKey="name" stroke="#F4849A" fontSize={11} />
                      <YAxis stroke="#F4849A" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0F2410', border: '1px solid #4A8C3F', borderRadius: '8px' }}
                        labelStyle={{ color: '#F4849A' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#F4607A" strokeWidth={2} name="Revenue" dot={{ fill: '#F4607A' }} />
                      <Line type="monotone" dataKey="profit" stroke="#4A8C3F" strokeWidth={2} name="True Profit" dot={{ fill: '#4A8C3F' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Best / Worst highlights */}
                <div className="flex flex-wrap gap-4 mt-4">
                  {bestStream && (
                    <div className="text-sm font-body">
                      <span className="text-yellow-400">Best:</span>{' '}
                      <span className="text-white">{bestStream.name}</span>{' '}
                      <span className="text-tropical-leaf font-heading">${bestStream.true_profit.toFixed(2)} profit</span>
                    </div>
                  )}
                  {worstStream && worstStream.id !== bestStream?.id && (
                    <div className="text-sm font-body">
                      <span className="text-red-400/70">Worst:</span>{' '}
                      <span className="text-white/70">{worstStream.name}</span>{' '}
                      <span className="text-red-400/70 font-heading">${worstStream.true_profit.toFixed(2)} profit</span>
                    </div>
                  )}
                </div>

                {/* Monthly totals */}
                {Object.keys(monthlyData).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-tropical-leaf/20">
                    <h3 className="text-sm text-flamingo-blush font-body mb-2">Monthly Totals</h3>
                    <div className="flex flex-wrap gap-4">
                      {Object.entries(monthlyData).sort().map(([month, data]) => (
                        <div key={month} className="bg-dark-bg/50 rounded-lg px-4 py-2">
                          <div className="text-xs text-flamingo-blush/60 font-body">{month}</div>
                          <div className="text-sm text-white font-body">Rev: <span className="text-hot-pink font-heading">${data.revenue.toFixed(2)}</span></div>
                          <div className="text-sm text-white font-body">Profit: <span className="text-tropical-leaf font-heading">${data.profit.toFixed(2)}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stream Detail Modal */}
            {selectedStream && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="bg-deep-jungle border border-tropical-leaf/30 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b border-tropical-leaf/20">
                    <div>
                      <h2 className="font-heading text-2xl text-hot-pink">{selectedStream.name}</h2>
                      <p className="text-flamingo-blush/60 text-sm font-body">{selectedStream.date}</p>
                    </div>
                    <button onClick={() => setSelectedStream(null)} className="text-flamingo-blush/50 hover:text-white text-2xl cursor-pointer">&times;</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                      {[
                        { label: 'Revenue', value: `$${selectedStream.total_revenue.toFixed(2)}`, color: 'text-hot-pink' },
                        { label: 'True Profit', value: `$${selectedStream.true_profit.toFixed(2)}`, color: selectedStream.true_profit >= 0 ? 'text-tropical-leaf' : 'text-red-400' },
                        { label: 'Margin', value: `${selectedStream.true_margin_pct.toFixed(1)}%`, color: 'text-flamingo-blush' },
                        { label: 'Sell-Through', value: `${selectedStream.sell_through_rate.toFixed(1)}%`, color: 'text-white' },
                        { label: 'Plants Sold', value: `${selectedStream.total_plants_sold}`, color: 'text-white' },
                        { label: 'Avg Sale', value: `$${selectedStream.average_sale_price.toFixed(2)}`, color: 'text-flamingo-blush' },
                        { label: 'Viewers', value: selectedStream.viewer_count?.toString() || 'N/A', color: 'text-white' },
                        { label: 'Total Cost', value: `$${selectedStream.total_cost.toFixed(2)}`, color: 'text-warm-wood' },
                      ].map(stat => (
                        <div key={stat.label} className="bg-dark-bg/50 rounded-lg p-3 text-center">
                          <div className={`font-heading text-lg ${stat.color}`}>{stat.value}</div>
                          <div className="text-xs text-flamingo-blush/50 font-body">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Sales in this stream */}
                    <h3 className="font-heading text-lg text-white mb-3">Sales in This Stream</h3>
                    {(() => {
                      const streamSales = getStreamSales(selectedStream);
                      const topByProfit = [...streamSales].sort((a, b) => b.true_profit - a.true_profit);
                      return streamSales.length === 0 ? (
                        <p className="text-flamingo-blush/50 text-sm font-body">No sales linked to this stream.</p>
                      ) : (
                        <>
                          <div className="overflow-x-auto bg-dark-bg/50 rounded-lg mb-4">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-tropical-leaf/20">
                                  <th className="px-3 py-2 text-left text-flamingo-blush font-body">Plant</th>
                                  <th className="px-3 py-2 text-left text-flamingo-blush font-body">Buyer</th>
                                  <th className="px-3 py-2 text-left text-flamingo-blush font-body">Price</th>
                                  <th className="px-3 py-2 text-left text-flamingo-blush font-body">Profit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {streamSales.map(s => (
                                  <tr key={s.id} className="border-b border-tropical-leaf/10">
                                    <td className="px-3 py-2 text-white font-body">{s.plant_name}</td>
                                    <td className="px-3 py-2 text-flamingo-blush/70 font-body">{s.buyer_name}</td>
                                    <td className="px-3 py-2 text-white font-body">${s.sale_price.toFixed(2)}</td>
                                    <td className={`px-3 py-2 font-heading ${s.true_profit >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>
                                      ${s.true_profit.toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {topByProfit.length > 0 && (
                            <>
                              <h4 className="font-heading text-sm text-hot-pink mb-2">Top Plants by Profit</h4>
                              <div className="flex flex-wrap gap-2">
                                {topByProfit.slice(0, 5).map((s, i) => (
                                  <span key={i} className="px-3 py-1 bg-tropical-leaf/10 rounded text-sm font-body text-white">
                                    {s.plant_name} <span className="text-tropical-leaf font-heading">${s.true_profit.toFixed(2)}</span>
                                  </span>
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Stream Cards */}
            {streams.length === 0 ? (
              <div className="p-8 text-center text-flamingo-blush/50 font-body">
                No streams yet. Create your first Jungle Lounge stream above!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {streams.map(stream => (
                  <div key={stream.id}
                    onClick={() => setSelectedStream(stream)}
                    className={`bg-deep-jungle/40 border rounded-xl p-5 cursor-pointer hover:border-hot-pink/50 transition-colors ${
                      bestStream?.id === stream.id ? 'border-yellow-500/50' : worstStream?.id === stream.id && streams.length > 1 ? 'border-red-500/20' : 'border-tropical-leaf/20'
                    }`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-heading text-lg text-white truncate">{stream.name}</h3>
                      {bestStream?.id === stream.id && <span className="text-yellow-400 text-xs font-body">Best</span>}
                    </div>
                    <div className="text-xs text-flamingo-blush/60 font-body mb-3">{stream.date}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-flamingo-blush/50 text-xs font-body">Revenue</div>
                        <div className="text-hot-pink font-heading">${stream.total_revenue.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-flamingo-blush/50 text-xs font-body">Profit</div>
                        <div className={`font-heading ${stream.true_profit >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>
                          ${stream.true_profit.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-flamingo-blush/50 text-xs font-body">Margin</div>
                        <div className="text-white font-body">{stream.true_margin_pct.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-flamingo-blush/50 text-xs font-body">Sell-Through</div>
                        <div className="text-white font-body">{stream.sell_through_rate.toFixed(1)}%</div>
                      </div>
                      {stream.viewer_count && (
                        <div className="col-span-2">
                          <div className="text-flamingo-blush/50 text-xs font-body">Viewers</div>
                          <div className="text-white font-body">{stream.viewer_count}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
