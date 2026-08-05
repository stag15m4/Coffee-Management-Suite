# CMS Integration Spec — Overhead / Operating-Expense Write Path

For Alfred's Claude Code session. This describes a **live** endpoint in the Coffee
Management Suite (CMS) that lets Alfred write operating-expense / overhead values
into CMS after reading statements, receipts, or spreadsheets in chat.

Scope: **operating expenses / overhead ONLY** (the line items that feed CMS's
cost-per-minute overhead rate). Not COGS, not ingredient costs.

---

## The one thing that differs from the original assumption

CMS overhead is **not** a monthly ledger. It is a living list of line items, each:

```
{ id, name, amount, frequency }
```

- There is **no month/period dimension.** Setting a category **overwrites** its
  current value — it does not append a dated entry or store per-month history.
- Each item has a **`frequency`** — one of
  `daily | weekly | bi-weekly | monthly | quarterly | annual`.
- `name` is **not unique** per tenant (a shop can have two "Insurance" items).

Consequence for Alfred: this is **set/upsert on a line item**, not a monthly
record. You may pass `effective_month`, but it is used **only in the human-readable
summary string** — it changes nothing in storage. There is no way to record "August's
rent" vs "September's rent" as separate values; a second write to the same category
just overwrites. Always read the returned `summary` back to the human before
confirming.

---

## Endpoint

```
POST /api/alfred/overhead
```

- Auth header: `X-Alfred-Token: <the same token used for the GET /api/alfred/* reads>`
- Content-Type: `application/json`
- One endpoint, two steps, dispatched on request-body shape.
- The category vocabulary matches `GET /api/alfred/overhead` exactly (same `name`
  and `frequency` values) — use that read endpoint to discover existing items and
  their `id`s.

### Step 1 — PROPOSE (writes nothing)

Send the expense fields and **no** `confirmationToken`:

```json
{
  "tenant_id": "auto",
  "category": "Rent",
  "amount": 2200,
  "frequency": "monthly",
  "effective_month": "2026-08",
  "id": "d6f39fe6-…"
}
```

Field notes:

| Field             | Required | Notes                                                                                                                                                           |
| ----------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenant_id`       | yes      | Accepts `"auto"` for a single-tenant token, or an explicit tenant UUID in the token's allowlist.                                                                |
| `category`        | yes      | The overhead line-item name (e.g. `Rent`, `Insurance`). Trimmed; ≤ 100 chars.                                                                                   |
| `amount`          | yes      | Number ≥ 0. Rounded to cents. The recurring amount **in terms of `frequency`**.                                                                                 |
| `frequency`       | no       | One of `daily, weekly, bi-weekly, monthly, quarterly, annual`. On **update**, omit to keep the item's existing frequency. On **insert**, defaults to `monthly`. |
| `effective_month` | no       | `YYYY-MM`. **Summary text only** — does not affect storage.                                                                                                     |
| `id`              | no       | Target a specific item (from `GET /api/alfred/overhead`). Use this to disambiguate when a category name matches several items.                                  |

Target resolution:

- If `id` is given → updates that item.
- Else match by case-insensitive `category` name:
  - **0 matches → INSERT** a new item.
  - **1 match → UPDATE** that item's amount (and frequency if provided).
  - **> 1 match → 400** with a `candidates` array — retry with an explicit `id`.

Response (`200`):

```json
{
  "proposed": true,
  "summary": "Set Rent to $2,200.00 (monthly) for August 2026 — was $2,150.00.",
  "confirmationToken": "570153a3c8d7bff6cb8c710c26ae529516c2ec5beabc412e",
  "expires_at": "2026-08-05T16:42:27.606Z",
  "change": {
    "operation": "update",
    "category": "Rent",
    "item_id": "d6f39fe6-692c-4f9e-8cf3-9a8bf856caec",
    "amount": 2200,
    "previous_amount": 2150,
    "frequency": "monthly",
    "effective_month": "2026-08"
  }
}
```

`operation` is `"update"` or `"insert"`. `previous_amount` is `null` for inserts.
Read `summary` back to the human before confirming.

### Step 2 — CONFIRM (performs the write)

Send **only** the token:

```json
{ "confirmationToken": "570153a3c8d7bff6cb8c710c26ae529516c2ec5beabc412e" }
```

Response (`200`):

```json
{
  "applied": true,
  "operation": "update",
  "summary": "Set Rent to $2,200.00 (monthly) for August 2026 — was $2,150.00.",
  "item": { "id": "d6f39fe6-…", "name": "Rent", "amount": 2200, "frequency": "monthly" }
}
```

Tokens are **single-use** and expire **5 minutes** after propose. They are persisted
server-side (survive redeploys; safe across instances).

---

## Error table

| HTTP  | When                                       | Example body                                                                                                                                                                                             |
| ----- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400` | `amount` not a number ≥ 0                  | `{"error":"amount must be a number >= 0"}`                                                                                                                                                               |
| `400` | bad `frequency`                            | `{"error":"frequency must be one of: daily, weekly, bi-weekly, monthly, quarterly, annual"}`                                                                                                             |
| `400` | empty `category`                           | `{"error":"category is required (the overhead line-item name)"}`                                                                                                                                         |
| `400` | bad `effective_month`                      | `{"error":"effective_month must be YYYY-MM"}`                                                                                                                                                            |
| `400` | unknown `id` for this tenant               | `{"error":"No overhead item with id … for this tenant"}`                                                                                                                                                 |
| `400` | category matches several items             | `{"error":"\"Insurance\" matches 2 overhead items — pass an explicit \"id\" to disambiguate","candidates":[{"id":"…","amount":150,"frequency":"monthly"},{"id":"…","amount":99,"frequency":"monthly"}]}` |
| `401` | missing/wrong `X-Alfred-Token`             | `{"error":"Authentication required"}`                                                                                                                                                                    |
| `403` | `tenant_id` not in the token's allowlist   | `{"error":"Token is not authorized for tenant … — check tenant_id against the token's allowlist"}`                                                                                                       |
| `404` | confirm: unknown token                     | `{"error":"Unknown confirmation token"}`                                                                                                                                                                 |
| `409` | confirm: token already used                | `{"error":"This confirmation token has already been used"}`                                                                                                                                              |
| `409` | confirm: target item deleted since propose | `{"error":"The target overhead item no longer exists — re-propose to apply this change"}`                                                                                                                |
| `410` | confirm: token expired (> 5 min)           | `{"error":"Confirmation token expired — re-propose to get a fresh one"}`                                                                                                                                 |

---

## Recommended Alfred flow

1. Human hands Alfred a statement/receipt/spreadsheet in chat.
2. Alfred parses and categorizes it against CMS's existing overhead categories
   (read them from `GET /api/alfred/overhead`). All parsing/OCR happens in Alfred.
3. For each clean `{category, amount, frequency?}`, Alfred calls **propose**.
4. Alfred reads each returned `summary` back to the human.
5. On human approval, Alfred calls **confirm** with the `confirmationToken`.

### Idempotency caveat

Because writes overwrite and there is no month key, if Alfred processes the same
statement twice it will set the same value twice (harmless), and it **cannot**
detect "I already recorded this month" from CMS. Rely on the propose `summary`
(which shows `was $X` → new value) and human confirmation to catch mistakes.

### Reading the data back

`GET /api/alfred/overhead?tenant_id=auto` returns:

```json
{
  "tenant_id": "…",
  "settings": { "operating_days_per_week": 7, "hours_open_per_day": 8, "owner_tips_enabled": true },
  "items": [
    { "id": "…", "name": "Rent", "amount": "2200.00", "frequency": "monthly", "created_at": "…", "updated_at": "…" }
  ],
  "item_count": 1
}
```

Use the `id` from here to disambiguate duplicate category names on write.
