# Dependency security review — 2026-10-30

Status: initial remediation prepared in source; not deployed. This is a dependency-advisory scan, not a penetration test or certification.

## Scope and method

Ran npm audit --omit=dev --json against the current lockfile and npm registry advisory database. Counts describe flagged packages, including transitive effects; they are not unique vulnerabilities or demonstrated exploits. The baseline is main commit a1e37045a77f8aa6b3832be06f842e8444db25d5. Runtime reachability and production versions require separate confirmation.

Updated selected dependencies within the existing package.json ranges with npm update --ignore-scripts. No npm audit fix --force, major-version override, database migration or production deployment was used.

| Severity | Before | After |
| -------- | -----: | ----: |
| critical |      1 |     0 |
| high     |     21 |     8 |
| moderate |     17 |    16 |
| low      |      5 |     5 |
| total    |     44 |    29 |

## Version changes

Includes nested development dependency copies refreshed by npm resolution. The counts above omit development dependencies.

| Package path                                                                   | Before  | After  |
| ------------------------------------------------------------------------------ | ------- | ------ |
| node_modules/@eslint/config-array/node_modules/brace-expansion                 | 1.1.12  | 1.1.21 |
| node_modules/@eslint/eslintrc/node_modules/brace-expansion                     | 1.1.12  | 1.1.21 |
| node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion | 5.0.4   | 5.0.12 |
| node_modules/axios                                                             | 1.13.5  | 1.21.0 |
| node_modules/axios/node_modules/agent-base                                     | new     | 6.0.2  |
| node_modules/axios/node_modules/https-proxy-agent                              | new     | 5.0.1  |
| node_modules/body-parser                                                       | 1.20.4  | 1.20.9 |
| node_modules/body-parser/node_modules/qs                                       | new     | 6.16.2 |
| node_modules/brace-expansion                                                   | 2.0.2   | 2.1.7  |
| node_modules/compression                                                       | 1.8.1   | 1.8.2  |
| node_modules/dompurify                                                         | 3.3.2   | 3.4.17 |
| node_modules/eslint/node_modules/brace-expansion                               | 1.1.12  | 1.1.21 |
| node_modules/follow-redirects                                                  | 1.15.11 | 1.16.2 |
| node_modules/form-data                                                         | 4.0.5   | 4.0.6  |
| node_modules/glob/node_modules/brace-expansion                                 | 1.1.12  | 1.1.21 |
| node_modules/hasown                                                            | 2.0.2   | 2.0.4  |
| node_modules/lodash                                                            | 4.17.23 | 4.18.1 |
| node_modules/path-to-regexp                                                    | 0.1.12  | 0.1.13 |
| node_modules/picomatch                                                         | 2.3.1   | 2.3.2  |
| node_modules/postcss                                                           | 8.5.6   | 8.5.32 |
| node_modules/postcss/node_modules/nanoid                                       | 3.3.11  | 3.3.20 |
| node_modules/proxy-addr                                                        | 2.0.7   | 2.0.8  |
| node_modules/proxy-from-env                                                    | 1.1.0   | 2.1.0  |
| node_modules/qs                                                                | 6.14.2  | 6.14.3 |
| node_modules/side-channel                                                      | 1.1.0   | 1.1.1  |
| node_modules/side-channel-list                                                 | 1.0.0   | 1.0.1  |
| node_modules/source-map-js                                                     | 1.2.1   | 1.2.2  |
| node_modules/tinyglobby/node_modules/picomatch                                 | 4.0.3   | 4.0.7  |
| node_modules/tmp                                                               | 0.2.5   | 0.2.7  |
| node_modules/vite/node_modules/picomatch                                       | 4.0.3   | 4.0.7  |
| node_modules/vitest/node_modules/picomatch                                     | 4.0.3   | 4.0.7  |
| node_modules/ws                                                                | 8.19.0  | 8.22.0 |

## Applicability and remaining work

- proxy-addr: upgraded beyond the advisory fix at 2.0.8. CMS uses numeric trust proxy = 2, not the malformed IPv6 subnet described by [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h). The specific exploit condition was not found; patching removes the flagged dependency. Deployment topology and forwarded-header trust still need runtime verification.
- ws: upgraded to 8.22.0, beyond the 8.21.0 fix for [fragment memory exhaustion](https://github.com/advisories/GHSA-96hv-2xvq-fx4p). No direct server WebSocket listener was found in the source search; transitive use still warrants updating.
- Remaining high findings need prioritization: investigate the QuickBooks OAuth dependency chain without disrupting authorization/refresh; evaluate Drizzle and Zod upgrades with compatibility tests; resolve remaining nested ip-address/nanoid versions via their owning dependencies.
- Remaining moderate/low findings are not accepted risks. Review Sentry/OpenTelemetry and rate-limit dependencies, followed by export/email chains. Do not follow npm suggestions to downgrade ExcelJS or force a major update without feature testing.

## Remaining package findings

Fix availability below is npm metadata, not a validated remediation plan.

| Package                                 | Severity | Suggested fix                                   |
| --------------------------------------- | -------- | ----------------------------------------------- |
| @opentelemetry/core                     | moderate | npm reports a fix; compatibility review pending |
| @opentelemetry/instrumentation-http     | moderate | npm reports a fix; compatibility review pending |
| @opentelemetry/instrumentation-knex     | moderate | npm reports a fix; compatibility review pending |
| @opentelemetry/instrumentation-mongoose | moderate | npm reports a fix; compatibility review pending |
| @opentelemetry/instrumentation-mysql    | moderate | npm reports a fix; compatibility review pending |
| @opentelemetry/instrumentation-mysql2   | moderate | npm reports a fix; compatibility review pending |
| @opentelemetry/instrumentation-pg       | moderate | npm reports a fix; compatibility review pending |
| @opentelemetry/instrumentation-tedious  | moderate | npm reports a fix; compatibility review pending |
| @opentelemetry/resources                | moderate | npm reports a fix; compatibility review pending |
| @opentelemetry/sdk-trace-base           | moderate | npm reports a fix; compatibility review pending |
| @react-email/render                     | low      | resend 6.36.1 (range change)                    |
| @sentry/node                            | moderate | npm reports a fix; compatibility review pending |
| decode-uri-component                    | high     | No npm automatic fix                            |
| deepmerge                               | low      | resend 6.36.1 (range change)                    |
| drizzle-orm                             | high     | drizzle-orm 0.45.4 (range change)               |
| esbuild                                 | low      | npm reports a fix; compatibility review pending |
| exceljs                                 | moderate | exceljs 3.4.0 (range change)                    |
| express-rate-limit                      | moderate | npm reports a fix; compatibility review pending |
| html-to-text                            | low      | resend 6.36.1 (range change)                    |
| intuit-oauth                            | high     | No npm automatic fix                            |
| ip-address                              | high     | npm reports a fix; compatibility review pending |
| nanoid                                  | high     | npm reports a fix; compatibility review pending |
| postcss-selector-parser                 | moderate | npm reports a fix; compatibility review pending |
| qs                                      | moderate | npm reports a fix; compatibility review pending |
| query-string                            | high     | No npm automatic fix                            |
| resend                                  | low      | resend 6.36.1 (range change)                    |
| uuid                                    | moderate | exceljs 3.4.0 (range change)                    |
| zod                                     | high     | zod 4.6.7 (range change)                        |
| zod-validation-error                    | high     | zod-validation-error 5.0.0 (range change)       |

## Validation and deployment

Local validation passed: all 337 tests in 41 files, TypeScript, production client/server build, formatting and git diff checks. This independent branch starts from main and does not include tests added in other pending PRs. GitHub CI and runtime smoke tests remain pending. Dependency changes require a fresh deployment; deployed services do not inherit this lockfile automatically. Before release, verify CI and smoke-test login, Square/QuickBooks connectivity, spreadsheet export and ordinary CMS requests in an isolated environment. Roll back by reverting the lockfile commit and redeploying the previous verified release if needed.

## Gusto evidence and deferred controls

Gusto lists vulnerability scanning and remediation among the evidence it may request from applicants without formal audits: [security review](https://docs.gusto.com/app-integrations/docs/security-review). This review provides a starting inventory and remediation record only. No claim that all findings are resolved or that Gusto has approved CMS.

Seth deferred the paid backup upgrade until Gusto responds. Backup/restore evidence remains pending. Audit migration 164 has user-supplied production verification; atomic tip-approval logging is prepared separately in PR 62. Scheduling UI work is separate.
