-- Migration 164: Tip employee email addresses, for emailing tip payout statements
-- Lets a tenant record an email for each tipped employee independent of whether
-- that employee has a CMS login (tip_employees.user_profile_id), since most
-- tipped staff never log into CMS themselves but still need a statement.

ALTER TABLE tip_employees ADD COLUMN IF NOT EXISTS email TEXT;
