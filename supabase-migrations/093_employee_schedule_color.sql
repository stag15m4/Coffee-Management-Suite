-- Employee Schedule Color
-- Managers can assign a custom color to each employee for the shift calendar.
-- Falls back to the automatic color palette when NULL.

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS schedule_color TEXT;

ALTER TABLE tip_employees
    ADD COLUMN IF NOT EXISTS schedule_color TEXT;
