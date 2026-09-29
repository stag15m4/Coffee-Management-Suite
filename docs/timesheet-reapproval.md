# Timesheet reapproval

## Deployment

Apply `supabase-migrations/152_timesheet_reapproval.sql` in Supabase SQL Editor after migrations 150 and 151. Run the complete transaction, confirm success, then merge/deploy the matching app PR. Old browser versions cannot approve until refreshed because direct writes to approvals are revoked.

Existing approved periods are moved to pending once during this migration. Their previous approval is retained in `timesheet_approval_history`. They need a fresh review because previous approvals did not check a record snapshot or record the period timezone. This does not change recorded punches or previously downloaded files.

## Behavior

- Adding, deleting, or changing recorded punches or breaks resets each affected approved period to pending. Moving a session between periods affects both. Notes-only changes do not reset approval. Pending staff proposals do not change official records; approval of their proposed time does.
- Managers and staff see **Needs reapproval** on affected timesheets. Approval queries refresh after local writes, on focus, and every 30 seconds. Database checks are authoritative even while a displayed badge is stale.
- Approval checks the exact records the manager reviewed, rejects open sessions/breaks and unresolved correction requests, and calculates recorded hours in the database. Tenant-level transaction locks serialize official time changes with approval and export validation. These locks are brief and do not lock a completed pay period against later edits.
- Approval history is retained with actor, timestamp, and previous/new values. The database history is available for audit; the existing UI shows the current status and punch-edit history, not a separate approval-history browser.
- Gusto CSV checks current approvals and record versions before fetching tips and immediately before download. Every included timesheet must have current approval, with no pending corrections. Hours are divided at local day/week boundaries so overnight sessions do not spill into the wrong export period. A downloaded file remains a snapshot; edits afterward require generating a new export.
- Ordinary CSV downloads remain available as clearly labeled **review copies**, with a Record Type column. They do not claim payroll approval.
- PTO accrual runs only on the first successful approval of a period. Reapproval does not award the full accrual again. Any PTO adjustment after corrected hours, or retry of a failed first accrual, requires separate balance review. Existing accrual is not automatically reversed or reconciled by this release.

## Validation and remaining work

PostgreSQL/PGlite tests load the actual migrations and exercise punch/break invalidation, rollback, stale snapshots, period moves, authorization, approval history, export blocking, and repeat approvals. They run serially; production concurrency/load and live-device behavior still need verification after deployment.

The app currently uses the viewer's local timezone for period display; approval records that timezone and export requires the same. A tenant-wide payroll timezone remains a separate improvement. Legacy approvals are invalidated conservatively across adjacent dates until reviewed with an explicit timezone.

This is an approval safeguard, not complete Gusto certification. Tip allocation/name mapping, paid-break rules, PTO reconciliation, and Gusto's accepted CSV format still need validation before replacing the current payroll workflow. There is no Gusto API integration.
