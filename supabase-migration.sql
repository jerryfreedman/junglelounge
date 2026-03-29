-- =====================================================
-- FLIPPI MULTI-TENANT MIGRATION
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =====================================================

-- 1. Create profiles table (links to Supabase Auth users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL DEFAULT 'My Business',
  business_type text DEFAULT 'reseller',
  platform_name text DEFAULT '',
  email text,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, business_name)
  VALUES (NEW.id, NEW.email, 'My Business');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Add user_id to all existing tables
ALTER TABLE batches ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE streams ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE email_drafts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add user_id to these if they exist
DO $$ BEGIN
  ALTER TABLE wishlists ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE wishlist_notifications ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 4. Enable Row Level Security on ALL tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE wishlist_notifications ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 5. RLS Policies — users can only see/modify their own data

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Batches
CREATE POLICY "Users can view own batches" ON batches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own batches" ON batches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own batches" ON batches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own batches" ON batches FOR DELETE USING (auth.uid() = user_id);

-- Sales
CREATE POLICY "Users can view own sales" ON sales FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sales" ON sales FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sales" ON sales FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sales" ON sales FOR DELETE USING (auth.uid() = user_id);

-- Settings
CREATE POLICY "Users can view own settings" ON settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON settings FOR UPDATE USING (auth.uid() = user_id);

-- Customers
CREATE POLICY "Users can view own customers" ON customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own customers" ON customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own customers" ON customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own customers" ON customers FOR DELETE USING (auth.uid() = user_id);

-- Streams
CREATE POLICY "Users can view own streams" ON streams FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own streams" ON streams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streams" ON streams FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own streams" ON streams FOR DELETE USING (auth.uid() = user_id);

-- Email Drafts
CREATE POLICY "Users can view own email_drafts" ON email_drafts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own email_drafts" ON email_drafts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own email_drafts" ON email_drafts FOR DELETE USING (auth.uid() = user_id);

-- Wishlists (if exists)
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "Users can view own wishlists" ON wishlists FOR SELECT USING (auth.uid() = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own wishlists" ON wishlists FOR INSERT WITH CHECK (auth.uid() = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own wishlists" ON wishlists FOR UPDATE USING (auth.uid() = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own wishlists" ON wishlists FOR DELETE USING (auth.uid() = user_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY "Users can view own wishlist_notifications" ON wishlist_notifications FOR SELECT USING (auth.uid() = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own wishlist_notifications" ON wishlist_notifications FOR INSERT WITH CHECK (auth.uid() = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own wishlist_notifications" ON wishlist_notifications FOR UPDATE USING (auth.uid() = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own wishlist_notifications" ON wishlist_notifications FOR DELETE USING (auth.uid() = user_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_batches_user_id ON batches(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_streams_user_id ON streams(user_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_user_id ON email_drafts(user_id);

-- 7. Fix unique constraint on customers — must be per-user, not global
-- Drop old unique constraint on name alone (if exists)
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_name_key;
-- Create composite unique constraint: name + user_id
ALTER TABLE customers ADD CONSTRAINT customers_name_user_unique UNIQUE (name, user_id);

-- Done! Now enable Email Auth in Supabase Dashboard:
-- Authentication > Providers > Email > Enable
-- (Disable "Confirm email" for easier testing)
