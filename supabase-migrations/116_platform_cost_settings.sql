-- Migration: Platform Cost Settings
-- Stores monthly cost breakdown for platform analytics dashboard

CREATE TABLE IF NOT EXISTS platform_cost_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hosting NUMERIC(10,2) DEFAULT 0,
  supabase NUMERIC(10,2) DEFAULT 0,
  stripe_fee_percent NUMERIC(5,2) DEFAULT 2.9,
  support_labor NUMERIC(10,2) DEFAULT 0,
  other NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- RLS: Platform admins only
ALTER TABLE platform_cost_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view cost settings"
  ON platform_cost_settings FOR SELECT
  USING (is_platform_admin());

CREATE POLICY "Platform admins can insert cost settings"
  ON platform_cost_settings FOR INSERT
  WITH CHECK (is_platform_admin());

CREATE POLICY "Platform admins can update cost settings"
  ON platform_cost_settings FOR UPDATE
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Seed a single row with defaults
INSERT INTO platform_cost_settings (hosting, supabase, stripe_fee_percent, support_labor, other)
VALUES (0, 0, 2.9, 0, 0);
