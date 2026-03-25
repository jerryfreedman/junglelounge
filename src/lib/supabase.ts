import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export interface Batch {
  id?: string;
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
  palmstreet_fee_pct: number;
  created_at?: string;
}

export interface Customer {
  id?: string;
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
  customer_id: string;
  plant_name: string;
  date_added: string;
  notified: boolean;
  notes: string;
  created_at?: string;
}

export interface WishlistNotification {
  id?: string;
  batch_id: string;
  plant_name: string;
  matched_customers: number;
  dismissed: boolean;
  created_at?: string;
}

export interface Stream {
  id?: string;
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
  customer_name: string;
  email_type: string;
  custom_note: string;
  content: string;
  created_at?: string;
}
