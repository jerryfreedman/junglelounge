'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { supabase, Customer, EmailDraft } from '@/lib/supabase';

const EMAIL_TYPES = [
  'Stream Announcement',
  'Follow-Up',
  'Win-Back',
  'New Arrival',
  'Thank You',
  'Wishlist Alert',
];

export default function EmailsPage() {
  return (
    <Suspense fallback={<AppShell><div className="text-flamingo-blush animate-pulse font-body p-6">Loading Email Studio...</div></AppShell>}>
      <EmailsContent />
    </Suspense>
  );
}

function EmailsContent() {
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  // Single mode
  const [singleCustomer, setSingleCustomer] = useState('');
  const [singleType, setSingleType] = useState('Stream Announcement');
  const [singlePlant, setSinglePlant] = useState('');
  const [singleCustomNote, setSingleCustomNote] = useState('');
  const [singleResult, setSingleResult] = useState('');
  const [generating, setGenerating] = useState(false);

  // Bulk mode
  const [bulkList, setBulkList] = useState<'vips' | 'cold' | 'active'>('vips');
  const [bulkType, setBulkType] = useState('Stream Announcement');
  const [bulkCustomNote, setBulkCustomNote] = useState('');
  const [bulkResults, setBulkResults] = useState<{ name: string; content: string }[]>([]);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkGenerating, setBulkGenerating] = useState(false);

  // History
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);

  // Copied state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Pre-fill from URL params
    const customer = searchParams.get('customer');
    const plant = searchParams.get('plant');
    const type = searchParams.get('type');
    if (customer) setSingleCustomer(customer);
    if (plant) setSinglePlant(plant);
    if (type === 'wishlist') setSingleType('Wishlist Alert');
  }, [searchParams]);

  async function loadData() {
    setLoading(true);
    const [custRes, draftRes] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('email_drafts').select('*').order('created_at', { ascending: false }),
    ]);
    setCustomers(custRes.data || []);
    setDrafts(draftRes.data || []);
    setLoading(false);
  }

  function daysSince(dateStr: string) {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  }

  // Smart lists
  function getVipThreshold() {
    if (customers.length === 0) return 0;
    const sorted = [...customers].sort((a, b) => b.total_spent - a.total_spent);
    return sorted[Math.floor(sorted.length * 0.2)]?.total_spent || 0;
  }

  function getListCustomers(list: 'vips' | 'cold' | 'active') {
    const vipThreshold = getVipThreshold();
    if (list === 'vips') return customers.filter(c => c.total_spent >= vipThreshold && vipThreshold > 0);
    if (list === 'active') return customers.filter(c => daysSince(c.last_purchase_date) <= 60);
    return customers.filter(c => daysSince(c.last_purchase_date) > 60);
  }

  async function generateEmail(customerName: string, emailType: string, plantName?: string, customNote?: string): Promise<string> {
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName, emailType, plantName, customNote }),
      });
      const data = await res.json();
      if (data.error) return `Error: ${data.error}`;
      return data.content;
    } catch (err) {
      return `Error generating email: ${err}`;
    }
  }

  async function handleSingleGenerate() {
    if (!singleCustomer) return;
    setGenerating(true);
    setSingleResult('');
    const content = await generateEmail(singleCustomer, singleType, singlePlant, singleCustomNote);
    setSingleResult(content);

    // Save to DB
    await supabase.from('email_drafts').insert({
      customer_name: singleCustomer,
      email_type: singleType,
      custom_note: singleCustomNote,
      content,
    });
    loadData();
    setGenerating(false);
  }

  async function handleBulkGenerate() {
    const listCustomers = getListCustomers(bulkList);
    if (listCustomers.length === 0) return;

    setBulkGenerating(true);
    setBulkResults([]);
    setBulkProgress({ current: 0, total: listCustomers.length });

    const results: { name: string; content: string }[] = [];
    for (let i = 0; i < listCustomers.length; i++) {
      const c = listCustomers[i];
      setBulkProgress({ current: i + 1, total: listCustomers.length });
      const content = await generateEmail(c.name, bulkType, '', bulkCustomNote);
      results.push({ name: c.name, content });
      setBulkResults([...results]);

      // Save to DB
      await supabase.from('email_drafts').insert({
        customer_name: c.name,
        email_type: bulkType,
        custom_note: bulkCustomNote,
        content,
      });
    }

    loadData();
    setBulkGenerating(false);
  }

  async function handleCopy(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <h1 className="font-heading text-3xl text-hot-pink mb-6">Email Studio</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Generator */}
          <div className="lg:col-span-2">
            {/* Mode tabs */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => setMode('single')}
                className={`px-4 py-2 rounded-lg text-sm font-heading transition-colors cursor-pointer ${mode === 'single' ? 'bg-hot-pink text-white' : 'bg-deep-jungle/40 text-flamingo-blush border border-tropical-leaf/20'}`}>
                Single Email
              </button>
              <button onClick={() => setMode('bulk')}
                className={`px-4 py-2 rounded-lg text-sm font-heading transition-colors cursor-pointer ${mode === 'bulk' ? 'bg-hot-pink text-white' : 'bg-deep-jungle/40 text-flamingo-blush border border-tropical-leaf/20'}`}>
                Bulk Draft
              </button>
            </div>

            {mode === 'single' ? (
              <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 mb-6">
                <h2 className="font-heading text-xl text-white mb-4">Generate Single Email</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-flamingo-blush mb-1 font-body">Customer *</label>
                    <select value={singleCustomer} onChange={e => setSingleCustomer(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm">
                      <option value="">Select customer...</option>
                      {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-flamingo-blush mb-1 font-body">Email Type *</label>
                    <select value={singleType} onChange={e => setSingleType(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm">
                      {EMAIL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-flamingo-blush mb-1 font-body">Plant Name (optional)</label>
                    <input value={singlePlant} onChange={e => setSinglePlant(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-flamingo-blush mb-1 font-body">Custom Instructions (optional)</label>
                    <input value={singleCustomNote} onChange={e => setSingleCustomNote(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
                  </div>
                </div>
                <button onClick={handleSingleGenerate} disabled={!singleCustomer || generating}
                  className="px-6 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading rounded-lg transition-colors cursor-pointer disabled:opacity-50">
                  {generating ? 'Generating...' : 'Generate Email'}
                </button>

                {generating && (
                  <div className="mt-4 text-center">
                    <div className="text-4xl animate-bounce inline-block">🦩</div>
                    <p className="text-flamingo-blush font-body text-sm animate-pulse">Crafting your email...</p>
                  </div>
                )}

                {singleResult && !generating && (
                  <div className="mt-6 bg-dark-bg/80 border border-tropical-leaf/30 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-tropical-leaf/20 bg-deep-jungle/60">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🦩</span>
                        <span className="font-heading text-sm text-hot-pink">{singleType} — {singleCustomer}</span>
                      </div>
                      <button onClick={() => handleCopy(singleResult, 'single')}
                        className="px-3 py-1 bg-hot-pink/20 hover:bg-hot-pink/30 text-hot-pink text-xs font-heading rounded transition-colors cursor-pointer">
                        {copiedId === 'single' ? 'Copied! 🦩' : 'Copy'}
                      </button>
                    </div>
                    <div className="p-4">
                      <pre className="text-white font-body text-sm whitespace-pre-wrap">{singleResult}</pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 mb-6">
                <h2 className="font-heading text-xl text-white mb-4">Bulk Draft Generation</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-flamingo-blush mb-1 font-body">Customer List *</label>
                    <select value={bulkList} onChange={e => setBulkList(e.target.value as 'vips' | 'cold' | 'active')}
                      className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm">
                      <option value="vips">VIPs ({getListCustomers('vips').length})</option>
                      <option value="active">Active ({getListCustomers('active').length})</option>
                      <option value="cold">Cold ({getListCustomers('cold').length})</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-flamingo-blush mb-1 font-body">Email Type *</label>
                    <select value={bulkType} onChange={e => setBulkType(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm">
                      {EMAIL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-flamingo-blush mb-1 font-body">Custom Instructions (optional)</label>
                    <textarea value={bulkCustomNote} onChange={e => setBulkCustomNote(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
                  </div>
                </div>
                <button onClick={handleBulkGenerate} disabled={bulkGenerating || getListCustomers(bulkList).length === 0}
                  className="px-6 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading rounded-lg transition-colors cursor-pointer disabled:opacity-50">
                  {bulkGenerating ? `Generating ${bulkProgress.current}/${bulkProgress.total}...` : `Generate for ${getListCustomers(bulkList).length} Customers`}
                </button>

                {bulkGenerating && (
                  <div className="mt-4">
                    <div className="w-full bg-dark-bg rounded-full h-2 mb-2">
                      <div className="bg-hot-pink h-2 rounded-full transition-all"
                        style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} />
                    </div>
                    <div className="text-center">
                      <div className="text-3xl animate-bounce inline-block">🦩</div>
                      <p className="text-flamingo-blush font-body text-xs animate-pulse">
                        Generating {bulkProgress.current} of {bulkProgress.total}...
                      </p>
                    </div>
                  </div>
                )}

                {bulkResults.length > 0 && (
                  <div className="mt-6 space-y-3 max-h-[60vh] overflow-y-auto">
                    {bulkResults.map((r, i) => (
                      <div key={i} className="bg-dark-bg/80 border border-tropical-leaf/30 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between p-3 border-b border-tropical-leaf/20 bg-deep-jungle/60">
                          <div className="flex items-center gap-2">
                            <span>🦩</span>
                            <span className="font-heading text-sm text-hot-pink">{bulkType} — {r.name}</span>
                          </div>
                          <button onClick={() => handleCopy(r.content, `bulk-${i}`)}
                            className="px-3 py-1 bg-hot-pink/20 hover:bg-hot-pink/30 text-hot-pink text-xs font-heading rounded transition-colors cursor-pointer">
                            {copiedId === `bulk-${i}` ? 'Copied! 🦩' : 'Copy'}
                          </button>
                        </div>
                        <div className="p-3">
                          <pre className="text-white font-body text-xs whitespace-pre-wrap">{r.content}</pre>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: History */}
          <div>
            <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-4">
              <h2 className="font-heading text-lg text-white mb-3">Generation History</h2>
              {loading ? (
                <div className="text-flamingo-blush/50 text-sm font-body animate-pulse">Loading...</div>
              ) : drafts.length === 0 ? (
                <div className="text-flamingo-blush/50 text-sm font-body">No drafts yet.</div>
              ) : (
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                  {drafts.map(d => (
                    <div key={d.id}
                      className="bg-dark-bg/50 rounded-lg overflow-hidden cursor-pointer hover:bg-dark-bg/70 transition-colors"
                      onClick={() => setExpandedDraft(expandedDraft === d.id ? null : d.id!)}>
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-white text-sm font-body truncate">{d.customer_name}</span>
                          <span className="text-flamingo-blush/40 text-xs font-body flex-shrink-0 ml-2">
                            {expandedDraft === d.id ? '▼' : '▶'}
                          </span>
                        </div>
                        <div className="text-xs text-flamingo-blush/50 font-body">
                          {d.email_type} &middot; {d.created_at ? new Date(d.created_at).toLocaleDateString() : ''}
                        </div>
                      </div>
                      {expandedDraft === d.id && (
                        <div className="px-3 pb-3 border-t border-tropical-leaf/10 pt-2">
                          <pre className="text-white/80 font-body text-xs whitespace-pre-wrap">{d.content}</pre>
                          <button onClick={(e) => { e.stopPropagation(); handleCopy(d.content, d.id!); }}
                            className="mt-2 px-3 py-1 bg-hot-pink/20 hover:bg-hot-pink/30 text-hot-pink text-xs font-heading rounded transition-colors cursor-pointer">
                            {copiedId === d.id ? 'Copied! 🦩' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
