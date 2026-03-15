-- Migration 135: Add is_admin_only to admin_tasks and assigned_to on equipment
-- 1) Admin Only tasks cannot be delegated (assigned_to is cleared)
-- 2) Equipment (especially vehicles) can be assigned to an employee

-- Admin Only flag for tasks
ALTER TABLE admin_tasks ADD COLUMN IF NOT EXISTS is_admin_only boolean NOT NULL DEFAULT false;

-- Equipment assignment to an employee (user_profiles.id)
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Index for quick lookup of equipment by assignee
CREATE INDEX IF NOT EXISTS idx_equipment_assigned_to ON equipment (assigned_to) WHERE assigned_to IS NOT NULL;
