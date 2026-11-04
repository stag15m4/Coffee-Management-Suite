# Staging launch status — 2026-10-30

The staging site is deployed at https://cms-staging-staging-d7fb.up.railway.app.

Source branch `codex/staging-security-release`, pinned commit `4cb35775911a73f70f26970f2874c2d54763bbc8`. Its tree was compared with the previously tested local combined security release and had no differences. No production PRs were merged.

Railway deployments `e2022cdd-4a77-495e-9b1c-a88634c2e874` and subsequent `4d33ca61-c2fd-4408-ba80-bb72f7c31fab` reached SUCCESS. HTTP health and root returned 200. The served frontend bundle contains the staging Supabase reference, not the production reference.

## Blocker

The background database query fails with ENETUNREACH against a direct Supabase IPv6 address on port 5432. Enabling Railway outbound IPv6 and redeploying did not resolve it. Database authentication is therefore NOT verified. The health route does not test the database. No browser logins or payroll workflows have passed.

Owner action: replace only staging `DATABASE_URL` with the CMS Staging Supabase Connect > Session pooler URI, inserting the staging database password. The username must identify `iuugcktfbpdlljmmpfrl`. Save directly in Railway; do not disclose the password in chat. After redeploy, verify a successful database query, then provision a genuine test login and test tenant isolation over HTTP.

The synthetic fixture users have no login passwords. Module/reference fixtures and Auth redirect configuration still need review. The application includes a Dockerfile and railway.toml with compliance migration 163 predeploy configuration; verify effective deployment configuration before subsequent releases. No production data or integration secrets were copied.
