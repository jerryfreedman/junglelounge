'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '@/components/AppShell';
import { supabase, Batch, ensureSettings } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ExtractedItem {
  name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  supplier: string;
  date?: string;
  error?: string;
}

export default function ExpensesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);

  // Manual add form
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: '', supplier: '', quantity: 0, total_cost: 0, date: new Date().toISOString().split('T')[0], notes: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase.from('batches').select('*').order('date', { ascending: false });
      if (fetchErr) throw new Error(`Failed to load expenses: ${fetchErr.message}`);
      setBatches(data || []);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const [lastUploadedPath, setLastUploadedPath] = useState<string | null>(null);

  // Handle PDF upload — save to Supabase Storage + extract with AI
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setExtractedItems([]);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      try {
        // 1. Upload original file to Supabase Storage
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${timestamp}_${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from('invoices')
          .upload(storagePath, file, { contentType: file.type, upsert: false });

        if (uploadErr) {
          console.warn('Storage upload skipped (bucket may not exist):', uploadErr.message);
          // Don't block — extraction still works without storage
        } else {
          setLastUploadedPath(storagePath);
        }

        // 2. Send to AI for extraction
        const res = await fetch('/api/parse-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64: base64, fileType: file.type }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (data.items && data.items.length > 0 && !data.items[0].error) {
          setExtractedItems(data.items);
          setShowReview(true);
        } else {
          setError('Could not extract data from this invoice. Try uploading a clearer PDF or image.');
        }
      } catch (err) {
        setError('Error processing invoice: ' + (err instanceof Error ? err.message : err));
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // Save extracted items as batches (batch insert)
  async function handleSaveExtracted() {
    setSaving(true);
    setError(null);
    try {
      const rows = extractedItems.map(item => {
        const costPerPlant = item.quantity > 0 ? item.total_cost / item.quantity : item.unit_cost;
        const notesParts = ['Imported from invoice'];
        if (lastUploadedPath) notesParts.push(`file: ${lastUploadedPath}`);
        return {
          name: item.name,
          supplier: item.supplier,
          quantity: item.quantity,
          total_cost: item.total_cost,
          cost_per_plant: parseFloat(costPerPlant.toFixed(2)),
          reorder_threshold: 3,
          date: item.date || new Date().toISOString().split('T')[0],
          notes: notesParts.join(' | '),
        };
      });
      const { error: insertErr } = await supabase.from('batches').insert(rows);
      if (insertErr) throw new Error(`Failed to save expenses: ${insertErr.message}`);
      setExtractedItems([]);
      setShowReview(false);
      loadData();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
    setSaving(false);
  }

  // Manual batch add
  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const costPerPlant = manualForm.quantity > 0 ? manualForm.total_cost / manualForm.quantity : 0;
      const { error: insertErr } = await supabase.from('batches').insert({
        ...manualForm, cost_per_plant: parseFloat(costPerPlant.toFixed(2)), reorder_threshold: 3,
      });
      if (insertErr) throw new Error(`Failed to add expense: ${insertErr.message}`);
      setManualForm({ name: '', supplier: '', quantity: 0, total_cost: 0, date: new Date().toISOString().split('T')[0], notes: '' });
      setShowManual(false);
      loadData();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return;
    setError(null);
    try {
      const { error: delErr } = await supabase.from('batches').delete().eq('id', id);
      if (delErr) throw new Error(`Failed to delete expense: ${delErr.message}`);
      loadData();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  }

  // Chart data: expenses grouped by supplier
  const supplierTotals: Record<string, number> = {};
  batches.forEach(b => {
    if (!supplierTotals[b.supplier]) supplierTotals[b.supplier] = 0;
    supplierTotals[b.supplier] += b.total_cost;
  });
  const chartData = Object.entries(supplierTotals)
    .map(([name, total]) => ({ name: name.length > 15 ? name.slice(0, 15) + '...' : name, total: parseFloat(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total);

  const totalExpenses = batches.reduce((sum, b) => sum + b.total_cost, 0);
  const totalPlants = batches.reduce((sum, b) => sum + b.quantity, 0);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="font-heading text-3xl text-hot-pink">Expenses</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowManual(!showManual)}
              className="px-4 py-2 bg-warm-wood/20 hover:bg-warm-wood/30 border border-warm-wood/40 text-warm-wood font-body text-sm rounded-lg cursor-pointer">
              {showManual ? 'Cancel' : '+ Manual Entry'}
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400 font-body text-sm">⚠️ {error}</p>
          </div>
        )}

        {/* PDF Upload Area */}
        <div className="bg-deep-jungle/40 border-2 border-dashed border-tropical-leaf/30 rounded-xl p-8 mb-6 text-center hover:border-hot-pink/40 transition-colors">
          <input ref={fileInputRef} type="file" accept=".pdf,image/png,image/jpeg" onChange={handleFileUpload} className="hidden" />
          {uploading ? (
            <div>
              <div className="text-4xl animate-bounce inline-block mb-2">🦩</div>
              <p className="text-flamingo-blush font-body text-sm animate-pulse">Reading your invoice...</p>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-3">📄</div>
              <h2 className="font-heading text-lg text-white mb-2">Upload Supplier Invoice</h2>
              <p className="text-flamingo-blush/50 font-body text-sm mb-4">
                Upload a PDF or image — AI will auto-extract plant names, quantities & costs
              </p>
              <button onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg transition-colors cursor-pointer">
                Choose File
              </button>
            </>
          )}
        </div>

        {/* Review Extracted Items */}
        {showReview && extractedItems.length > 0 && (
          <div className="bg-deep-jungle/40 border border-hot-pink/30 rounded-xl p-6 mb-6">
            <h2 className="font-heading text-lg text-white mb-3">Extracted from Invoice</h2>
            <p className="text-flamingo-blush/50 font-body text-sm mb-4">Review the items below, then save to add them as expenses.</p>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-tropical-leaf/20">
                    <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Plant</th>
                    <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Supplier</th>
                    <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Qty</th>
                    <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Unit Cost</th>
                    <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Total</th>
                    <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {extractedItems.map((item, i) => (
                    <tr key={i} className="border-b border-tropical-leaf/10">
                      <td className="px-3 py-2 text-white font-body">{item.name}</td>
                      <td className="px-3 py-2 text-flamingo-blush/60 font-body">{item.supplier}</td>
                      <td className="px-3 py-2 text-white font-body">{item.quantity}</td>
                      <td className="px-3 py-2 text-white font-body">${item.unit_cost.toFixed(2)}</td>
                      <td className="px-3 py-2 text-hot-pink font-heading">${item.total_cost.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <input type="date"
                          value={item.date || new Date().toISOString().split('T')[0]}
                          onChange={e => {
                            const updated = [...extractedItems];
                            updated[i] = { ...updated[i], date: e.target.value };
                            setExtractedItems(updated);
                          }}
                          className="px-2 py-1 bg-dark-bg border border-deep-jungle rounded text-white text-xs font-body focus:outline-none focus:border-hot-pink"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSaveExtracted} disabled={saving}
                className="px-6 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg cursor-pointer disabled:opacity-50">
                {saving ? 'Saving...' : `Save ${extractedItems.length} Items`}
              </button>
              <button onClick={() => { setShowReview(false); setExtractedItems([]); }}
                className="px-4 py-2 bg-warm-wood/30 text-white font-body text-sm rounded-lg cursor-pointer">Discard</button>
            </div>
          </div>
        )}

        {/* Manual Entry Form */}
        {showManual && (
          <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 mb-6">
            <h2 className="font-heading text-lg text-white mb-4">Add Expense Manually</h2>
            <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Plant Name *</label>
                <input required value={manualForm.name} onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Supplier *</label>
                <input required value={manualForm.supplier} onChange={e => setManualForm(f => ({ ...f, supplier: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Quantity *</label>
                <input type="number" required min="1" value={manualForm.quantity || ''} onChange={e => setManualForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Total Cost ($) *</label>
                <input type="number" required min="0" step="0.01" value={manualForm.total_cost || ''} onChange={e => setManualForm(f => ({ ...f, total_cost: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Date</label>
                <input type="date" value={manualForm.date} onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
              </div>
              <div>
                <label className="block text-sm text-flamingo-blush/70 mb-1 font-body">Cost/Plant</label>
                <div className="px-3 py-2 bg-dark-bg/50 border border-deep-jungle rounded-lg text-tropical-leaf font-heading text-sm">
                  ${manualForm.quantity > 0 ? (manualForm.total_cost / manualForm.quantity).toFixed(2) : '0.00'}
                </div>
              </div>
              <div>
                <button type="submit" className="px-6 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading text-sm rounded-lg cursor-pointer">
                  Add Expense
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-flamingo-blush animate-pulse font-body text-center py-8">Loading...</div>
        ) : (
          <>
            {/* Expense Summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-deep-jungle/30 border border-tropical-leaf/10 rounded-lg p-4 text-center">
                <div className="text-lg font-heading text-hot-pink">${totalExpenses.toFixed(2)}</div>
                <div className="text-xs text-flamingo-blush/50 font-body">Total Expenses</div>
              </div>
              <div className="bg-deep-jungle/30 border border-tropical-leaf/10 rounded-lg p-4 text-center">
                <div className="text-lg font-heading text-white">{totalPlants}</div>
                <div className="text-xs text-flamingo-blush/50 font-body">Total Plants</div>
              </div>
              <div className="bg-deep-jungle/30 border border-tropical-leaf/10 rounded-lg p-4 text-center">
                <div className="text-lg font-heading text-white">{batches.length}</div>
                <div className="text-xs text-flamingo-blush/50 font-body">Orders</div>
              </div>
            </div>

            {/* Expense Chart */}
            {chartData.length > 0 && (
              <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 mb-6">
                <h2 className="font-heading text-lg text-white mb-4">Plant Expenses by Supplier</h2>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1A3D1F" />
                      <XAxis dataKey="name" stroke="#F4849A" fontSize={11} />
                      <YAxis stroke="#F4849A" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#0F2410', border: '1px solid #4A8C3F', borderRadius: '8px', fontFamily: 'Inter' }} />
                      <Bar dataKey="total" fill="#F4607A" name="Total $" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Expenses Table (Breakdown by Cost) */}
            <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-tropical-leaf/20">
                <h2 className="font-heading text-lg text-white">All Expenses</h2>
              </div>
              {batches.length === 0 ? (
                <div className="p-8 text-center text-flamingo-blush/50 font-body text-sm">
                  No expenses yet. Upload an invoice or add manually above.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-tropical-leaf/20">
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Plant</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Supplier</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Qty</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Total Cost</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Cost/Plant</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase">Date</th>
                        <th className="px-3 py-2 text-left text-flamingo-blush/70 font-body font-medium text-xs uppercase"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map(b => (
                        <tr key={b.id} className="border-b border-tropical-leaf/10 hover:bg-tropical-leaf/5">
                          <td className="px-3 py-2.5 text-white font-body">{b.name}</td>
                          <td className="px-3 py-2.5 text-flamingo-blush/60 font-body">{b.supplier}</td>
                          <td className="px-3 py-2.5 text-white font-body">{b.quantity}</td>
                          <td className="px-3 py-2.5 text-hot-pink font-heading">${b.total_cost.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-tropical-leaf font-heading">${b.cost_per_plant.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-flamingo-blush/60 font-body">{b.date}</td>
                          <td className="px-3 py-2.5">
                            <button onClick={() => handleDelete(b.id!)}
                              className="text-red-400/60 hover:text-red-300 text-xs font-body cursor-pointer">Delete</button>
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
