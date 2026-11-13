# CMS security readiness

Started: 2026-10-30. Status: working remediation and evidence register, not an audit opinion or certification claim.

## Scope and evidence rules

Proposed scope: CMS application, database, storage, integrations, deployment pipeline, production operators and their devices. Confirm scope with the assessor before commissioning an audit. Hosting-provider reports do not establish CMS compliance.

Use these statuses: proposed, implemented in source, verified in staging, verified in production, operating evidence collected. A merged change or migration file alone does not prove deployment. For each verification retain date, environment, release SHA, operator, result and a restricted evidence link. Never commit secrets, employee/payroll data, raw database dumps or sensitive security reports.

Seth is the proposed accountable owner; confirm the security and incident-response contacts and a backup contact before sharing with Gusto. Engineering tasks below require a named assignee when scheduled.

## Prioritized register

| ID     | Priority | Control / work                                                             | Current evidence                                                                                                           | Completion evidence                                                                                                                                                                                |
| ------ | -------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 | P1       | Require a trusted production APP_URL; remove Host-header redirect fallback | This change adds startup validation and regression tests                                                                   | Confirm actual production APP_URL, successful staging startup and redirect/health checks, then record release                                                                                      |
| SEC-02 | P1       | Protect audit-log provenance and retention                                 | Migration 143 allows tenant inserts and platform-admin ALL access; core helper logs failures without failing the operation | Inventory every writer and reader; new migration and database tests for forged actor, cross-tenant inserts and unauthorized update/delete; verify deployment                                       |
| SEC-03 | P1       | Make security-sensitive mutations and audit records reliable               | Existing helper is best effort                                                                                             | Identify critical mutations; use transactionally coupled audit writes or a durable outbox, test failure/retry behavior; avoid returning failure after an already committed mutation                |
| SEC-04 | P1       | Verify production permissions and MFA                                      | Auth checks exist; administrative MFA enforcement is unverified by this review                                             | Inventory GitHub, Railway, Supabase and CMS privileged users; record MFA, least privilege, recovery access and a dated access review                                                               |
| SEC-05 | P1       | Test tenant isolation                                                      | RLS migrations and server tenant filters exist                                                                             | Negative tests with two tenants and each relevant role, including service credentials, exports and storage; verify applied policies                                                                |
| SEC-06 | P1       | Complete token encryption migration and key procedures                     | AES-256-GCM implementation; legacy plaintext fallback remains                                                              | Restricted count-only check for legacy tokens; safe migration with recovery plan; key access inventory and tested rotation procedure, without exposing token values                                |
| SEC-07 | P1       | Demonstrate recovery                                                       | Backup and restore effectiveness unverified                                                                                | Record database/storage backup coverage, retention and recovery objectives; restore into isolated staging and verify representative records and files                                              |
| SEC-08 | P1       | Obtain vulnerability evidence                                              | Remediation log references prior CyberFortify test                                                                         | Obtain original report, scope and dated retest; reconcile unresolved findings; run dependency and secret scans and record remediation decisions                                                    |
| SEC-09 | P2       | Strengthen browser protections                                             | Production CSP permits inline scripts                                                                                      | Inventory inline script dependencies; test stricter policy in staging, including authentication and billing, before enforcement                                                                    |
| SEC-10 | P1       | Enforce and evidence change review                                         | CI defines lint, tests, typecheck and build                                                                                | Verify branch rules, required checks, reviewer approvals and Railway deployment gating; retain release records and rollback procedure                                                              |
| SEC-11 | P1       | Incident response and alert routing                                        | Sentry/logging integration in source; response process unverified                                                          | Assign contacts; approve procedure; test alert delivery and a tabletop exercise; record follow-up actions                                                                                          |
| SEC-12 | P1       | Retention and destruction                                                  | Public policy promises deletion/anonymization within 90 days with exceptions                                               | Inventory data and copies, legal holds, export files and vendors; test deletion and document backup expiration; align claims to actual behavior                                                    |
| SEC-13 | P2       | Vendor and workforce security                                              | Operational evidence unverified                                                                                            | Vendor inventory and responsibility review; confidentiality agreements, training, endpoint encryption/updates/locking and offboarding records                                                      |
| SEC-14 | P2       | Formal assessment preparation                                              | No formal attestation or certificate verified                                                                              | Scope, risk register, approved policies and evidence calendar; ISO path additionally needs Statement of Applicability, internal audit and management review; agree SOC observation period with CPA |

P1 means address before claiming production readiness for sensitive payroll integration. P2 means schedule and assess with the reviewer; it does not mean optional or automatically acceptable.

## SEC-01 deployment and rollback

Before deployment, confirm APP_URL is the actual public HTTPS origin (for example, https://coffeemanagementsuite.com), with no credentials, application path, query or fragment. An optional trailing slash is accepted. Do not change provider OAuth callback URLs or webhook registrations as part of this change.

Production now refuses startup when APP_URL is missing or invalid. This is intentional but can prevent deployment if configuration is not checked first. Development/test startup remains unchanged. The /api/health endpoint retains its internal HTTP exception after valid startup.

In staging, test missing/invalid APP_URL startup failure; valid startup; internal HTTP health check; a normal HTTP redirect preserving path/query; spoofed Host/X-Forwarded-Host values not changing the destination; and normal HTTPS login, API, webhook and Alfred traffic. Record the actual result, not just the expected behavior. Verify proxy configuration matches the existing two trusted hops.

If deployment fails because of APP_URL, correct the configured public origin and redeploy. For an unrelated regression, revert the commit and deploy the last verified release; document that rollback restores the earlier redirect risk. No database migration is included in this change.

## Operational work to start now

1. Record production administrators and verify MFA; retain a dated access review. Repeat on access changes and on an owner-approved schedule.
2. Inventory database, storage, integrations and sensitive exports. Assign a data owner and document where credentials and recovery material are kept, without recording their values here.
3. Run an isolated recovery drill with explicit recovery time/data-loss targets. Include uploaded files and required configuration, not just database rows.
4. Draft and approve incident response: detection, triage, containment, evidence preservation, provider coordination, recovery and notification decisions. Test with a simulated stolen administrator credential. Preserve an action log and lessons learned.
5. Review prior penetration-test findings against the current release. Track each remaining risk with likelihood, impact, mitigation, owner, due date and acceptance decision.
6. Build a restricted evidence folder for access reviews, change approvals, scans/retests, restore drills, training and vendor reviews. Assign review dates; do not backdate evidence.

These are proposed procedures until adopted and performed. Governance records may live outside this repository; link to them without exposing sensitive content.

## Gusto and certification decision

Gusto publishes a review route for applicants without formal security audits. Confirm the evidence required for this application with its reviewer; neither source-code improvements nor this document guarantee approval. Prepare the control evidence first, then decide whether to commission SOC 2 Type II or ISO/IEC 27001 certification based on partner requirements and scope.

- [Gusto security review](https://docs.gusto.com/app-integrations/docs/security-review)
- [AICPA SOC services](https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services/)
- [ISO/IEC 27001](https://www.iso.org/standard/27001)

Scope PCI separately for payment flows; do not infer exemption solely from outsourcing card processing. This plan does not implement the Gusto integration or claim QuickBooks payroll export exists.
