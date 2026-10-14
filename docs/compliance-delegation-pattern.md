# Accountable-owner workflow pattern (v1)

The accountable owner is the verifier. The owner delegates execution, defines
required evidence, reviews the submission, returns deficient work, and verifies
completeness. A worker's submission does not close an obligation. This pattern
should be reused as the system grows.

## Responsibilities and privacy

| Role / app        | Allowed responsibility                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Legal             | Private responsibility hub, owner review, evidence, immutable history, durable commands                 |
| CMS / Laundroweb  | Authenticate their own users; show only their assigned duties; accept evidence; own operational records |
| Accountable owner | Existing Legal user with access to that entity; delegates, returns, verifies                            |
| Executor          | Existing business user or entity-authorized Legal user; submits evidence                                |
| Alfred            | Read consolidated dates, owner, executor, stage and connection freshness from Legal                     |

Managers need no Legal account or navigation link. CPA/attorney duty privileges
operate within existing entity access and do not grant financial administration
or access to family modules. Administrators can change responsibility, but cannot
verify another owner's duty. The owner may execute the duty themselves; owner
review is still explicit.

## State and authority

`open → submitted → verification_pending → verified` for connected businesses.
Native Legal duties move from submitted directly to verified after owner review.
The owner can return submitted work with correction instructions, producing
`returned → submitted`. Source acknowledgement, not a successful network send,
finishes a connected duty. Only verified duties appear completed to Alfred.

Every mutation uses the current revision. A stale form or review fails. Changes
to title, due date, notes, or recurrence invalidate a submission and rebind the
updated duty before more evidence can be submitted. Completed verified source
records cannot be reopened or edited through legacy calendar controls. Retain
verification history; adjust a future renewal or create a new duty instead.

## Integration contract

Use `docs/compliance-workflow-v1.json` in all four repositories as the shared
cross-language fixture. Update it and the Python/TypeScript contract tests
together when changing the contract. Source fingerprints are SHA256 over UTF-8
compact JSON `[title, due_date, notes || "", recurrence || "none"]`, with civil
YYYY-MM-DD dates and literal Unicode. Do not trim titles in transit.

Legal queues version-1 `bind` and `verify` commands with event UUID, obligation
UUID, revision, business/record identity, expected fingerprint, owner display
name, assignee identity and evidence requirements. Source transaction checks
scope, fingerprint and binding; atomic event receipts make retrying the same
event idempotent. A network failure retains the command for retry. A source
conflict requires owner attention rather than silently closing the record.

Use three distinct credentials per source:

| Purpose                    | Source variable              | Legal variable                                                       | Capability                      |
| -------------------------- | ---------------------------- | -------------------------------------------------------------------- | ------------------------------- |
| Snapshot / eligible people | COMPLIANCE_SERVICE_TOKEN     | CMS_COMPLIANCE_TOKEN / LAUNDROWEB_COMPLIANCE_TOKEN                   | Read only                       |
| Assigned-work relay        | LEGAL_COMPLIANCE_RELAY_TOKEN | CMS_COMPLIANCE_RELAY_TOKEN / LAUNDROWEB_COMPLIANCE_RELAY_TOKEN       | Submit / read own assignments   |
| Verified source commands   | COMPLIANCE_WORKFLOW_TOKEN    | CMS_COMPLIANCE_WORKFLOW_TOKEN / LAUNDROWEB_COMPLIANCE_WORKFLOW_TOKEN | Bind / apply owner verification |

Source servers use fixed HTTPS LEGAL_COMPLIANCE_URL and derive actor/business
from a freshly validated account. Browser-supplied actor identifiers are
ignored. Tokens stay on servers and are never reused for Alfred. CMS tenant
allowlist applies to read and workflow commands. Relay credentials are source
specific and never authorize owner review routes.

## Evidence and renewal

Submissions, evidence bytes, SHA256 hashes, and audit events remain immutable.
Require completion notes plus files or a confirmation reference. Accept up to
three PDF/PNG/JPEG/WebP files totaling 5 MB; check byte signatures, not filename
extensions. Authenticated evidence downloads are forced attachments. A hash and
signature check do not establish truth; the accountable owner reviews actual
content and completeness.

Verified completion creates at most one next source record per parent. The new
record is immediately protected with a placeholder binding. Legal assigns the
renewal a fresh obligation ID and inherits owner, executor and evidence criteria.
Use the prior due date as the recurrence anchor and clamp month ends/leap days.
Missing source records, missing owners, and revoked/deleted assignees require
attention. Connections with outstanding duties cannot be disconnected.

## Build and release style

1. Start from the deployed branch in each repo and preserve unrelated changes.
2. Agree on responsibilities and contract before implementing app-specific UIs.
3. Keep business execution in business apps and central verification in Legal.
4. Put invariants at server/database boundaries; UI controls reinforce them.
5. Use additive schemas, immutable history, revisions, an outbox, and idempotent
   source receipts. Fail closed; keep the last good snapshot on source failure.
6. Test behavior: permission boundaries, spoofed identity, rejected legacy
   completion, stale revisions, returned submissions, retries and recurrence.
7. Document the shared contract, configuration, migrations and activation order
   in the same change. Run local checks and CI before merging deployed branches.
8. Confirm deployed commits, health, unauthorized access rejection and read
   interoperability. Do not assign real work or fabricate entity mappings in a
   smoke test.

Deployment prerequisites: CMS applies additive Supabase migration **163** through
its versioned pre-deploy script before replacing the healthy app (failure stops
the release); Laundroweb applies its additive Prisma schema through its
existing pre-deploy command; Legal initializes SQLite tables at startup. Deploy
source support first, Legal next, Alfred reporting last. Use separate random
relay/write keys for each business. Existing source/entity connections are
required; credentials alone do not establish a legal-entity mapping.

Backups must cover Legal's existing persistent SQLite database including evidence.
No email, invitation, or notification is sent by this implementation. New apps
should implement this contract and tests rather than copy a generic Legal login
or invent a different definition of completed work.
