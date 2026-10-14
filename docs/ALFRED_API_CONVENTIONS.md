# Alfred Integration Conventions

For any app building `/api/alfred/*` endpoints for Alfred to call (CMS,
Laundroweb, Gunderhouse, The Consultant, SG Legal, or anything new). Every
integration that already follows this shape — maintenance logs, machine
status, utility bills, documents, overhead, ingredient costs, tasks — has
needed zero back-and-forth to wire up. Deviating from it is what generates
the round of questions.

## Auth

Every request carries `X-Alfred-Token: <shared secret>`. One token per app,
configured on Alfred's side as an env var — nothing for you to rotate per
request. Reject anything missing or wrong with a plain `401`.

## Reads — plain GET, JSON

Nothing special. On a non-2xx, still return a JSON body with a human-readable
`message` field rather than a bare status code or an empty body — Alfred
relays that message directly to the person asking, so a blank `403` just
becomes "something went wrong" instead of the real reason.

## Writes — two-step propose/confirm, always

This is the one pattern to get exactly right. **Every** write Alfred can make
goes through it — there is no "just do it" single-call write anywhere in this
system, on purpose. The whole point is that nothing is ever written to your
data without a human having read a plain-English description and said yes —
Alfred enforces that mechanically, not just by being asked nicely.

**Same URL, same method (POST), for both steps.** What distinguishes a
propose call from a confirm call is simply whether `confirmationToken` is
present in the request body:

### Step 1 — Propose (no `confirmationToken` in the body)

Request body: the actual fields for the write (whatever's specific to this
action — a machine id and status, a lease file, a task's due date, etc.)

**Must write nothing.** Response:

```json
{
  "status": "proposed",
  "summary": "Set Square POS Services overhead to $209.79/mo (was $201.00).",
  "confirmationToken": "a-single-use-opaque-token",
  "expiresInSeconds": 300
}
```

`summary` is not cosmetic. Alfred shows it to the human **verbatim** —
often literally as the text on a confirm button — before anything happens.
Write it as a complete, accurate sentence describing exactly what will be
written, in plain English, no ids or jargon a human wouldn't say out loud.

### Step 2 — Confirm (body is `{ "confirmationToken": "..." }` ONLY)

Performs the actual write. Response:

```json
{
  "status": "confirmed",
  "recordId": "...",
  "record": { "...": "the full written record" }
}
```

(`recordId`'s actual key name is yours to choose — `utilityBillId`,
`documentId`, `taskId`, whatever reads naturally. Alfred doesn't require a
specific key here, only that _something_ identifying the written record
comes back.)

### Token rules

- **Single-use.** A token works once, for exactly one of propose-then-confirm.
- **Short-lived — 300 seconds (5 minutes) is the convention every existing
  integration uses.** Match it unless you have a specific reason not to.
- An expired or already-used token on confirm should return a clear,
  distinguishable error (see below) — Alfred's instructed to just propose
  again silently rather than apologize, so make that the obviously-correct
  recovery path, not a dead end.

## Errors

Always a JSON body, never a bare status code with nothing else, including on
a 500. A `message` field with one human-readable sentence is the minimum —
that sentence gets relayed to the person as-is. A stable `error` code
alongside it (e.g. `"token_expired"`, `"not_found"`) is useful if Alfred
should ever branch on it, but isn't required.

**Ambiguous match:** if a field like a machine name, category, or document
id could reasonably match more than one real record, don't silently pick
one — return a 4xx with the candidates (id + name for each). Alfred is
instructed to always read candidates back and ask which one, never guess.

## File-returning endpoints (if you have one)

If an endpoint's whole job is returning an actual file (not metadata about
one), return **raw bytes with a real `Content-Type` header** — not a
JSON-wrapped base64 string. Alfred expects a binary response on these and
has a separate code path for it; wrapping it in JSON just means more work on
both ends for no benefit. (Metadata _about_ files — name, size, type, a list
of them — is still normal JSON, same as any other read.)

## Quick self-check before calling a new endpoint "spec'd"

- [ ] Same URL/method for propose and confirm; `confirmationToken` presence
      is the only thing that distinguishes them
- [ ] Propose writes nothing, ever — confirmed only by a real separate call
- [ ] `summary` is a complete, accurate, human-readable sentence
- [ ] Token is single-use, ~300s TTL
- [ ] Every response — success or error — is a JSON body with a `message`
      (or, for file endpoints, raw bytes + real `Content-Type`)
- [ ] Ambiguous matches return candidates instead of guessing
