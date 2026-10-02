-- Migration 158: Promote Personnel (calendar-workforce) out of internal/platform-admin-only status
--
-- Migration 101 marked calendar-workforce rollout_status = 'internal', which
-- get_tenant_enabled_modules() only includes for platform admins
-- ("m.rollout_status = 'internal' AND caller_is_admin"). No later migration
-- ever promoted it. The module has since grown into the heavily-used
-- Schedule/Time Off/Time Clock/Export feature set (migrations 071-157), but
-- for any real tenant user who isn't also a platform admin, it has been
-- silently absent from enabledModules this whole time — not grayed out,
-- just missing from the nav, and /calendar-workforce blocked outright by
-- ProtectedRoute. (A standalone "Hero Clock Button" on the employee
-- dashboard is not gated by canAccessModule, which is why clock in/out kept
-- working for non-admin staff while Schedule, Time Off, and Export did not.)
--
-- Promoting to 'ga' also fires migration 110's auto-register trigger, which
-- backfills subscription_plan_modules for every full-access plan — belt and
-- suspenders on top of the explicit links already added in 071/106.

UPDATE modules SET rollout_status = 'ga' WHERE id = 'calendar-workforce';
