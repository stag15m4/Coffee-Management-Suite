# Coffee Management Suite — Comprehensive Audit Report

**Date:** 2026-03-16
**Scope:** Full codebase security, architecture, frontend, backend, schema, and infrastructure audit
**Audited by:** 5 parallel analysis agents covering all layers of the stack

---

## Executive Summary

This is a multi-tenant SaaS platform with **significant security vulnerabilities**, **broken database functions**, **missing test infrastructure**, and **widespread type-safety gaps**. The core architecture (Supabase RLS, module system, multi-location) is sound in concept but has critical implementation gaps that would allow data leakage between tenants, open redirect attacks, and CSRF exploits.

**Bottom line:** This codebase needs security hardening before taking on production traffic. The schema/migration layer has breaking issues that will cause runtime failures. There is zero test coverage and no linting.

### Issue Counts by Severity

| Severity | Count | Categories                                                                            |
| -------- | ----- | ------------------------------------------------------------------------------------- |
| CRITICAL | 10    | Tenant isolation, open redirects, broken DB functions, missing RLS, hardcoded secrets |
| HIGH     | 25    | CSRF, auth bypass, missing validation, race conditions, type safety                   |
| MEDIUM   | 35+   | Error handling, performance, UX, stale data, missing indexes                          |
| LOW      | 15+   | Code quality, accessibility, documentation                                            |

---

## 1. CRITICAL ISSUES (Fix Before Any Deployment)

### 1.1 Missing Tenant Isolation on Drizzle Tables

**Files:** `shared/schema.ts:6-25`, `server/storage.ts:41-112`
**Impact:** Complete multi-tenant data breach

The `ingredients`, `recipes`, and `recipe_ingredients` tables in the Drizzle schema have **no `tenant_id` column**. The storage methods `getIngredients()` and `getRecipes()` have **no tenant filtering** — any authenticated user can read ALL tenants' data.

**Fix:** Add `tenantId` column to all Drizzle tables and filter every query by tenant.

---

### 1.2 Broken Database Function: `get_my_tenant_id()` Undefined

**File:** `supabase-migrations/043_owner_insert_child_locations.sql:16`
**Impact:** Migration will fail; child location RLS policies are broken

Migration 043 calls `get_my_tenant_id()` which is **never defined in any migration**. The actual function is `get_current_tenant_id()`. This means child location insert policies will throw "function not found" errors at runtime.

**Fix:** Create the function or change references to `get_current_tenant_id()`.

---

### 1.3 Recipe Vendors RLS Uses Wrong Auth Method

**File:** `supabase-migrations/074_recipe_vendors.sql:17-31`
**Impact:** RLS policies on recipe_vendors always return NULL — blocks all queries OR bypasses isolation

The `recipe_vendors` table uses `auth.jwt() ->> 'tenant_id'` to extract tenant_id from JWT, but this claim is **never set in Supabase Auth**. All other tables use `can_access_tenant()`. This table's RLS is effectively broken.

**Fix:** Replace JWT extraction with `can_access_tenant(tenant_id)`.

---

### 1.4 Open Redirect via Host Header Injection

**Files:** `server/routes.ts:452,501`, `server/index.ts:168-170`
**Impact:** Users redirected to malicious sites after Stripe checkout

Stripe checkout success/cancel URLs are built from `${req.protocol}://${req.get('host')}` — an untrusted request header. A `getTrustedBaseUrl()` helper exists but **isn't used** on these critical payment endpoints. Attackers can set the Host header to redirect users to phishing sites after payment.

**Fix:** Use `getTrustedBaseUrl(req)` on lines 452 and 501. Require `APP_URL` env var.

---

### 1.5 OAuth CSRF — Weak State Validation

**File:** `server/routes.ts:645,670-705`
**Impact:** Attacker can link their Square account to a victim's tenant

Square OAuth state tokens are stored in an in-memory `Map` (lost on restart), are not cryptographically signed, and have no CSRF cookie binding. An attacker can craft a malicious OAuth flow.

**Fix:** Use signed JWT tokens for state, store in Redis/DB, verify SameSite cookies.

---

### 1.6 Missing RLS DELETE Policies

**File:** `supabase-migrations/008_*.sql`
**Impact:** Data can never be deleted through RLS-protected queries

`coffee_product_prices` and `coffee_order_history` tables have SELECT/INSERT/UPDATE policies but **no DELETE policy**. Any delete operation will silently fail.

**Fix:** Add DELETE policies for both tables.

---

### 1.7 Sentry DSN Hardcoded in Source Code

**Files:** `server/instrument.ts:4`, `client/src/main.tsx`
**Impact:** Attackers can spam error monitoring or map internal code paths

The Sentry DSN is committed directly in source code instead of environment variables.

**Fix:** Move to `SENTRY_DSN` environment variable.

---

### 1.8 CSP Allows `unsafe-inline` in Production

**File:** `server/index.ts:18-40`
**Impact:** Negates XSS protection from Content-Security-Policy

The CSP header includes `'unsafe-inline'` for scripts even in production, which defeats the purpose of CSP entirely.

**Fix:** Use nonces for inline scripts. Remove `unsafe-inline`.

---

### 1.9 Missing Foreign Key Constraints in Drizzle

**File:** `shared/schema.ts:22-25`
**Impact:** Orphaned records, data integrity loss

`recipeIngredients.recipeId` has no explicit foreign key constraint. Deleting a recipe leaves orphaned recipe_ingredient rows.

**Fix:** Add proper FK references with CASCADE.

---

### 1.10 SSL Certificate Validation Disabled

**File:** `server/db.ts:20`
**Impact:** Vulnerable to man-in-the-middle attacks on database connection

`rejectUnauthorized: false` disables TLS certificate validation for the PostgreSQL connection.

**Fix:** Use proper certificates in production; only disable for local dev.

---

## 2. HIGH SEVERITY ISSUES

### Security

| #   | Issue                                                               | File:Line                                     | Fix                                                  |
| --- | ------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| 2.1 | **No CSRF protection** on any POST endpoint                         | `server/routes.ts` (all POST routes)          | Add CSRF tokens or Origin/Referer validation         |
| 2.2 | **License code brute-force** — rate limit too weak (30/15min)       | `server/routes.ts:1449`                       | Tighten rate limit, add exponential backoff, CAPTCHA |
| 2.3 | **Admin context in sessionStorage** — XSS can escalate to admin     | `client/src/contexts/AuthContext.tsx:860,880` | Move to server-side session, HTTP-only cookies       |
| 2.4 | **Platform admin not re-validated per-request** for long operations | `server/routes.ts:82-109`                     | Re-verify before sensitive mutations                 |
| 2.5 | **User enumeration** via beta signup error messages                 | `server/routes.ts:1736`                       | Return generic error messages                        |
| 2.6 | **Host header injection** in Square webhook URL                     | `server/index.ts:168-170`                     | Require APP_URL env var, remove header fallback      |

### Backend

| #    | Issue                                                                                    | File:Line                              | Fix                                       |
| ---- | ---------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------- |
| 2.7  | **Race condition** in clock-out flow — breaks not in transaction                         | `server/routes.ts:2884-2895`           | Wrap in database transaction              |
| 2.8  | **User hijacking** in invite flow — race condition on multi-tenant invite                | `server/routes.ts:2396-2402`           | Add UNIQUE constraint + SELECT FOR UPDATE |
| 2.9  | **Missing input validation** on reseller creation (negative seats/amounts)               | `server/routes.ts:1140-1152`           | Add `z.number().positive()`               |
| 2.10 | **Missing Stripe idempotency keys** on all creation operations                           | `server/stripeService.ts` (throughout) | Add idempotency keys to all Stripe calls  |
| 2.11 | **No transactions** in beta signup (6-step process, partial failure leaves broken state) | `server/routes.ts:1694-1777`           | Wrap in transaction with rollback         |
| 2.12 | **Stripe errors silently return null** instead of distinguishing 404 vs failure          | `server/stripeService.ts:43-47,83-88`  | Differentiate error types                 |
| 2.13 | **Separate UPDATE calls without transaction** for Stripe info                            | `server/storage.ts:123-137`            | Combine into single UPDATE                |

### Frontend

| #    | Issue                                                                        | File:Line                                       | Fix                                        |
| ---- | ---------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| 2.14 | **Unprotected module routes** — `/reseller-management` has no ProtectedRoute | `client/src/App.tsx:95`                         | Wrap in `<ProtectedRoute>`                 |
| 2.15 | **Data isolation breach** in admin-users location query                      | `client/src/pages/admin-users.tsx:146-149`      | Validate current user can access locations |
| 2.16 | **DOMPurify allows attributes** — `<em onclick=...>` possible                | `client/src/pages/landing/HeroSection.tsx:8-10` | Add `ALLOWED_ATTR: []`                     |

### Schema

| #    | Issue                                                                           | File                          | Fix                                        |
| ---- | ------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------ |
| 2.17 | **Drizzle covers only 7 of 40+ tables** — 82% of DB has no ORM type safety      | `shared/schema.ts`            | Expand Drizzle schema or document strategy |
| 2.18 | **Missing indexes** on composite queries (tenant_id + status, tenant_id + date) | Various migrations            | Add composite indexes                      |
| 2.19 | **SECURITY DEFINER functions missing `SET search_path`**                        | Migrations 019, 040, 043, 045 | Add `SET search_path = public`             |
| 2.20 | **Missing NOT NULL constraints** on required fields (display_name, category)    | Various migrations            | Add constraints                            |

### Infrastructure

| #    | Issue                                                          | File                 | Fix                                 |
| ---- | -------------------------------------------------------------- | -------------------- | ----------------------------------- |
| 2.21 | **84 `catch (err: any)` blocks** bypass TypeScript strict mode | `server/routes.ts`   | Type errors properly                |
| 2.22 | **247 `: any` instances** in client code                       | Various client files | Add proper types                    |
| 2.23 | **No test framework** — zero automated tests                   | `package.json`       | Add Vitest + basic test suite       |
| 2.24 | **No linting or formatting** — no ESLint, no Prettier          | `package.json`       | Add ESLint + Prettier + Husky       |
| 2.25 | **CORS origin typed as `any`**                                 | `server/index.ts:65` | Fix `buildCorsOrigin()` return type |

---

## 3. MEDIUM SEVERITY ISSUES

### Backend

- **N+1 query** on `/api/resellers/:id` — 5 separate DB calls (`server/routes.ts:1092-1135`)
- **Unbounded query results** — no LIMIT on reseller verticals/tenants
- **Missing date validation** on Square/QBO service dates (`server/routes.ts:772-773`)
- **Unvalidated JSON** stored directly from user input for verticals (`server/routes.ts:2031-2035`)
- **Email injection risk** — insufficient escaping in resend templates (`server/resend.ts:92`)
- **Stripe pagination not implemented** — silently drops products beyond 100 (`server/stripeService.ts:49-52`)
- **Weak random slug generation** using `Math.random()` (`server/routes.ts:1702`)
- **Duplicate error logging** — same error logged twice in multiple endpoints
- **No connection pool error handler** on PostgreSQL pool (`server/db.ts:16-22`)

### Frontend

- **Missing 404 fallback route** — invalid URLs render nothing (`client/src/App.tsx`)
- **Query client disables refetching** — stale data after tab switch (`client/src/lib/queryClient.ts:48-51`)
- **Missing pagination** on team members query — loads all users at once (`client/src/pages/my-team.tsx:114-119`)
- **Race condition** after location switch — wrong modules may load (`client/src/contexts/AuthContext.tsx:655-675`)
- **Error boundary exposes stack traces** in production (`client/src/components/ErrorBoundary.tsx:81-84`)
- **Fire-and-forget queries** silently swallow errors throughout AuthContext
- **SessionStorage not guarded** for SSR/restricted contexts
- **Missing cache invalidation** when creating recipes with ingredients (`client/src/hooks/use-recipes.ts:119`)
- **Trial enforcement incomplete** — admin pages accessible after trial ends (`client/src/components/ProtectedRoute.tsx:138`)

### Schema

- **Loose numeric types** — `numeric()` without precision for money fields (`shared/schema.ts:10-11`)
- **Missing Zod refinements** — no business logic validation (seats, discounts, dates)
- **RLS policy performance** — `EXISTS` subqueries on every row for recipe_ingredients
- **Two conflicting RLS patterns** — old migrations use `get_current_tenant_id()`, new ones use `can_access_tenant()`
- **No cascade delete consistency** — some FKs CASCADE, others SET NULL, undocumented

### Infrastructure

- **Drizzle migrations output to `./migrations/`** but actual migrations in `./supabase-migrations/` — drift risk
- **Trust proxy hardcoded to 2** — fragile across deployments (`server/index.ts:14`)
- **Build allowlist of 33 packages** — brittle, must be manually maintained (`script/build.ts:7-33`)
- **Missing env vars** not documented in `.env.example` (APP_URL, CORS_ORIGIN, RESEND_FROM_EMAIL)
- **VITE_USE_MOCK_DATA defaults to true** — too easy to accidentally enable in prod

---

## 4. ARCHITECTURAL CONCERNS

### Dual Data Access Pattern

The codebase uses **two different data access patterns** that create confusion and maintenance burden:

1. **Drizzle ORM** (server-side) — covers only 7 tables
2. **Supabase client** (client-side direct) — covers everything else via RLS

This means schema changes require updating **both** Drizzle definitions AND Supabase migrations, with no automated sync check.

### Migration Complexity

139 migrations with **destructive policy drops and recreates** across migrations 041-045. These must run in exact order. There's no migration dependency documentation. Earlier migrations (003-012) use older RLS patterns that were replaced but not cleaned up.

### Missing Infrastructure

- No CI/CD pipeline (GitHub Actions, etc.)
- No Dockerfile or deployment configuration
- No structured logging beyond console.log/error
- No database backup/restore strategy documented
- No monitoring beyond basic Sentry error tracking

---

## 5. WHERE TO START — Prioritized Action Plan

### Phase 1: Stop the Bleeding (Week 1)

1. Fix `get_my_tenant_id()` — either create the function or change references to `get_current_tenant_id()`
2. Fix `recipe_vendors` RLS — change from JWT to `can_access_tenant()`
3. Add DELETE policies for `coffee_product_prices` and `coffee_order_history`
4. Use `getTrustedBaseUrl()` on Stripe redirect URLs (lines 452, 501)
5. Move Sentry DSN to environment variables
6. Add `tenant_id` filtering to `getIngredients()` and `getRecipes()` in storage.ts
7. Require `APP_URL` env var — remove host header fallbacks

### Phase 2: Security Hardening (Week 2-3)

8. Add CSRF protection (Origin/Referer validation or double-submit cookies)
9. Add Stripe idempotency keys to all creation operations
10. Wrap multi-step operations in database transactions (beta signup, clock-out, Stripe updates)
11. Fix CSP — remove `unsafe-inline`, implement nonces
12. Tighten license code rate limiting
13. Fix input validation gaps (negative numbers, email formats, date formats)
14. Add `SET search_path = public` to all SECURITY DEFINER functions
15. Protect `/reseller-management` route with ProtectedRoute

### Phase 3: Quality Foundation (Week 3-4)

16. Add ESLint + Prettier + pre-commit hooks
17. Add Vitest + write tests for critical paths (auth, payments, tenant isolation)
18. Fix TypeScript `any` usage — start with server/routes.ts (84 catch blocks)
19. Add composite database indexes for common query patterns
20. Add 404 fallback route
21. Fix error boundary to hide stack traces in production
22. Enable `refetchOnWindowFocus` in TanStack Query config

### Phase 4: Architecture Improvements (Month 2+)

23. Expand Drizzle schema to cover all tables OR document the dual-access strategy
24. Consolidate RLS patterns — migrate old `get_current_tenant_id()` to `can_access_tenant()`
25. Add structured logging (pino/winston)
26. Create Dockerfile and CI/CD pipeline
27. Add pagination to all list endpoints
28. Implement optimistic updates in mutations
29. Document migration ordering and dependencies

---

## Appendix: Files Most in Need of Attention

| File                                         | Issues                                                       | Priority |
| -------------------------------------------- | ------------------------------------------------------------ | -------- |
| `server/routes.ts`                           | 25+ issues — auth, validation, transactions, race conditions | Highest  |
| `shared/schema.ts`                           | Missing tenant_id, FKs, indexes, validation                  | Highest  |
| `server/storage.ts`                          | No tenant filtering, no error handling, no transactions      | Highest  |
| `supabase-migrations/074_recipe_vendors.sql` | Broken RLS                                                   | Highest  |
| `supabase-migrations/043_*.sql`              | Undefined function                                           | Highest  |
| `client/src/contexts/AuthContext.tsx`        | Session hijack risk, race conditions                         | High     |
| `server/index.ts`                            | CSP, CORS, host header issues                                | High     |
| `server/stripeService.ts`                    | No idempotency, silent errors                                | High     |
| `client/src/App.tsx`                         | Unprotected routes, missing 404                              | High     |
| `server/db.ts`                               | SSL disabled, no pool error handling                         | Medium   |
| `client/src/lib/queryClient.ts`              | Stale data config                                            | Medium   |
| `package.json`                               | No tests, no linting                                         | Medium   |
