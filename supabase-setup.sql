-- Jungle Lounge Intel - Supabase Table Setup
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  palmstreet_fee_pct numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Batches table (inventory)
CREATE TABLE IF NOT EXISTS batches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  supplier text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  cost_per_plant numeric NOT NULL DEFAULT 0,
  reorder_threshold integer DEFAULT 3,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
  created_at timestamp with time zone DEFAULT now()
);

-- Streams table
CREATE TABLE IF NOT EXISTS streams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
  viewer_count integer,
  total_revenue numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  true_profit numeric DEFAULT 0,
  true_margin_pct numeric DEFAULT 0,
  total_plants_listed integer DEFAULT 0,
  total_plants_sold integer DEFAULT 0,
  sell_through_rate numeric DEFAULT 0,
  average_sale_price numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  plant_name text NOT NULL,
  buyer_name text NOT NULL,
  sale_price numeric NOT NULL DEFAULT 0,
  cost_per_plant numeric DEFAULT 0,
  shipping_cost numeric DEFAULT 0,
  shipping_covered_by_us boolean DEFAULT false,
  palmstreet_fee_amount numeric DEFAULT 0,
  refunded boolean DEFAULT false,
  refund_amount numeric DEFAULT 0,
  true_profit numeric DEFAULT 0,
  true_margin_pct numeric DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
  stream_id uuid REFERENCES streams(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  total_spent numeric DEFAULT 0,
  total_orders integer DEFAULT 0,
  first_purchase_date date,
  last_purchase_date date,
  average_order_value numeric DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamp with time zone DEFAULT now()
);

-- Wishlists table
CREATE TABLE IF NOT EXISTS wishlists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  plant_name text NOT NULL,
  date_added date DEFAULT CURRENT_DATE,
  notified boolean DEFAULT false,
  notes text DEFAULT '',
  created_at timestamp with time zone DEFAULT now()
);

-- Wishlist notifications table
CREATE TABLE IF NOT EXISTS wishlist_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id uuid,
  plant_name text NOT NULL,
  matched_customers integer DEFAULT 0,
  dismissed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Email drafts table
CREATE TABLE IF NOT EXISTS email_drafts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name text NOT NULL,
  email_type text NOT NULL,
  custom_note text DEFAULT '',
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Seed default settings row
INSERT INTO settings (palmstreet_fee_pct)
SELECT 0
WHERE NOT EXISTS (SELECT 1 FROM settings LIMIT 1);

-- Enable Row Level Security but allow all for anon (single user app)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;

-- Policies to allow anon access (single user app)
CREATE POLICY "Allow all on settings" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on batches" ON batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sales" ON sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on streams" ON streams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on wishlists" ON wishlists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on wishlist_notifications" ON wishlist_notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on email_drafts" ON email_drafts FOR ALL USING (true) WITH CHECK (true);
