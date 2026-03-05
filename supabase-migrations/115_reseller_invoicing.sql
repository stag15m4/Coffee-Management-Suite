-- Migration: Reseller Invoicing System
-- Adds wholesale pricing fields to resellers and creates reseller_invoices table

-- Add wholesale pricing columns to resellers
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS wholesale_rate_per_seat NUMERIC(10,2) DEFAULT 0;
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS card_surcharge_percent NUMERIC(5,2) DEFAULT 4.00;

-- Create reseller invoices table
CREATE TABLE IF NOT EXISTS reseller_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  payment_method TEXT,
  billable_seats INTEGER NOT NULL,
  rate_per_seat NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  surcharge_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Constraints
ALTER TABLE reseller_invoices ADD CONSTRAINT reseller_invoices_status_check
  CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void'));

ALTER TABLE reseller_invoices ADD CONSTRAINT reseller_invoices_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('ach', 'card', 'check', 'other'));

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_reseller_invoices_reseller_id ON reseller_invoices(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_invoices_stripe_id ON reseller_invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

-- RLS policies: Platform admins only
ALTER TABLE reseller_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view reseller invoices"
  ON reseller_invoices FOR SELECT
  USING (is_platform_admin());

CREATE POLICY "Platform admins can insert reseller invoices"
  ON reseller_invoices FOR INSERT
  WITH CHECK (is_platform_admin());

CREATE POLICY "Platform admins can update reseller invoices"
  ON reseller_invoices FOR UPDATE
  USING (is_platform_admin());

CREATE POLICY "Platform admins can delete reseller invoices"
  ON reseller_invoices FOR DELETE
  USING (is_platform_admin());

-- Sequence for invoice numbers per year
CREATE SEQUENCE IF NOT EXISTS reseller_invoice_number_seq START 1;

-- Helper function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_val INTEGER;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  next_val := nextval('reseller_invoice_number_seq');
  RETURN 'INV-' || current_year || '-' || LPAD(next_val::TEXT, 4, '0');
END;
$$;
