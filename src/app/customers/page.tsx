'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { supabase, Customer, Sale, Wishlist, WishlistNotification, Batch } from '@/lib/supabase';

type Tab = 'all' | 'vips' | 'active' | 'cold';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [notifications, setNotifications] = useState<WishlistNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [wishlistModal, setWishlistModal] = useState<{ customerId: string; name: string } | null>(null);
  const [wishlistPlant, setWishlistPlant] = useState('');
  const [wishlistNote, setWishlistNote] = useState('');
  const [editingNotes, setEditingNotes] = useState<{ id: string; notes: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [salesRes, wishRes, notifRes] = await Promise.all([
      supabase.from('sales').select('*').order('date', { ascending: false }),
      supabase.from('wishlists').select('*').order('created_at', { ascending: false }),
      supabase.from('wishlist_notifications').select('*').eq('dismissed', false).order('created_at', { ascending: false }),
    ]);

    const allSales = salesRes.data || [];
    setSales(allSales);
    setWishlists(wishRes.data || []);
    setNotifications(notifRes.data || []);

    // Sync customers from sales
    const grouped: Record<string, Sale[]> = {};
    allSales.forEach(s => {
      if (!grouped[s.buyer_name]) grouped[s.buyer_name] = [];
      grouped[s.buyer_name].push(s);
    });

    const synced: Customer[] = [];
    for (const [name, customerSales] of Object.entries(grouped)) {
      const totalSpent = customerSales.reduce((sum, s) => sum + s.sale_price, 0);
      const totalOrders = customerSales.length;
      const dates = customerSales.map(s => s.date).sort();
      const firstPurchaseDate = dates[0];
      const lastPurchaseDate = dates[dates.length - 1];
      const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

      // Upsert
      const { data: existing } = await supabase.from('customers').select('*').eq('name', name).limit(1).single();
      if (existing) {
        await supabase.from('customers').update({
          total_spent: parseFloat(totalSpent.toFixed(2)),
          total_orders: totalOrders,
          first_purchase_date: firstPurchaseDate,
          last_purchase_date: lastPurchaseDate,
          average_order_value: parseFloat(averageOrderValue.toFixed(2)),
        }).eq('id', existing.id);
        synced.push({ ...existing, total_spent: totalSpent, total_orders: totalOrders, first_purchase_date: firstPurchaseDate, last_purchase_date: lastPurchaseDate, average_order_value: averageOrderValue });
      } else {
        const { data: newCust } = await supabase.from('customers').insert({
          name,
          total_spent: parseFloat(totalSpent.toFixed(2)),
          total_orders: totalOrders,
          first_purchase_date: firstPurchaseDate,
          last_purchase_date: lastPurchaseDate,
          average_order_value: parseFloat(averageOrderValue.toFixed(2)),
          notes: '',
        }).select().single();
        if (newCust) synced.push(newCust);
      }
    }

    // Also load any customers that have no sales but exist in DB (e.g. manual)
    const { data: allCusts } = await supabase.from('customers').select('*').order('total_spent', { ascending: false });
    setCustomers(allCusts || synced);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function daysSince(dateStr: string) {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  }

  // Smart lists
  const vipThreshold = customers.length > 0
    ? [...customers].sort((a, b) => b.total_spent - a.total_spent)[Math.floor(customers.length * 0.2)]?.total_spent || 0
    : 0;

  function getCustomerTag(c: Customer): 'vip' | 'active' | 'cold' {
    if (c.total_spent >= vipThreshold && vipThreshold > 0) return 'vip';
    if (daysSince(c.last_purchase_date) <= 60) return 'active';
    return 'cold';
  }

  const filtered = customers
    .filter(c => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (tab === 'vips') return getCustomerTag(c) === 'vip';
      if (tab === 'active') return daysSince(c.last_purchase_date) <= 60;
      if (tab === 'cold') return daysSince(c.last_purchase_date) > 60;
      return true;
    });

  const tabCounts = {
    all: customers.length,
    vips: customers.filter(c => getCustomerTag(c) === 'vip').length,
    active: customers.filter(c => daysSince(c.last_purchase_date) <= 60).length,
    cold: customers.filter(c => daysSince(c.last_purchase_date) > 60).length,
  };

  function getCustomerSales(name: string) {
    return sales.filter(s => s.buyer_name === name);
  }

  function getCustomerWishlists(customerId: string) {
    return wishlists.filter(w => w.customer_id === customerId);
  }

  async function handleAddWishlist() {
    if (!wishlistModal || !wishlistPlant.trim()) return;
    await supabase.from('wishlists').insert({
      customer_id: wishlistModal.customerId,
      plant_name: wishlistPlant.trim(),
      date_added: new Date().toISOString().split('T')[0],
      notified: false,
      notes: wishlistNote.trim(),
    });
    setWishlistModal(null);
    setWishlistPlant('');
    setWishlistNote('');
    loadData();
  }

  async function handleSaveNotes(id: string, notes: string) {
    await supabase.from('customers').update({ notes }).eq('id', id);
    setEditingNotes(null);
    loadData();
  }

  async function handleDismissNotification(id: string) {
    await supabase.from('wishlist_notifications').update({ dismissed: true }).eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  function getBadge(tag: 'vip' | 'active' | 'cold') {
    if (tag === 'vip') return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400 font-body">VIP 🦩</span>;
    if (tag === 'active') return <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 font-body">Active</span>;
    return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-500/20 text-gray-400 font-body">Cold ({daysSince(filtered.find(c => getCustomerTag(c) === 'cold')?.last_purchase_date || '')}d)</span>;
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <h1 className="font-heading text-3xl text-hot-pink mb-6">Customers</h1>

        {/* Wishlist Notifications Banner */}
        {notifications.length > 0 && (
          <div className="mb-4 space-y-2">
            {notifications.map(n => (
              <div key={n.id} className="border-2 border-hot-pink rounded-xl bg-hot-pink/10 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🦩</span>
                  <span className="text-white font-body text-sm">
                    <strong className="text-hot-pink">{n.matched_customers}</strong> customer(s) are waiting for <strong className="text-tropical-leaf">{n.plant_name}</strong> — generate emails?
                  </span>
                </div>
                <div className="flex gap-2">
                  <a href={`/emails?plant=${encodeURIComponent(n.plant_name)}&type=wishlist`}
                    className="px-3 py-1 bg-hot-pink hover:bg-flamingo-blush text-white text-xs font-heading rounded-lg transition-colors">
                    Generate Emails
                  </a>
                  <button onClick={() => handleDismissNotification(n.id!)}
                    className="px-3 py-1 bg-warm-wood/30 hover:bg-warm-wood/50 text-white text-xs font-body rounded-lg transition-colors cursor-pointer">
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {([
            { key: 'all' as Tab, label: 'All Customers' },
            { key: 'vips' as Tab, label: 'VIPs' },
            { key: 'active' as Tab, label: 'Active' },
            { key: 'cold' as Tab, label: 'Cold' },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-heading transition-colors cursor-pointer ${
                tab === t.key
                  ? 'bg-hot-pink text-white'
                  : 'bg-deep-jungle/40 text-flamingo-blush hover:bg-deep-jungle/60 border border-tropical-leaf/20'
              }`}>
              {t.label} ({tabCounts[t.key]})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..."
            className="w-full max-w-md px-4 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-hot-pink font-body text-sm" />
        </div>

        {loading ? (
          <div className="text-flamingo-blush animate-pulse font-body">Syncing customer data...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-flamingo-blush/50 font-body">
            {search ? 'No matching customers found.' : 'No customers yet. Log some sales first!'}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(customer => {
              const tag = getCustomerTag(customer);
              const isExpanded = expandedId === customer.id;
              const custSales = getCustomerSales(customer.name);
              const custWishlists = customer.id ? getCustomerWishlists(customer.id) : [];

              return (
                <div key={customer.id} className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl overflow-hidden">
                  {/* Summary row */}
                  <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button onClick={() => setExpandedId(isExpanded ? null : customer.id!)}
                        className="text-flamingo-blush hover:text-white cursor-pointer text-sm">
                        {isExpanded ? '▼' : '▶'}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-heading text-lg truncate">{customer.name}</span>
                          {tag === 'vip' && <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400 font-body">VIP 🦩</span>}
                          {tag === 'active' && <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 font-body">Active</span>}
                          {tag === 'cold' && <span className="px-2 py-0.5 text-xs rounded-full bg-gray-500/20 text-gray-400 font-body">Cold ({daysSince(customer.last_purchase_date)}d)</span>}
                        </div>
                        <div className="text-xs text-flamingo-blush/60 font-body">
                          {customer.total_orders} orders &middot; ${customer.total_spent.toFixed(2)} spent &middot; Avg ${customer.average_order_value.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <a href={`/emails?customer=${encodeURIComponent(customer.name)}`}
                        className="px-3 py-1.5 bg-hot-pink/20 hover:bg-hot-pink/30 border border-hot-pink/40 text-hot-pink text-xs font-heading rounded-lg transition-colors">
                        Generate Email
                      </a>
                      <button onClick={() => setWishlistModal({ customerId: customer.id!, name: customer.name })}
                        className="px-3 py-1.5 bg-tropical-leaf/20 hover:bg-tropical-leaf/30 border border-tropical-leaf/40 text-tropical-leaf text-xs font-heading rounded-lg transition-colors cursor-pointer">
                        Add to Wishlist
                      </button>
                      <button onClick={() => setExpandedId(isExpanded ? null : customer.id!)}
                        className="px-3 py-1.5 bg-warm-wood/20 hover:bg-warm-wood/30 border border-warm-wood/40 text-warm-wood text-xs font-heading rounded-lg transition-colors cursor-pointer">
                        View Profile
                      </button>
                    </div>
                  </div>

                  {/* Expanded profile */}
                  {isExpanded && (
                    <div className="border-t border-tropical-leaf/20 p-4 bg-dark-bg/30">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Purchase History */}
                        <div>
                          <h3 className="font-heading text-sm text-hot-pink mb-2">Purchase History</h3>
                          {custSales.length === 0 ? (
                            <p className="text-flamingo-blush/50 text-xs font-body">No purchases found.</p>
                          ) : (
                            <div className="overflow-x-auto bg-dark-bg/50 rounded-lg">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-tropical-leaf/20">
                                    <th className="px-2 py-2 text-left text-flamingo-blush font-body">Plant</th>
                                    <th className="px-2 py-2 text-left text-flamingo-blush font-body">Price</th>
                                    <th className="px-2 py-2 text-left text-flamingo-blush font-body">Profit</th>
                                    <th className="px-2 py-2 text-left text-flamingo-blush font-body">Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {custSales.map(s => (
                                    <tr key={s.id} className="border-b border-tropical-leaf/10">
                                      <td className="px-2 py-1.5 text-white font-body">{s.plant_name}</td>
                                      <td className="px-2 py-1.5 text-white font-body">${s.sale_price.toFixed(2)}</td>
                                      <td className={`px-2 py-1.5 font-heading ${s.true_profit >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>
                                        ${s.true_profit.toFixed(2)}
                                      </td>
                                      <td className="px-2 py-1.5 text-flamingo-blush/60 font-body">{s.date}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Plants bought list */}
                          <div className="mt-3">
                            <h4 className="text-xs text-flamingo-blush/60 font-body mb-1">Plants Bought:</h4>
                            <div className="flex flex-wrap gap-1">
                              {[...new Set(custSales.map(s => s.plant_name))].map(p => (
                                <span key={p} className="px-2 py-0.5 bg-tropical-leaf/10 text-tropical-leaf text-xs rounded font-body">{p}</span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Wishlist & Notes */}
                        <div>
                          <h3 className="font-heading text-sm text-hot-pink mb-2">Wishlist</h3>
                          {custWishlists.length === 0 ? (
                            <p className="text-flamingo-blush/50 text-xs font-body mb-4">No wishlist items yet.</p>
                          ) : (
                            <div className="space-y-1 mb-4">
                              {custWishlists.map(w => (
                                <div key={w.id} className="flex items-center justify-between bg-dark-bg/50 rounded px-3 py-2">
                                  <div>
                                    <span className="text-white text-sm font-body">{w.plant_name}</span>
                                    {w.notes && <span className="text-flamingo-blush/50 text-xs font-body ml-2">— {w.notes}</span>}
                                  </div>
                                  <span className="text-flamingo-blush/40 text-xs font-body">{w.date_added}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <h3 className="font-heading text-sm text-hot-pink mb-2">Notes</h3>
                          {editingNotes && editingNotes.id === customer.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editingNotes.notes}
                                onChange={e => setEditingNotes({ id: editingNotes.id, notes: e.target.value })}
                                className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white font-body text-sm focus:outline-none focus:border-hot-pink"
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <button onClick={() => handleSaveNotes(customer.id!, editingNotes.notes)}
                                  className="px-3 py-1 bg-hot-pink hover:bg-flamingo-blush text-white text-xs font-heading rounded transition-colors cursor-pointer">
                                  Save
                                </button>
                                <button onClick={() => setEditingNotes(null)}
                                  className="px-3 py-1 bg-warm-wood/30 text-white text-xs font-body rounded cursor-pointer">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-dark-bg/50 rounded px-3 py-2 min-h-[40px] cursor-pointer"
                              onClick={() => setEditingNotes({ id: customer.id!, notes: customer.notes || '' })}>
                              {customer.notes ? (
                                <p className="text-white text-sm font-body">{customer.notes}</p>
                              ) : (
                                <p className="text-flamingo-blush/40 text-xs font-body italic">Click to add notes...</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add to Wishlist Modal */}
        {wishlistModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-deep-jungle border border-tropical-leaf/30 rounded-xl p-6 w-full max-w-md">
              <h3 className="font-heading text-xl text-hot-pink mb-2">Add to Wishlist</h3>
              <p className="text-flamingo-blush text-sm font-body mb-4">
                Adding wishlist item for <strong>{wishlistModal.name}</strong>
              </p>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm text-flamingo-blush mb-1 font-body">Plant Name *</label>
                  <input value={wishlistPlant} onChange={e => setWishlistPlant(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm"
                    autoFocus />
                </div>
                <div>
                  <label className="block text-sm text-flamingo-blush mb-1 font-body">Note (optional)</label>
                  <input value={wishlistNote} onChange={e => setWishlistNote(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleAddWishlist} disabled={!wishlistPlant.trim()}
                  className="px-4 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading rounded-lg transition-colors cursor-pointer disabled:opacity-50">
                  Add
                </button>
                <button onClick={() => { setWishlistModal(null); setWishlistPlant(''); setWishlistNote(''); }}
                  className="px-4 py-2 bg-warm-wood/30 hover:bg-warm-wood/50 text-white font-body rounded-lg transition-colors cursor-pointer text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
