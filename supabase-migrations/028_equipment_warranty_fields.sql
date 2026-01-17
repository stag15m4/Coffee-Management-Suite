-- Add warranty fields to equipment table
ALTER TABLE equipment 
ADD COLUMN IF NOT EXISTS has_warranty BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS purchase_date DATE,
ADD COLUMN IF NOT EXISTS warranty_duration_months INTEGER,
ADD COLUMN IF NOT EXISTS warranty_notes TEXT;

COMMENT ON COLUMN equipment.has_warranty IS 'Whether this equipment has a warranty';
COMMENT ON COLUMN equipment.purchase_date IS 'Date the equipment was purchased';
COMMENT ON COLUMN equipment.warranty_duration_months IS 'Duration of warranty in months from purchase date';
COMMENT ON COLUMN equipment.warranty_notes IS 'Notes about warranty specifics or coverage details';
