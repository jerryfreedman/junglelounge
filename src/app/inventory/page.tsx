'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { supabase, Batch } from '@/lib/supabase';

const emptyBatch = {
  name: '', supplier: '', quantity: 0, total_cost: 0,
  cost_per_plant: 0, reorder_threshold: 3, date: new Date().toISOString().split('T')[0], notes: ''
};

export default function InventoryPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [form, setForm] = useState({ ...emptyBatch });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const loadBatches = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('batches').select('*').order(sortField, { ascending: sortDir === 'asc' });
    if (data) setBatches(data);
    setLoading(false);
  }, [sortField, sortDir]);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  const costPerPlant = form.quantity > 0 ? (form.total_cost / form.quantity) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, cost_per_plant: costPerPlant };

    if (editingId) {
      await supabase.from('batches').update(payload).eq('id', editingId);
      setEditingId(null);
    } else {
      await supabase.from('batches').insert(payload);
    }
    setForm({ ...emptyBatch, date: new Date().toISOString().split('T')[0] });
    loadBatches();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this batch?')) return;
    await supabase.from('batches').delete().eq('id', id);
    loadBatches();
  }

  function startEdit(batch: Batch) {
    setEditingId(batch.id!);
    setForm({
      name: batch.name, supplier: batch.supplier, quantity: batch.quantity,
      total_cost: batch.total_cost, cost_per_plant: batch.cost_per_plant,
      reorder_threshold: batch.reorder_threshold, date: batch.date, notes: batch.notes
    });
  }

  function getAgeDays(dateStr: string) {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  }

  function getStockBadge(batch: Batch) {
    if (batch.quantity < batch.reorder_threshold) return <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400 font-body">Reorder Now</span>;
    if (batch.quantity === batch.reorder_threshold) return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400 font-body">At Threshold</span>;
    return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 font-body">In Stock</span>;
  }

  function getAgeBadge(dateStr: string) {
    const days = getAgeDays(dateStr);
    if (days > 30) return <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400 font-body">{days}d - Consider Discounting</span>;
    if (days >= 14) return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400 font-body">{days}d</span>;
    return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 font-body">{days}d</span>;
  }

  function handleSort(field: string) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  const lowStockBatches = batches.filter(b => b.quantity < b.reorder_threshold);
  const agingBatches = batches.filter(b => getAgeDays(b.date) > 30);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <h1 className="font-heading text-3xl text-hot-pink mb-6">Inventory</h1>

        {/* Aging Alert Banner */}
        {agingBatches.length > 0 && (
          <div className="mb-4 border-2 border-hot-pink rounded-xl bg-hot-pink/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">⚠️</span>
              <span className="font-heading text-hot-pink">Aging Alert</span>
            </div>
            {agingBatches.map(b => (
              <p key={b.id} className="text-flamingo-blush text-sm font-body">
                <strong>{b.name}</strong> — {getAgeDays(b.date)} days old — Consider Discounting or Bundling
              </p>
            ))}
          </div>
        )}

        {/* Reorder Warning */}
        {lowStockBatches.length > 0 && (
          <div className="mb-4 border border-red-500/40 rounded-xl bg-red-500/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🔴</span>
              <span className="font-heading text-red-400">Low Stock Alert</span>
            </div>
            {lowStockBatches.map(b => (
              <p key={b.id} className="text-red-300 text-sm font-body">
                <strong>{b.name}</strong> — {b.quantity} remaining (threshold: {b.reorder_threshold})
              </p>
            ))}
          </div>
        )}

        {/* Add/Edit Form */}
        <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-6 mb-6">
          <h2 className="font-heading text-xl text-white mb-4">
            {editingId ? 'Edit Batch' : 'Add New Batch'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-flamingo-blush mb-1 font-body">Plant Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
            </div>
            <div>
              <label className="block text-sm text-flamingo-blush mb-1 font-body">Supplier *</label>
              <input required value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
            </div>
            <div>
              <label className="block text-sm text-flamingo-blush mb-1 font-body">Quantity *</label>
              <input type="number" required min="0" value={form.quantity || ''} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
            </div>
            <div>
              <label className="block text-sm text-flamingo-blush mb-1 font-body">Total Cost Paid ($) *</label>
              <input type="number" required min="0" step="0.01" value={form.total_cost || ''} onChange={e => setForm(f => ({ ...f, total_cost: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
            </div>
            <div>
              <label className="block text-sm text-flamingo-blush mb-1 font-body">Cost Per Plant</label>
              <div className="px-3 py-2 bg-dark-bg/50 border border-deep-jungle rounded-lg text-tropical-leaf font-heading text-sm">
                ${costPerPlant.toFixed(2)}
              </div>
            </div>
            <div>
              <label className="block text-sm text-flamingo-blush mb-1 font-body">Reorder Threshold</label>
              <input type="number" min="0" value={form.reorder_threshold} onChange={e => setForm(f => ({ ...f, reorder_threshold: parseInt(e.target.value) || 3 }))}
                className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
            </div>
            <div>
              <label className="block text-sm text-flamingo-blush mb-1 font-body">Date *</label>
              <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-flamingo-blush mb-1 font-body">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="px-6 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading rounded-lg transition-colors cursor-pointer">
                {editingId ? 'Update Batch' : 'Add Batch'}
              </button>
              {editingId && (
                <button type="button" onClick={() => { setEditingId(null); setForm({ ...emptyBatch, date: new Date().toISOString().split('T')[0] }); }}
                  className="px-4 py-2 bg-warm-wood/30 hover:bg-warm-wood/50 text-white font-body rounded-lg transition-colors cursor-pointer text-sm">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Batches Table */}
        <div className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-flamingo-blush animate-pulse">Loading batches...</div>
          ) : batches.length === 0 ? (
            <div className="p-8 text-center text-flamingo-blush/50 font-body">No batches yet. Add your first batch above!</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-tropical-leaf/20">
                    {[
                      { key: 'name', label: 'Plant Name' },
                      { key: 'supplier', label: 'Supplier' },
                      { key: 'quantity', label: 'Qty' },
                      { key: 'total_cost', label: 'Total Cost' },
                      { key: 'cost_per_plant', label: 'Cost/Plant' },
                      { key: 'date', label: 'Date' },
                    ].map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)}
                        className="px-4 py-3 text-left text-flamingo-blush font-body cursor-pointer hover:text-hot-pink transition-colors">
                        {col.label} {sortField === col.key && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-flamingo-blush font-body">Stock</th>
                    <th className="px-4 py-3 text-left text-flamingo-blush font-body">Age</th>
                    <th className="px-4 py-3 text-left text-flamingo-blush font-body">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map(batch => (
                    <tr key={batch.id} className="border-b border-tropical-leaf/10 hover:bg-tropical-leaf/5 transition-colors">
                      <td className="px-4 py-3 text-white font-body">{batch.name}</td>
                      <td className="px-4 py-3 text-flamingo-blush/70 font-body">{batch.supplier}</td>
                      <td className="px-4 py-3 text-white font-body">{batch.quantity}</td>
                      <td className="px-4 py-3 text-white font-body">${batch.total_cost.toFixed(2)}</td>
                      <td className="px-4 py-3 text-tropical-leaf font-heading">${batch.cost_per_plant.toFixed(2)}</td>
                      <td className="px-4 py-3 text-flamingo-blush/70 font-body">{batch.date}</td>
                      <td className="px-4 py-3">{getStockBadge(batch)}</td>
                      <td className="px-4 py-3">{getAgeBadge(batch.date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(batch)}
                            className="text-flamingo-blush hover:text-hot-pink text-xs font-body cursor-pointer">Edit</button>
                          <button onClick={() => handleDelete(batch.id!)}
                            className="text-red-400 hover:text-red-300 text-xs font-body cursor-pointer">Delete</button>
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
    </AppShell>
  );
}
