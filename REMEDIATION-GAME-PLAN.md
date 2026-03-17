# Coffee Management Suite — Remediation Game Plan

**Created:** 2026-03-16
**Sources:** CyberFortify Pen Test (2026-03-13) + Comprehensive 5-Agent Audit (2026-03-16)

---

## Overlap Between the Two Audits

- Open redirect on Stripe URLs → both (CFS-003 = 1.4)
- Sentry DSN hardcoded → both (CFS-024 = 1.7)
- SSL validation disabled → both (CFS-023 = 1.10)
- Broken RLS / tenant isolation → tonight's audit goes deeper
- CSRF → both (CFS-008 = 2.1)
- CSP unsafe-inline → tonight's audit (1.8)

## Unique to CyberFortify (3/13)

- CFS-001: RLS UPDATE missing WITH CHECK (employee self-escalation)
- CFS-002: Square OAuth tokens stored unencrypted
- CFS-004: Client-side role changes bypass server hierarchy
- CFS-005: SignUp accepts attacker-controlled role & tenant
- CFS-006: Kiosk PINs plaintext/brute-forceable
- CFS-007: Tip payouts calculated client-side only
- CFS-009: Confidential pricing docs in repo
- CFS-010: Cross-tenant verifyBudgetAdmin
- CFS-011: Managers can deactivate owners
- CFS-012: Unauthenticated endpoints expose pricing
- CFS-013: Devcontainer port publicly accessible

---

## Session 1 — Quick Critical Fixes

All of these are small, targeted, low-risk changes:

1. **Open redirect** — swap `Host` header for `getTrustedBaseUrl()` (2 lines)
2. **Broken `get_my_tenant_id()`** — new migration to alias or fix references
3. **`recipe_vendors` RLS** — new migration swapping JWT to `can_access_tenant()`
4. **Missing DELETE policies** — new migration
5. **Sentry DSN** → env vars (2 files)
6. **Devcontainer port** → private (1 line)
7. **Error boundary stack traces** — hide in prod (1 line)
8. **SignUp accepts role/tenant** (CFS-005) — remove params

## Session 2 — Tenant Isolation & Auth Hardening

- Add `tenant_id` to Drizzle tables + filter all storage queries
- RLS UPDATE WITH CHECK (CFS-001)
- Server-side role change endpoint (CFS-004)
- Server-side user deactivation (CFS-011)
- Square token encryption (CFS-002)
- CSRF protection middleware

## Session 3 — Transactions, Validation, Quality

- Wrap multi-step flows in transactions
- Stripe idempotency keys
- Input validation gaps
- CSP nonces
- Add ESLint + Prettier + Vitest skeleton
