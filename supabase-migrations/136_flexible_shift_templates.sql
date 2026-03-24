-- Migration 136: Make shift templates flexible (day-agnostic, employee-agnostic)
-- Templates become reusable shift definitions: name + time range + optional position.
-- Day and employee are chosen at apply time, not at template creation time.

-- 1. Drop the CHECK constraint on day_of_week
ALTER TABLE shift_templates DROP CONSTRAINT IF EXISTS shift_templates_day_of_week_check;

-- 2. Make day_of_week nullable (no longer required)
ALTER TABLE shift_templates ALTER COLUMN day_of_week DROP NOT NULL;

-- 3. Set existing day_of_week values to NULL (templates are now day-agnostic)
-- Keep existing data intact — they'll just be ignored by the new UI
-- UPDATE shift_templates SET day_of_week = NULL; -- optional: uncomment to clear legacy values
