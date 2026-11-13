# Staging website setup

Status: prepared, NOT deployed or login-tested (2026-10-30).

## Resources

- Railway project: CMS Staging (`970d4212-0f8c-4b15-b1a0-526845374bbc`)
- Environment: staging (`b280c72d-0778-4b60-94c9-ab1ce2a8c9d5`)
- Service: cms-staging (`fe9f9b4c-a1f1-4d63-ab13-0884ebf34813`)
- Reserved application URL: https://cms-staging-staging-d7fb.up.railway.app
- Supabase: CMS Staging (`iuugcktfbpdlljmmpfrl`)
- Railway dashboard: https://railway.com/project/970d4212-0f8c-4b15-b1a0-526845374bbc/service/fe9f9b4c-a1f1-4d63-ab13-0884ebf34813?environmentId=b280c72d-0778-4b60-94c9-ab1ce2a8c9d5

No source repository is attached yet. No deployment or running application has been created. No production configuration was changed. Runtime usage must be reviewed before launch; the user's paid Supabase upgrade remains deferred.

## Configured values

- `SUPABASE_URL` and `VITE_SUPABASE_URL`: https://iuugcktfbpdlljmmpfrl.supabase.co
- `VITE_SUPABASE_ANON_KEY`: staging public publishable key (the existing variable name is retained for app compatibility).
- `APP_URL` and `CORS_ORIGIN`: reserved staging application URL above.
- `NODE_ENV=production` (optimized runtime; this does not select the production database).
- `PORT=5001`, `VITE_USE_MOCK_DATA=false`.
- `QBO_ENVIRONMENT=sandbox`, `SQUARE_ENVIRONMENT=sandbox`.
- Build: `npm run build`. Start: `npm start`.
- Health check: `/api/health`, timeout 120 seconds.
- Restart: on failure, maximum 2 retries.

## Owner credential handoff

In this staging Railway service's Variables tab, add:

1. `DATABASE_URL`: CMS Staging's Supabase Connect connection string, with its own database password. Prefer the session pooler connection for the long-running Node server if IPv4 is required. Its username should include `iuugcktfbpdlljmmpfrl`; a direct connection instead has host `db.iuugcktfbpdlljmmpfrl.supabase.co`. URL-encode special characters in the password.
2. `SUPABASE_SERVICE_ROLE_KEY`: the CMS Staging server key from Supabase API Keys (legacy `service_role` matches the current app configuration).

Enter these directly into Railway; do not put them in chat, source control, screenshots, or public `VITE_` variables. Do not reuse production values. Do not reset the production database password.

## Before first deployment

- Choose a reviewed staging branch containing the security changes under test. PR 65 contains setup scripts only; it is not the combined security release.
- Verify the staging connection targets this project and both private variables are present without logging their values.
- Keep Resend, Stripe, Square, QBO, Alfred and compliance secrets absent until a specific test requires separately scoped test credentials. Sandbox flags alone cannot turn live credentials into test credentials.
- Ensure staging integration tables and tenant integration tokens remain empty. The Connecteam scheduler starts automatically and reads database configuration; there is no global outbound-integration kill switch.
- Complete module/reference fixtures needed for the specific UI workflows. Schema creation alone does not populate feature catalogs.
- Create real test login users through Supabase Auth and associate them with the fictional tenant profiles. The three SQL fixture users have no passwords and are NOT working browser logins.
- Configure Supabase Auth Site URL and allowed redirects for the reserved staging origin. Do not broaden production redirects.
- Review Railway runtime cost before attaching source, because attaching a GitHub source can immediately build/deploy.

## Verification after launch

Observe Railway deployment SUCCESS, check health, then test manager login, employee login, cross-tenant denial, tip approval/audit creation, and timesheet review. Database role simulations already passed but do not replace browser or HTTP authorization tests. Storage, login, module enablement and sandbox OAuth remain unverified. This setup is not certification evidence by itself.
