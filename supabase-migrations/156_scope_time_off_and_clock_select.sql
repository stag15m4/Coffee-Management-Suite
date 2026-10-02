-- Migration 156: Scope time_off_requests and time_clock_entries SELECT to
-- self-or-approver, instead of every tenant member.
--
-- Both tables' only live SELECT policy ("Users can view time off requests" /
-- "Users can view time clock entries", from migration 071) is tenant-wide
-- with no role check: any logged-in employee's own Supabase session can
-- already read every coworker's time-off reason/review notes and every
-- coworker's clock-in/out times, regardless of what the app's UI chooses to
-- render. Confirmed via a full migration replay: unlike equipment, these two
-- tables have no hidden leftover permissive policy, so this is a direct,
-- safe swap.
--
-- The new floor matches each table's own existing UPDATE policy so the
-- approval features already built on top of it (lead approves time off,
-- manager corrects time clock entries) keep working unchanged:
--   - time_off_requests:   self OR lead+   (matches "Employees and leads can update time off")
--   - time_clock_entries:  self OR manager+ (matches "Managers can update clock entries")

DROP POLICY IF EXISTS "Users can view time off requests" ON time_off_requests;
CREATE POLICY "Users can view time off requests" ON time_off_requests
    FOR SELECT USING (
        can_read_tenant_data(tenant_id)
        AND (
            employee_id = auth.uid()
            OR has_role_or_higher('lead'::user_role)
        )
    );

DROP POLICY IF EXISTS "Users can view time clock entries" ON time_clock_entries;
CREATE POLICY "Users can view time clock entries" ON time_clock_entries
    FOR SELECT USING (
        can_read_tenant_data(tenant_id)
        AND (
            employee_id = auth.uid()
            OR has_role_or_higher('manager'::user_role)
        )
    );
