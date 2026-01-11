-- =====================================================
-- ADD COST FIELD TO MAINTENANCE LOGS
-- Allows tracking maintenance costs
-- =====================================================

-- Add cost column to maintenance_logs table
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS cost DECIMAL(10, 2) DEFAULT NULL;

-- =====================================================
-- SUCCESS
-- Run this in Supabase SQL editor
-- =====================================================
