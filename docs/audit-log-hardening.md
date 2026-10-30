# Audit-log access hardening

Migration: **164**, supports either an existing migration-143 table or a missing audit table. Status: implemented and locally tested; not applied to production by this work.

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
-- Migration 164 verification: inspect audit-log access; prerequisite migration 143.
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

## Production configuration check, 2026-10-30

Railway project Coffee Management Suite has only a production environment in the connected account. APP_URL is present; Seth confirmed its value as https://coffeemanagementsuite.com, satisfying the origin-format requirement. Railway reports the current service deployment as SUCCESS, with no staged changes. No staging environment, deployment, database migration or production write was created during this check. PR 60 still requires staging smoke checks. Seth confirmed project tfsostlmjmmggomoejpx and the postgres pooled database role; his SQL check shows tenants and user_profiles exist but public.audit_logs does not. Migration 164 now supports that missing-table state. The dashboard displays no backups; backup coverage remains unverified.
