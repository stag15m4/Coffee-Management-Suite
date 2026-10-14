# Applying the Alfred integration standard

Read [Alfred Integration Conventions](ALFRED_API_CONVENTIONS.md) before designing or changing any integration Alfred calls. That document preserves Seth's supplied contract. These notes resolve its examples and implementation boundaries without changing the contract.

- “Plain 401” means the HTTP status is 401 for a missing or wrong app token. Return JSON with a human-readable `message`; do not send an empty body.
- The proposed/confirmed examples show the central fields. The final checklist also requires a human-readable `message` on JSON success responses; include it alongside `summary` for proposals and the written record for confirmations.
- Proposal calls must not perform the business mutation or trigger its external effects. A proposal is never approval. The user must see the exact summary and give an explicit response before a separate confirmation request.
- Bind a confirmation token to the exact immutable proposal, action, app and authorized data scope. Confirm accepts only `{ "confirmationToken": "..." }`, never replacement write fields. Atomically enforce single use with the mutation, including across server instances; stale data must not silently change what was approved.
- Expired/used tokens produce distinct recoverable JSON errors. Re-propose without an apology loop, show the new summary, and obtain confirmation again. Never auto-confirm a replacement token using approval of an earlier proposal.
- Keep existing tenant/entity permissions, private-data restrictions, and human owner-verification gates. This document grants Alfred no additional capability. App-to-app compliance relay/verification contracts use their own credentials and authority; do not reuse an Alfred token or treat assistant confirmation as owner verification.
- Before calling an endpoint ready, check unauthorized requests, no mutation on propose, exact confirmation payload, expired/used tokens, ambiguous candidates, JSON messages on errors (including 500), and file response headers. Add meaningful contract tests when implementing endpoints; documentation alone is not an audit of existing endpoints.
- For a new repository/app, copy this standard and these notes into `docs/`, and add the pointers below to its root `CLAUDE.md` and `AGENTS.md`. When changing the standard, update all integration repos and Alfred's active app branch together so the copies remain consistent.

## Scope of this change

This is developer guidance, not a runtime migration. Existing endpoint-specific docs describe existing behavior. If they differ from this standard, identify the difference and plan an explicit compatible change; do not claim the current endpoint is conformant or silently change its API.
