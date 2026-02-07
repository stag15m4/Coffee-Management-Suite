-- Add per-recipe overhead time override
-- NULL means use the global default from overhead_settings.minutes_per_drink
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS minutes_per_drink DECIMAL(5,2) DEFAULT NULL;
