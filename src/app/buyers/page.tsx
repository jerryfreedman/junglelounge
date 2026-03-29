'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { supabase, Customer, Sale, Stream, EmailDraft, ensureSettings, requireUserId } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const INACTIVE_BUCKETS = [7, 14, 30, 60, 90];
const PIE_COLORS = ['#F4607A', '#4A8C3F', '#F4849A', '#8B5E3C', '#1A3D1F', '#FFD700', '#FF6B6B', '#6BCB77', '#4D96FF', '#FF922B'];

const EMAIL_TYPES = ['Stream Announcement', 'Follow-Up', 'Win-Back', 'New Arrival', 'Thank You'];

export default function BuyersPage() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStream, setSelectedStream] = useState<string>('');

  const [error, setError] = useState<string | null>(null);

  // Email modal
  const [emailModal, setEmailModal] = useState<{ name: string } | null>(null);
  const [emailType, setEmailType] = useState('Follow-Up');
  const [emailResult, setEmailResult] = useState('');
  const [emailPlant, setEmailPlant] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const uid = await requireUserId();
      const [salesRes, streamRes] = await Promise.all([
        supabase.from('sales').select('*').eq('user_id', uid).order('date', { ascending: false }),
        supabase.from('streams').select('*').eq('user_id', uid).order('date', { ascending: false }),
      ]);
      if (salesRes.error) throw new Error(`Sales load failed: ${salesRes.error.message}`);
      if (streamRes.error) throw new Error(`Streams load failed: ${streamRes.error.message}`);

      const allSales = salesRes.data || [];
      setSales(allSales);
      setStreams(streamRes.data || []);

      // Sync customers from sales — batch upsert instead of N+1 queries
      const grouped: Record<string, Sale[]> = {};
      allSales.forEach(s => {
        if (!grouped[s.buyer_name]) grouped[s.buyer_name] = [];
        grouped[s.buyer_name].push(s);
      });

      const customerRows = Object.entries(grouped).map(([name, customerSales]) => {
        const totalSpent = customerSales.reduce((sum, s) => sum + s.sale_price, 0);
        const totalOrders = customerSales.length;
        const dates = customerSales.map(s => s.date).sort();
        return {
          name,
          total_spent: parseFloat(totalSpent.toFixed(2)),
          total_orders: totalOrders,
          first_purchase_date: dates[0],
          last_purchase_date: dates[dates.length - 1],
          average_order_value: parseFloat((totalSpent / totalOrders).toFixed(2)),
          notes: '',
          user_id: uid,
        };
      });

      if (customerRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from('customers')
          .upsert(customerRows, { onConflict: 'name', ignoreDuplicates: false });
        if (upsertErr) throw new Error(`Customer sync failed: ${upsertErr.message}`);
      }

      const { data: allCusts, error: custErr } = await supabase.from('customers').select('*').eq('user_id', uid).order('total_spent', { ascending: false });
      if (custErr) throw new Error(`Customer load failed: ${custErr.message}`);
      setCustomers(allCusts || []);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function daysSince(dateStr: string) {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  }

  // Top 10 buyers
  const top10 = customers.slice(0, 10);

  // Top buyers data with shipping
  const buyerShipping: Record<string, number> = {};
  sales.forEach(s => {
    if (!buyerShipping[s.buyer_name]) buyerShipping[s.buyer_name] = 0;
    buyerShipping[s.buyer_name] += s.shipping_cost;
  });

  // Inactive buyers chart data
  const inactiveData = INACTIVE_BUCKETS.map(days => ({
    label: `${days}d+`,
    count: customers.filter(c => daysSince(c.last_purchase_date) >= days).length,
  }));

  // Pie chart: % of plants bought by each buyer in a stream
  function getStreamPieData() {
    if (!selectedStream) return [];
    const stream = streams.find(s => s.id === selectedStream);
    if (!stream) return [];

    const streamSales = sales.filter(s => s.stream_id === stream.id || (s.date === stream.date && !s.stream_id));
    const buyerMap: Record<string, number> = {};
    streamSales.forEach(s => {
      if (!buyerMap[s.buyer_name]) buyerMap[s.buyer_name] = 0;
      buyerMap[s.buyer_name] += 1;
    });

    return Object.entries(buyerMap)
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value);
  }

  const pieData = getStreamPieData();
  const totalPieItems = pieData.reduce((sum, d) => sum + d.value, 0);

  // Bulk email
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkList, setBulkList] = useState<'all' | 'vip' | 'active' | 'cold'>('all');
  const [bulkEmailType, setBulkEmailType] = useState('Follow-Up');
  const [bulkPlant, setBulkPlant] = useState('');
  const [bulkNote, setBulkNote] = useState('');
  const [bulkResults, setBulkResults] = useState<{ name: string; content: string; error?: boolean }[]>([]);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  function getBulkCustomers() {
    const today = new Date();
    switch (bulkList) {
      case 'vip': {
        const sorted = [...customers].sort((a, b) => b.total_spent - a.total_spent);
        return sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.2)));
      }
      case 'active':
        return customers.filter(c => {
          const days = Math.floor((today.getTime() - new Date(c.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24));
          return days <= 60;
        });
      case 'cold':
        return customers.filter(c => {
          const days = Math.floor((today.getTime() - new Date(c.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24));
          return days > 60;
        });
      default:
        return customers;
    }
  }

  const bulkCustomers = getBulkCustomers();

  async function handleBulkGenerate() {
    setBulkGenerating(true);
    setBulkResults([]);
    setBulkProgress(0);
    const targets = bulkCustomers;
    const results: { name: string; content: string; error?: boolean }[] = [];

    for (let i = 0; i < targets.length; i++) {
      const c = targets[i];
      try {
        const res = await fetch('/api/generate-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerName: c.name, emailType: bulkEmailType, plantName: bulkPlant, customNote: bulkNote, businessName: profile?.business_name, businessType: profile?.business_type, platformName: profile?.platform_name }),
        });
        const data = await res.json();
        if (data.error) {
          results.push({ name: c.name, content: data.error, error: true });
        } else {
          results.push({ name: c.name, content: data.content || '' });
          // Save draft
          const bulkUid = await requireUserId();
          await supabase.from('email_drafts').insert({
            customer_name: c.name, email_type: bulkEmailType, custom_note: bulkNote, content: data.content || '', user_id: bulkUid,
          });
        }
      } catch (err) {
        results.push({ name: c.name, content: String(err), error: true });
      }
      setBulkProgress(i + 1);
      setBulkResults([...results]);
    }
    setBulkGenerating(false);
  }

  // Email generation
  async function handleGenerateEmail() {
    if (!emailModal) return;
    setGenerating(true);
    setEmailResult('');
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: emailModal.name, emailType, plantName: emailPlant, customNote: emailNote, businessName: profile?.business_name, businessType: profile?.business_type, platformName: profile?.platform_name }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEmailResult(data.content || 'Error generating email');
      // Save draft
      const draftUid = await requireUserId();
      const { error: draftErr } = await supabase.from('email_drafts').insert({
        customer_name: emailModal.name, email_type: emailType, custom_note: emailNote, content: data.content || '', user_id: draftUid,
      });
      if (draftErr) console.error('Failed to save email draft:', draftErr.message);
    } catch (err) {
      setEmailResult('Error: ' + (err instanceof Error ? err.message : err));
    }
    setGenerating(false);
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="font-heading text-3xl text-hot-pink">Buyers</h1>
          <button onClick={() => { setBulkModal(true); setBulkResults([]); setBulkProgress(0); }}
            className="px-4 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg transition-colors cursor-pointer">
            Bulk Email
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400 font-body text-sm">⚠️ {error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-flamingo-blush animate-pulse font-body text-center py-8">Syncing buyer data...</div>
        ) : (
          <>
            {/* Top 10 Buyers */}
            <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 mb-6">
              <h2 className="font-heading text-lg text-white mb-4">Top 10 Buyers</h2>
              {top10.length === 0 ? (
                <p className="text-flamingo-blush/50 font-body text-sm">No buyer data yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-tropical-leaf/20">
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">#</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Buyer</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Plants Bought</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Total Spent</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Shipping Paid</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Last Purchase</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {top10.map((c, i) => (
                        <tr key={c.id} className="border-b border-tropical-leaf/10 hover:bg-tropical-leaf/5">
                          <td className="px-3 py-2.5 text-flamingo-blush/40 font-body">{i + 1}</td>
                          <td className="px-3 py-2.5 text-white font-body font-medium">{c.name}</td>
                          <td className="px-3 py-2.5 text-white font-body">{c.total_orders}</td>
                          <td className="px-3 py-2.5 text-hot-pink font-heading">${c.total_spent.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-flamingo-blush/60 font-body">${(buyerShipping[c.name] || 0).toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-flamingo-blush/60 font-body">{c.last_purchase_date}</td>
                          <td className="px-3 py-2.5">
                            <button onClick={() => { setEmailModal({ name: c.name }); setEmailResult(''); setEmailPlant(''); setEmailNote(''); }}
                              className="text-hot-pink/70 hover:text-hot-pink text-xs font-body cursor-pointer">Email</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Two-column: Inactive Chart + Stream Pie Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Inactive Buyers Chart */}
              <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6">
                <h2 className="font-heading text-lg text-white mb-4">Inactive Buyers</h2>
                <p className="text-flamingo-blush/50 font-body text-xs mb-4">Buyers who haven't purchased in X+ days</p>
                {inactiveData.every(d => d.count === 0) ? (
                  <p className="text-flamingo-blush/50 font-body text-sm">All buyers are active!</p>
                ) : (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={inactiveData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1A3D1F" />
                        <XAxis dataKey="label" stroke="#F4849A" fontSize={11} />
                        <YAxis stroke="#F4849A" fontSize={11} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0F2410', border: '1px solid #4A8C3F', borderRadius: '8px', fontFamily: 'Inter' }} />
                        <Bar dataKey="count" fill="#F4607A" name="Buyers" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Stream Pie Chart */}
              <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6">
                <h2 className="font-heading text-lg text-white mb-3">Buyer Share per Stream</h2>
                <select value={selectedStream} onChange={e => setSelectedStream(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm mb-4">
                  <option value="">Select a stream...</option>
                  {streams.map(s => <option key={s.id} value={s.id}>{s.name} ({s.date})</option>)}
                </select>

                {selectedStream && pieData.length > 0 ? (
                  <div className="h-48 flex items-center">
                    <ResponsiveContainer width="60%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={false}>
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#0F2410', border: '1px solid #4A8C3F', borderRadius: '8px', fontFamily: 'Inter' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1 overflow-y-auto max-h-48">
                      {pieData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-2 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-white font-body truncate">{d.name}</span>
                          <span className="text-flamingo-blush/50 font-body ml-auto">{((d.value / totalPieItems) * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : selectedStream ? (
                  <p className="text-flamingo-blush/50 font-body text-sm">No sales linked to this stream.</p>
                ) : (
                  <p className="text-flamingo-blush/40 font-body text-sm">Select a stream to see buyer breakdown.</p>
                )}
              </div>
            </div>

            {/* All Buyers List */}
            <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-tropical-leaf/20">
                <h2 className="font-heading text-lg text-white">All Buyers ({customers.length})</h2>
              </div>
              {customers.length === 0 ? (
                <div className="p-8 text-center text-flamingo-blush/50 font-body text-sm">No buyers yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-tropical-leaf/20">
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Name</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Orders</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Total</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Avg Order</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Last Active</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Days Ago</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map(c => {
                        const days = daysSince(c.last_purchase_date);
                        return (
                          <tr key={c.id} className="border-b border-tropical-leaf/10 hover:bg-tropical-leaf/5">
                            <td className="px-3 py-2.5 text-white font-body">{c.name}</td>
                            <td className="px-3 py-2.5 text-flamingo-blush/70 font-body">{c.total_orders}</td>
                            <td className="px-3 py-2.5 text-white font-body">${c.total_spent.toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-flamingo-blush/60 font-body">${c.average_order_value.toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-flamingo-blush/60 font-body">{c.last_purchase_date}</td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 text-xs rounded-full font-body ${
                                days <= 14 ? 'bg-green-500/20 text-green-400' :
                                days <= 30 ? 'bg-yellow-500/20 text-yellow-400' :
                                days <= 60 ? 'bg-orange-500/20 text-orange-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>{days}d</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <button onClick={() => { setEmailModal({ name: c.name }); setEmailResult(''); setEmailPlant(''); setEmailNote(''); }}
                                className="text-hot-pink/60 hover:text-hot-pink text-xs font-body cursor-pointer">Email</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Email Modal */}
        {emailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-deep-jungle border border-tropical-leaf/30 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-lg text-hot-pink">Email {emailModal.name}</h3>
                <button onClick={() => setEmailModal(null)} className="text-flamingo-blush/50 hover:text-white text-xl cursor-pointer">&times;</button>
              </div>

              <div className="mb-3">
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Email Type</label>
                <select value={emailType} onChange={e => setEmailType(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm">
                  {EMAIL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="mb-3">
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Item Name (optional)</label>
                <input value={emailPlant} onChange={e => setEmailPlant(e.target.value)}
                  placeholder="e.g. Monstera Albo"
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>

              <div className="mb-4">
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Custom Note (optional)</label>
                <textarea value={emailNote} onChange={e => setEmailNote(e.target.value)}
                  placeholder="Any extra context for the email..."
                  rows={2}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body text-sm resize-none" />
              </div>

              <button onClick={handleGenerateEmail} disabled={generating}
                className="w-full py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg cursor-pointer disabled:opacity-50 mb-4">
                {generating ? 'Generating...' : 'Generate Email'}
              </button>

              {generating && (
                <div className="text-center mb-4">
                  <div className="text-3xl animate-bounce inline-block">🦩</div>
                  <p className="text-flamingo-blush/60 font-body text-xs animate-pulse">Crafting email...</p>
                </div>
              )}

              {emailResult && !generating && (
                <div className="bg-dark-bg/60 rounded-lg p-4 border border-tropical-leaf/20">
                  <pre className="text-white font-body text-sm whitespace-pre-wrap mb-3">{emailResult}</pre>
                  <button onClick={() => handleCopy(emailResult)}
                    className="px-4 py-1.5 bg-hot-pink/20 hover:bg-hot-pink/30 text-hot-pink text-xs font-heading rounded cursor-pointer">
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Bulk Email Modal */}
        {bulkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-deep-jungle border border-tropical-leaf/30 rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-lg text-hot-pink">Bulk Email Generator</h3>
                <button onClick={() => setBulkModal(false)} className="text-flamingo-blush/50 hover:text-white text-xl cursor-pointer">&times;</button>
              </div>

              {!bulkGenerating && bulkResults.length === 0 && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Customer List</label>
                      <select value={bulkList} onChange={e => setBulkList(e.target.value as typeof bulkList)}
                        className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm">
                        <option value="all">All Buyers ({customers.length})</option>
                        <option value="vip">VIPs — Top 20% ({Math.max(1, Math.ceil(customers.length * 0.2))})</option>
                        <option value="active">Active — Last 60 days ({customers.filter(c => daysSince(c.last_purchase_date) <= 60).length})</option>
                        <option value="cold">Cold — 60+ days ({customers.filter(c => daysSince(c.last_purchase_date) > 60).length})</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Email Type</label>
                      <select value={bulkEmailType} onChange={e => setBulkEmailType(e.target.value)}
                        className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm">
                        {EMAIL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Item Name (optional)</label>
                    <input value={bulkPlant} onChange={e => setBulkPlant(e.target.value)}
                      placeholder="e.g. Monstera Albo"
                      className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body text-sm" />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Custom Note (optional)</label>
                    <textarea value={bulkNote} onChange={e => setBulkNote(e.target.value)}
                      placeholder="Extra context applied to all emails..."
                      rows={2}
                      className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body text-sm resize-none" />
                  </div>

                  <button onClick={handleBulkGenerate} disabled={bulkCustomers.length === 0}
                    className="w-full py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg cursor-pointer disabled:opacity-50">
                    Generate {bulkCustomers.length} Email{bulkCustomers.length !== 1 ? 's' : ''}
                  </button>
                </>
              )}

              {/* Progress */}
              {bulkGenerating && (
                <div className="text-center py-4">
                  <div className="text-3xl animate-bounce inline-block mb-2">🦩</div>
                  <p className="text-flamingo-blush/60 font-body text-sm animate-pulse mb-2">Generating emails...</p>
                  <div className="w-full bg-dark-bg rounded-full h-2 mb-1">
                    <div className="bg-hot-pink h-2 rounded-full transition-all" style={{ width: `${(bulkProgress / bulkCustomers.length) * 100}%` }} />
                  </div>
                  <p className="text-flamingo-blush/40 font-body text-xs">{bulkProgress} / {bulkCustomers.length}</p>
                </div>
              )}

              {/* Results */}
              {bulkResults.length > 0 && (
                <div className="space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-flamingo-blush/60 font-body text-sm">{bulkResults.filter(r => !r.error).length} emails generated</p>
                    {!bulkGenerating && (
                      <button onClick={() => { setBulkResults([]); setBulkProgress(0); }}
                        className="text-hot-pink/60 hover:text-hot-pink text-xs font-body cursor-pointer">Generate more</button>
                    )}
                  </div>
                  {bulkResults.map((r, i) => (
                    <div key={i} className={`bg-dark-bg/60 rounded-lg p-4 border ${r.error ? 'border-red-500/20' : 'border-tropical-leaf/20'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-heading text-sm">{r.name}</span>
                        {!r.error && (
                          <button onClick={() => handleCopy(r.content)}
                            className="px-3 py-1 bg-hot-pink/20 hover:bg-hot-pink/30 text-hot-pink text-xs font-heading rounded cursor-pointer">
                            {copied ? 'Copied!' : 'Copy'}
                          </button>
                        )}
                      </div>
                      <pre className={`font-body text-xs whitespace-pre-wrap ${r.error ? 'text-red-400' : 'text-flamingo-blush/70'}`}>
                        {r.content}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
