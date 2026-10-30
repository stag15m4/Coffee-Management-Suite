# Audit-log access hardening

Migration: **164**, supports either an existing migration-143 table or a missing audit table. Status: applied manually by Seth in production on 2026-10-30; user-supplied SQL results confirm expected table grants, enabled RLS and both SELECT policies. Nine real approval events confirm the tip-payout writer.

## Boundary enforced

Migration 164 removes the tenant browser INSERT policy and replaces the platform-admin FOR ALL policy with SELECT-only access. It revokes table privileges from PUBLIC, anon, authenticated and service_role, then grants authenticated SELECT and service_role SELECT/INSERT. Revoking privileges also covers TRUNCATE, which row-level security does not control.

Tenant managers/owners retain the existing tenant-scoped SELECT policy. Active platform admins retain cross-tenant reads. Ordinary employees and anonymous sessions cannot read logs. Browser users cannot manufacture events, actor IDs or timestamps, even when they are platform admins. Service-role connections can append/read but cannot update, delete or truncate the table.

This is not immutable storage. Database owners/superusers remain trusted and can modify records. The existing tenant ON DELETE CASCADE remains unchanged. A privileged tenant deletion can erase its audit records. Retention, offboarding, externally retained logs and database operator access require separate decisions.

## Writer inventory

Repository search found no browser audit_logs writer. Existing writes use server/routes/core.ts logAuditEvent through the Node DATABASE_URL connection:

| Caller                        | Events                                           | Behavior retained                                                    |
| ----------------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| server/routes/admin.ts        | activation/deactivation and role changes         | Server-selected actor and tenant                                     |
| server/routes/staff-access.ts | setup-link generation and staff account creation | Server-selected actor and tenant                                     |
| server/routes/tips.ts         | tip payout approval                              | Server-selected actor and tenant                                     |
| server/routes/alfred.ts       | ingredient batch and overhead changes            | Existing service actor a1fed000-0000-0000-0000-000000000000 retained |

No Alfred endpoint contract, authentication, proposal/confirmation flow or business mutation is changed. The trusted server remains responsible for actor attribution and authorization; this migration does not independently validate every server event against user_profiles.

The helper still catches audit failures. Several callers already commit their business mutation before logging. Changing the helper to throw would create misleading failures and unsafe retries after successful writes. Follow-up: couple critical local mutations to audit writes in one database transaction; design durable outbox/reconciliation for external Supabase Auth operations. Do not claim complete event delivery until that work is tested.

## Deployment procedure

1. Confirm the tenant/auth schema exists (tenants, platform_admins, auth.uid(), can_access_tenant and has_role_or_higher). If audit_logs is absent, 164 creates it with restricted permissions in the same transaction; do not apply 143 afterward. If the table exists, inventory its policies/grants. Confirm the Node DATABASE_URL role is the table owner or a trusted role with SELECT/INSERT rights. A custom database role relying on PUBLIC grants needs an explicit, reviewed grant before applying 164. Do not grant INSERT to authenticated or anon to work around a configuration problem.
2. Apply 164 to an isolated staging database. It is transactional and re-runnable. The local tests execute the actual migration against PostgreSQL-compatible PGlite with realistic browser/service roles; both fresh-install and upgrade paths use fixture identity helpers and do not substitute for deployed Supabase RLS checks.
3. Verify an existing authorized application action produces its audit event. Verify manager/owner reads, platform-admin reads, employee denial and cross-tenant denial. Confirm existing integrations still produce events without printing sensitive payloads.
4. After staging verification, apply the same numbered migration to production. Record operator, time, release, database/environment and result in restricted operational evidence. Merging the PR does not apply this SQL automatically.
5. If logging fails, check the Node database role and grant only the required privileges to that trusted role. A rollback that restores browser writes reintroduces event forgery; prefer a forward permission correction. Existing records are not rewritten by this migration.

Read-only inspection (run as a database administrator; do not share connection strings):

```sql
-- Migration 164 verification: inspect audit-log access after applying 164.
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_logs';

SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'audit_logs'
ORDER BY grantee, privilege_type;

SELECT role_name,
  has_table_privilege(role_name, 'public.audit_logs', 'SELECT') AS can_select,
  has_table_privilege(role_name, 'public.audit_logs', 'INSERT') AS can_insert,
  has_table_privilege(role_name, 'public.audit_logs', 'UPDATE') AS can_update,
  has_table_privilege(role_name, 'public.audit_logs', 'DELETE') AS can_delete,
  has_table_privilege(role_name, 'public.audit_logs', 'TRUNCATE') AS can_truncate
FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS roles(role_name);
```

Expected table privileges: anon none; authenticated SELECT only (further restricted by RLS); service_role SELECT and INSERT only. Inspect inherited role or column-level grants if these checks disagree. Database owners/superusers are outside this browser/service-role boundary.

## Production verification, 2026-10-30

Evidence source: Seth's Supabase dashboard and SQL results supplied in the implementation conversation; no direct production database connection was used by the agent.

- Project: tfsostlmjmmggomoejpx, Coffee Management Suite production. Operator: Seth Gundersen, SQL editor role postgres.
- Before application, tenants and user_profiles existed and audit_logs was absent. Seth manually applied the supplied migration 164.
- Privilege results: postgres SELECT/INSERT/UPDATE/DELETE/TRUNCATE; anon none; authenticated SELECT only; service_role SELECT/INSERT only.
- RLS enabled. Exactly two SELECT policies returned: audit_logs_select (can_access_tenant plus manager-or-higher) and audit_logs_platform_admin_select (active platform_admins member).
- Nine tip_payout.approved events for resource type tip_payout were returned, from 2026-10-30 21:11:53.106503+00 through 21:14:51.921426+00 (5:11–5:14 p.m. Eastern).
- This verifies the production tip-approval write path and inspected configuration. It does not establish live employee/cross-tenant denial tests, actor attribution for each event, delivery for every writer, historical backfill, immutable retention or certification.
- Local database tests: 25 passing across fresh-install and upgrade paths. GitHub CI run 41127902685 passed for implementation commit b67c41a6c9953cd54c535fc39408fd44ccece1a4.

Railway has only a production environment in the connected account. Seth confirmed APP_URL=https://coffeemanagementsuite.com. PR 60 staging smoke checks remain pending. The Supabase dashboard displayed no backups; backup coverage and restore ability remain unverified.

## Next recovery checkpoint

Inspect the project's Database > Backups page before choosing a recovery approach. Record the latest available restore point, retention and plan limitations. The dashboard summary alone does not establish whether an independent backup exists.

Supabase's [backup documentation](https://supabase.com/docs/guides/platform/backups) recommends regular CLI exports and off-site copies for free-tier projects. Database backups exclude Storage API file objects; any uploaded files need separate coverage. No backup schedule, paid upgrade or restore has been configured by this work. A recovery test must use an isolated target and must not overwrite production.
