# Staging launch status — updated November 9, 2026

The staging site is deployed at https://cms-staging-staging-d7fb.up.railway.app.

Source branch `codex/staging-security-release`, pinned commit `4cb35775911a73f70f26970f2874c2d54763bbc8`. No production security PRs have been merged. The November 9 review candidate is newer than this deployed release and has not been deployed.

## Resolved launch blocker

The initial direct Supabase IPv6 connection failed with ENETUNREACH. Seth replaced staging DATABASE_URL with the staging Session pooler connection on October 30. Deployment `85cd55f3-1b7a-4cd4-806a-f654cdfbac4a` reached SUCCESS; a successful application database query was observed. HTTP health alone does not establish database readiness.

## Historical workflow evidence

Evidence below comes from the October 30 implementation session and Seth's test results, not a new November 9 signed-in test.

- Staging frontend was verified to reference `iuugcktfbpdlljmmpfrl`, not production.
- Seth created a genuine staging Auth login, linked to TEST ONLY - Cedar Cafe as a manager. Browser login and the Cedar dashboard succeeded.
- Tip Payouts and Calendar/Workforce modules were enabled for synthetic tenants. Seth reported both opened successfully.
- A synthetic shift was published and a $50 tip-input test produced a $48.95 payout pool after the configured card-tip fee. Approval and its matching audit event were observed together.
- Database role/JWT tests showed Cedar/Harbor separation. These do not replace full two-login browser isolation tests.

## Still open

- Timesheet approval through the UI has not been demonstrated. Seth reported difficulty finding it and planned to check with Brianna.
- Complete a synthetic pay period: clock records, corrections, approval/reapproval, tip reconciliation and payroll review CSV.
- Verify deployed proxy redirect behavior; the November 4 header probes did not exercise the redirect branch.
- Real QuickBooks sandbox OAuth remains untested; separate staging client credentials were absent at the November 4 check.
- Recovery/restore testing and paid backup upgrades remain deferred. Gusto declined the partnership application; that does not establish a failed technical review or waive CMS security work.

See [November 4 hosted checks](../staging-smoke-2026-11-04.md) for the latest recorded read-only HTTP checks. No new production configuration, database writes, paid subscription or external integration authorization was performed by this documentation update.
