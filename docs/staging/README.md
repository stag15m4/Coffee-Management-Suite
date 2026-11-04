# CMS staging database — October 30, 2026

Project: CMS Staging (`iuugcktfbpdlljmmpfrl`), us-west-2, PostgreSQL 17.11.
Production project `tfsostlmjmmggomoejpx` was queried for schema metadata only and was not modified.

## Installed
- S001: 105 public tables, 7 enums, 2 fresh sequences, 409 constraints, 200 additional indexes, 61 functions, 35 public-table triggers, 439 RLS policies, 4 views.
- S002: fixed lookup paths on 9 functions and revoked browser execution of trigger/internal or unreviewed parameterized routines.
- S003 fixture script: two fictional cafes, three database-only Auth identities (two managers and one employee), two branding records, two tip employees, two synthetic audit events.
- All 105 tables have RLS enabled. No production records, credentials, OAuth tokens, passwords, Storage files, or job schedules were copied.
- Auth test identities have no password or confirmed email and are not browser-login accounts. Generated kiosk codes/PINs are test-only and must not be used for production.

## Verification
V001 passed on the hosted staging database using SET LOCAL ROLE plus transaction-local JWT claims. This is a database authorization test, not an HTTP/login test.
- Both managers see only their own cafe's audit row and tip employee.
- Employees see no audit rows; anonymous audit reads denied.
- Authenticated audit insert/update/delete denied.
- Service role audit insertion succeeds, deletion denied.
- Browser/service audit TRUNCATE absent; all public tables RLS enabled.
- Verification writes rolled back; only the two fixture audit events remain.

## Deliberate differences from production
This is a security-test baseline, not an exact environment clone.
- Anonymous table/function access revoked.
- Browser table privileges limited to existing SELECT/INSERT/UPDATE/DELETE grants, excluding TRUNCATE/REFERENCES/TRIGGER/MAINTAIN.
- All views use security_invoker=true, including user_pay_rates. Pay-rate UI behavior still requires testing.
- Authenticated access to internal/unreviewed functions is restricted in S002. Workflows that use those routines require review before enabling.
- Original production function grants often included PUBLIC and anon; those were not copied.
- Auth-schema triggers, Storage configuration/policies/files, Realtime publications, extensions beyond standard managed dependencies, Auth configuration, and external integration configuration are not cloned.
- Reference/catalog rows such as modules, pricing plans, verticals and product categories are not copied or seeded yet. Full app startup/onboarding is NOT verified.
- The historical numbered migration directory is not a reproducible fresh-install baseline: 002 expects preexisting tables, 005 contains placeholders, and some live schema objects are absent from that history.

## Outstanding
Latest Supabase security scan: 28 signed-in SECURITY DEFINER function warnings, 1 leaked-password-protection warning, 3 informational RLS-with-no-policy findings. No error-level findings returned.
The three no-policy tables are alfred_confirmation_tokens, compliance_workflow_receipts and connecteam_settings; keep server-only access and review intended behavior.
Privileged functions still need authorization review; necessary RLS helpers must not be blindly changed to invoker.
References:
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/auth/password-security

Next: seed required non-sensitive app catalog data; configure separate Railway staging service and test-only secrets; establish browser login; test authentication, pay visibility, schedules, atomic tip approvals, and QuickBooks sandbox OAuth. No live integrations, deployment, merge, paid backup upgrade, or Gusto certification completed.

## Scripts
These scripts are intentionally outside the production migration directory.
S001 requires an EMPTY public schema and must only run against the staging project. Do not replay on production or an already populated database.
S002 follows S001. S003 is a one-time fixture seed, not idempotent. V001 may be rerun and rolls back its writes.
Remote migration history records S001/S002; S003 was a data-only SQL operation.
