# Audited work sessions

This release adds complete session editing, multiple breaks, additional sessions on one day, staff missing-session requests, and a retained change history.

## Deployment

1. Apply `supabase-migrations/151_audited_work_sessions.sql` in the CMS Supabase SQL Editor. Copy the entire file, including `BEGIN` and `COMMIT`. Migration 150 must already be installed.
2. Confirm success before merging the application PR. Migration 151 is additive and records changes made by the existing application while the new version deploys. It also routes existing correction approvals through the audited save.
3. Deploy the matching application, refresh, and test a manager edit and one staff missing-session request.

The migration was exercised with PGlite PostgreSQL using the existing migration 150 and representative time-clock tables. Production schema and live tablet interaction still require deployment verification.

## Expected behavior

- Manager: choose **Add work session** on any date, including dates with existing sessions. Enter actual dates, times, breaks, and a reason. Each save writes the entire session and its audit events in one transaction.
- Staff: choose **Request missed session**. Proposed hours remain outside official totals. Managers find requests on Today and the employee timesheet. Approving adds the session and changes request status together.
- The server rejects overlapping recorded sessions in the session-save workflow, invalid break ranges, and a stale editor version. Break writes update the parent version too.
- Edit an overnight session using its full dates, even when the table displays it across separate calendar rows.
- **Show change history** displays the latest 100 events for the employee across pay periods. The database retains all events. It does not reconstruct changes made before installation.
- Deletion requires a reason and retains audit snapshots. Sessions with existing punch-correction requests cannot be deleted; the UI reports that restriction.

## Boundaries

- Normal clock/kiosk/integration writes are recorded too. Server writes without a signed-in database identity appear as system/integration/kiosk, not as a falsely attributed manager action.
- Old-client direct manager edits are captured but may have no reason. The new editor requires one.
- Migration 152 adds automatic approval invalidation and guarded reapproval; see `timesheet-reapproval.md`.
- Employees represented only as tip/kiosk identities still need the planned unified staff identity work to use account-based requests.
- Overlap checks are in the session-save/approval functions; existing integration import paths are not changed into a global overlap constraint.
