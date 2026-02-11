-- Add image_url column to maintenance_tasks so tasks can have their own image
-- (e.g. a burr assembly photo vs the grinder equipment photo)
ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS image_url TEXT;
