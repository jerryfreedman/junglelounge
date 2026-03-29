import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Auth helpers ──

/** Get the current logged-in user's ID, or null if not logged in */
export async function getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Get the current user's ID or throw if not logged in */
export async function requireUserId(): Promise<string> {
  const uid = await getUserId();
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

/** Get the current user's profile */
export interface Profile {
  id: string;
  business_name: string;
  business_type: string;
  platform_name: string;
  email: string;
  created_at?: string;
}

export async function getProfile(): Promise<Profile | null> {
  const uid = await getUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();
  if (error) return null;
  return data as Profile;
}

export async function updateProfile(updates: Partial<Profile>): Promise<Profile> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', uid)
    .select()
    .single();
  if (error) throw new Error(`Failed to update profile: ${error.message}`);
  return data as Profile;
}

// ── Types ──

export interface Batch {
  id?: string;
  user_id?: string;
  name: string;
  supplier: string;
  quantity: number;
  total_cost: number;
  cost_per_plant: number;
  reorder_threshold: number;
  date: string;
  notes: string;
  created_at?: string;
}

export interface Sale {
  id?: string;
  user_id?: string;
  batch_id: string | null;
  plant_name: string;
  buyer_name: string;
  sale_price: number;
  cost_per_plant: number;
  shipping_cost: number;
  shipping_covered_by_us: boolean;
  palmstreet_fee_amount: number;
  refunded: boolean;
  refund_amount: number;
  true_profit: number;
  true_margin_pct: number;
  date: string;
  notes: string;
  stream_id: string | null;
  created_at?: string;
}

export interface Settings {
  id?: string;
  user_id?: string;
  palmstreet_fee_pct: number;
  created_at?: string;
}

export interface Customer {
  id?: string;
  user_id?: string;
  name: string;
  total_spent: number;
  total_orders: number;
  first_purchase_date: string;
  last_purchase_date: string;
  average_order_value: number;
  notes: string;
  created_at?: string;
}

export interface Wishlist {
  id?: string;
  user_id?: string;
  customer_id: string;
  plant_name: string;
  date_added: string;
  notified: boolean;
  notes: string;
  created_at?: string;
}

export interface WishlistNotification {
  id?: string;
  user_id?: string;
  batch_id: string;
  plant_name: string;
  matched_customers: number;
  dismissed: boolean;
  created_at?: string;
}

export interface Stream {
  id?: string;
  user_id?: string;
  name: string;
  date: string;
  notes: string;
  viewer_count: number | null;
  total_revenue: number;
  total_cost: number;
  true_profit: number;
  true_margin_pct: number;
  total_plants_listed: number;
  total_plants_sold: number;
  sell_through_rate: number;
  average_sale_price: number;
  created_at?: string;
}

export interface EmailDraft {
  id?: string;
  user_id?: string;
  customer_name: string;
  email_type: string;
  custom_note: string;
  content: string;
  created_at?: string;
}

// ── Shared helpers ──

/** Ensure a settings row exists for the current user and return it */
export async function ensureSettings(): Promise<Settings> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', uid)
    .limit(1)
    .single();

  if (error && error.code === 'PGRST116') {
    // No row yet — create the default for this user
    const { data: newRow, error: insertErr } = await supabase
      .from('settings')
      .insert({ palmstreet_fee_pct: 0, user_id: uid })
      .select()
      .single();
    if (insertErr) throw new Error(`Failed to seed settings: ${insertErr.message}`);
    return newRow as Settings;
  }
  if (error) throw new Error(`Failed to load settings: ${error.message}`);
  return data as Settings;
}

/** Wrapper that checks Supabase response and throws on error */
export function checkSupabaseError<T>(
  result: { data: T | null; error: { message: string; code?: string } | null },
  context: string
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data as T;
}
