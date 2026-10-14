# Codex and other coding agents

## Alfred integration contract (required)

Before designing, implementing, reviewing, or wiring any endpoint Alfred can call, read [Alfred Integration Conventions](docs/ALFRED_API_CONVENTIONS.md) and [implementation notes](docs/ALFRED_API_IMPLEMENTATION_NOTES.md). Apply the same contract in this app and on Alfred's calling side.

Use `X-Alfred-Token` with the app's shared secret; reject missing/wrong tokens with HTTP 401 and a JSON `message`. Reads return JSON with human-readable messages on errors; file-returning reads return raw bytes with a real Content-Type. Every Alfred write requires a mutation-free proposal and a separately approved confirmation on the same POST URL. Confirm sends only `confirmationToken`; tokens are single-use with a 300-second TTL. Show the returned summary verbatim, never auto-confirm, return distinguishable token errors, and return candidates for ambiguous matches.

Preserve all existing tenant/entity permissions and owner-verification requirements. Dedicated compliance service credentials remain separate. Document known legacy differences instead of claiming unverified compliance or silently changing live APIs. For new apps, copy the standard and the Claude/Codex pointers before adding their first Alfred integration.

Read any existing repository-specific guidance in `CLAUDE.md` as well. Keep this reference in source control so future sessions can load it without relying on chat history.
