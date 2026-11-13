# Hosted staging checks — November 4, 2026

## Scope

Read-only HTTP checks performed by Codex for Seth on November 4, 2026, around 12:33–12:36 PM America/New_York. No production configuration, database rows, credentials, integrations or deployment were changed. No signed-in workflow or payroll export was executed.

Railway CMS Staging project: `970d4212-0f8c-4b15-b1a0-526845374bbc`; environment: `b280c72d-0778-4b60-94c9-ab1ce2a8c9d5`; service: `fe9f9b4c-a1f1-4d63-ab13-0884ebf34813`.

Observed deployment: `85cd55f3-1b7a-4cd4-806a-f654cdfbac4a`, terminal status SUCCESS, release `4cb35775911a73f70f26970f2874c2d54763bbc8` on `codex/staging-security-release`. Public origin: https://cms-staging-staging-d7fb.up.railway.app.

## Observations

| Check                                                                                | Observed result                     | What it establishes                                                                                       |
| ------------------------------------------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| HTTPS GET /api/health                                                                | 200, JSON status ok                 | Public health endpoint responds; does not prove database readiness                                        |
| HTTPS GET /                                                                          | 200, HTML                           | App shell available; interactive login not tested                                                         |
| GET /api/health with an unrelated X-Forwarded-Host                                   | 200, JSON health response           | Health path remains available; does not prove redirect handling                                           |
| GET /login?cms_smoke=1 with X-Forwarded-Proto http and an unrelated X-Forwarded-Host | 200, HTML; no Location header       | External proxy path did not exercise application HTTP redirect; SEC-01 redirect verification remains open |
| Unauthenticated GET /api/dashboard/metrics/00000000-0000-0000-0000-000000000000      | 401, application/json, Unauthorized | This protected dashboard route denies an unauthenticated request                                          |
| GET /api/alfred/tip-payout-approvals                                                 | 200, website HTML                   | Not an authenticated API success: Alfred routes are not registered when ALFRED_SERVICE_TOKEN is absent    |

Railway runtime/request logs corroborated the hosted requests. Service config lists no ALFRED_SERVICE_TOKEN or ALFRED_ALLOWED_TENANT_IDS; server/routes/alfred.ts explicitly returns before registration without the token. The SPA fallback serves HTML for the resulting unmatched GET. No service token was added. This is an existing disabled-route behavior and a legacy difference from the Alfred JSON-error convention, not evidence of access to payroll data.

The service variable-name inventory also lacks QBO_CLIENT_ID and QBO_CLIENT_SECRET. A real QuickBooks sandbox OAuth test has not been demonstrated by these checks. Do not infer that a healthy deployment satisfies that release check or reconnect production to substitute for it.

## Remaining checks and user direction

- Seth will work with Brianna to verify timesheet approval. The approval function exists in source; its live use remains unverified. Do not mark it complete based on source alone or let it block independent readiness work.
- Verify signed-in login, tenant isolation, recorded-hour corrections, approval/reapproval, approved tip snapshots and payroll review CSV with synthetic staging data.
- Test trusted-origin startup failures and redirects through the actual proxy configuration; external header probes above are insufficient.
- Configure and authorize the isolated QuickBooks sandbox as appropriate, then verify callback success without touching production grants.
- If Alfred integration is included in the staging test scope, configure separate staging credentials and tenant allowlist before testing its authorization. Never copy production tokens merely to make a check pass.
- Complete remaining security-readiness evidence and Gusto reviewer requirements. These checks do not establish Gusto certification or a direct Gusto API integration.

This file is evidence for this specific deployment and date, not a blanket staging or production sign-off.
