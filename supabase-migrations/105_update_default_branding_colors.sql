-- Update default branding colors to a clean, neutral palette
-- Old defaults: primary=#C9A227, secondary=#4A3728, accent=#F5F0E1, background=#FFFDF7
-- New defaults: primary=#334155, secondary=#0F172A, accent=#F1F5F9, background=#FFFFFF

-- Update column defaults for future inserts
ALTER TABLE tenant_branding
  ALTER COLUMN primary_color SET DEFAULT '#334155',
  ALTER COLUMN secondary_color SET DEFAULT '#0F172A',
  ALTER COLUMN accent_color SET DEFAULT '#F1F5F9',
  ALTER COLUMN background_color SET DEFAULT '#FFFFFF';

-- Update existing rows that still have the old defaults
UPDATE tenant_branding
SET
  primary_color = '#334155',
  secondary_color = '#0F172A',
  accent_color = '#F1F5F9',
  background_color = '#FFFFFF',
  updated_at = NOW()
WHERE
  primary_color = '#C9A227'
  AND secondary_color = '#4A3728'
  AND accent_color = '#F5F0E1'
  AND background_color = '#FFFDF7';
