# CMS Integration Spec — Ingredient Write Path (Batch)

For Alfred's Claude Code session. This describes a **live** endpoint in the Coffee
Management Suite (CMS) that lets Alfred write ingredient cost/quantity updates —
and now create brand-new ingredients — into CMS after reading a distributor
invoice, receipt, or price sheet in chat.

Scope: `cost`/`quantity` updates on existing ingredients, and creating new ones
with `name`/`unit`/`cost`/`quantity`. Not `unit` changes on an existing ingredient,
not `vendor_id` — see "What this does NOT do" below.

**Changelog:** this endpoint was update-only at first. It now also supports
creating new ingredients (`"new": true` on an item) — see "Creating a new
ingredient" below if you've integrated against the update-only version before.

---

## The one thing that differs from overhead's write path

Overhead writes one line item per call. This endpoint writes a **batch** — a whole
invoice's worth of ingredient changes, updates and new products together — behind
a **single** confirmation token, because a real distributor invoice is typically
10–30 line items, and proposing/confirming each one individually would mean 20+
round trips per invoice.

Consequence: **the batch is all-or-nothing**, at both steps.

- **Propose** resolves every line item — to exactly one existing ingredient for an
  update, or to a genuinely new name for a create — before issuing a token. If ANY
  item fails to resolve or validate, the WHOLE call is rejected with a 400 and **no
  token is issued** — fix that one line and resubmit the batch.
- **Confirm** applies every item in one database transaction. If an update's target
  ingredient was deleted, or a create's name collides with something inserted since
  propose, the WHOLE batch rolls back — nothing is left half-applied.

## `cost` and `quantity` are a pair — never send one without the other

CMS stores `cost` as **the price of the whole package** and `quantity` as **the
package size** — unit cost, which is what every recipe's margin is computed from, is
`cost / quantity`. Both fields are **required on every item**, update or create.

This matters because of how distributor invoices are usually written: a line item
states a **case price**, not a per-unit price. If you send the new case total as
`cost` without also updating `quantity` to the case size, CMS has no way to tell that
apart from a legitimate price increase — the unit cost will be silently wrong by
whatever the case size was.

**Before proposing, read the ingredient's current `quantity` and `unit` from**
**`GET /api/alfred/ingredients` and reason about what the invoice actually changed:**

- Case price went up, same case size → keep `quantity` as-is, update `cost`.
- Vendor switched to a bigger case, same or different price → update `cost` AND
  `quantity`.
- Invoice states a per-unit price but CMS tracks whole cases (or vice versa) →
  convert before sending; don't send the invoice's raw number if it isn't already
  expressed against CMS's existing `quantity`/`unit`.

Every `propose` response includes `unit_cost` (new, and `previous_unit_cost` for
updates) for each item — computed by CMS, not by you. **Read that back to the
human, not just the raw price** — it's the number that actually catches a
case/unit mixup.

---

## Creating a new ingredient

Set `"new": true` on an item instead of `id`/`name`-matching an existing one:

```json
{ "new": true, "name": "Vanilla Syrup", "unit": "bottle", "cost": 12.0, "quantity": 1 }
```

- `id` is not allowed on a create item (a new ingredient has no id yet).
- `unit` is **required** on a create and rejected on every other item — it's
  otherwise immutable through this endpoint.
- If the name exactly matches an existing ingredient (case/whitespace-insensitive),
  propose 400s and tells you to update it by `id` instead — this endpoint will
  never silently turn a create into an update or vice versa.
- If the name **closely resembles** an existing ingredient (a likely typo or a
  suffixed variant like `"Oat Milk (Case)"` vs `"Oat Milk"`) propose does **not**
  block it, but flags it: the item's `possible_duplicate` field is set, and the
  summary line for that item says so explicitly. **Read this back to the human
  before confirming** — creating a real duplicate silently is worse than a
  false-positive warning, so treat any flagged create as needing a yes/no from the
  human, not an automatic go-ahead.
- A create's name is re-checked for a collision again at confirm time (there's no
  database constraint stopping two ingredients from sharing a name, so this is the
  only thing protecting against a race with a concurrent write) — if it lost that
  race, confirm 409s and the whole batch is not applied.
- You can mix creates and updates in the same batch — a real invoice usually has
  both.

---

## What this does NOT do

- **No `unit` changes on an existing ingredient.** `unit` (e.g. `lb`, `oz`, `each`)
  is set once at creation and read-only after. A pack size changing (5 lb bag → 5 lb
  bag, same unit) is a `quantity` change, not a `unit` change. If the unit itself
  genuinely needs to change, that's a human edit in CMS.
- **No `vendor_id` changes**, on either updates or creates.

---

## Endpoint

```
POST /api/alfred/ingredients
```

- Auth header: `X-Alfred-Token: <the same token used for every other Alfred call>`
- Content-Type: `application/json`
- One endpoint, two steps, dispatched on request-body shape.
- Read `GET /api/alfred/ingredients?tenant_id=auto` first to get current `id`,
  `name`, `unit`, `cost`, `quantity` for every ingredient — you need this both to
  build update items and to check whether a "new" product is really new.

### Step 1 — PROPOSE (writes nothing)

Send the whole batch and **no** `confirmationToken`. Items can be a mix of updates
and creates:

```json
{
  "tenant_id": "auto",
  "items": [
    { "name": "Espresso Beans", "cost": 45.0, "quantity": 5 },
    { "id": "3f9c1e2a-…", "cost": 54.0, "quantity": 6 },
    { "new": true, "name": "Vanilla Syrup", "unit": "bottle", "cost": 12.0, "quantity": 1 }
  ]
}
```

Per-item fields:

| Field      | Required                                 | Notes                                                                                       |
| ---------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `new`      | no (default false)                       | `true` creates a new ingredient instead of updating an existing one.                        |
| `id`       | update: one of `id`/`name`               | Target a specific ingredient. Not allowed when `new` is true.                               |
| `name`     | update: one of `id`/`name` · create: yes | Case-insensitive, trimmed. Update: must match an existing ingredient. Create: the new name. |
| `unit`     | create: yes · update: not allowed        | e.g. `lb`, `oz`, `each`. Required for a create, rejected on an update item.                 |
| `cost`     | yes                                      | Number ≥ 0. Price of the whole package. Rounded to cents.                                   |
| `quantity` | yes                                      | Number > 0. Package size `cost` is divided by.                                              |

Batch limits: 1–50 items per call (updates + creates combined). Larger invoices →
split into multiple `propose`/`confirm` pairs.

Target resolution:

- **Update** (`new` not set):
  - `id` given → that ingredient. 400 if it doesn't exist for this tenant.
  - Else match by case-insensitive `name`:
    - **0 matches → 400** — no insert happens implicitly; if it should be a new
      ingredient, resend that line with `"new": true` and a `unit`.
    - **1 match → resolved.**
    - **> 1 match → 400** with a `candidates` array — retry with an explicit `id`.
- **Create** (`new: true`):
  - Exact name match (case/whitespace-insensitive) → 400 with an `existing` array —
    update it instead.
  - No exact match → resolved, with `possible_duplicate` set if a near-match exists.
- Two items in the same batch targeting the same existing ingredient, or two
  creates with the same normalized name → 400.

Response (`200`):

```json
{
  "proposed": true,
  "summary": "Update 2 ingredients and add 1 new ingredient:\n- Espresso Beans: $42.00 → $45.00 for 5 lb ($8.40/lb → $9.00/lb)\n- Oat Milk: $48.00 → $54.00 for 6 carton ($8.00/carton → $9.00/carton)\n- Vanilla Syrup (NEW): $12.00 for 1 bottle ($12.00/bottle)",
  "confirmationToken": "8a1e...f02c",
  "expires_at": "2026-09-25T16:42:27.606Z",
  "changes": [
    {
      "kind": "update",
      "item_id": "…",
      "name": "Espresso Beans",
      "unit": "lb",
      "cost": 45.0,
      "previous_cost": 42.0,
      "quantity": 5,
      "previous_quantity": 5,
      "unit_cost": 9.0,
      "previous_unit_cost": 8.4
    },
    {
      "kind": "create",
      "name": "Vanilla Syrup",
      "unit": "bottle",
      "cost": 12.0,
      "quantity": 1,
      "unit_cost": 12.0,
      "possible_duplicate": null
    }
  ]
}
```

A flagged create looks like:

```json
{
  "kind": "create",
  "name": "Oat Milk (Case)",
  "unit": "case",
  "cost": 48.0,
  "quantity": 1,
  "unit_cost": 48.0,
  "possible_duplicate": { "id": "…", "name": "Oat Milk" }
}
```

**Read the `summary` back to the human before confirming.** It always shows
$/unit for updates (catches a case/unit mixup) and calls out `(NEW)` items and any
possible-duplicate warning inline, in the same text.

### Step 2 — CONFIRM (performs the write)

Send **only** the token:

```json
{ "confirmationToken": "8a1e...f02c" }
```

Response (`200`):

```json
{
  "applied": true,
  "summary": "Update 2 ingredients and add 1 new ingredient:\n- …",
  "items": [
    { "id": "…", "name": "Espresso Beans", "unit": "lb", "cost": 45, "quantity": 5, "kind": "update" },
    { "id": "…", "name": "Vanilla Syrup", "unit": "bottle", "cost": 12, "quantity": 1, "kind": "create" }
  ]
}
```

Tokens are **single-use**, cover the **whole batch**, and expire **5 minutes** after
propose. They are persisted server-side (survive redeploys; safe across instances).

---

## Error table

| HTTP  | When                                                             | Example body                                                                                                                                                        |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400` | `items` missing/empty/not an array                               | `{"error":"\"items\" must be a non-empty array"}`                                                                                                                   |
| `400` | more than 50 items                                               | `{"error":"A batch can have at most 50 items — split into multiple calls"}`                                                                                         |
| `400` | a create item also has `id`                                      | `{"error":"items[0]: a new ingredient can't also specify \"id\""}`                                                                                                  |
| `400` | a create item has no `name`                                      | `{"error":"items[0]: a new ingredient needs a \"name\""}`                                                                                                           |
| `400` | a create item has no (or a blank) `unit`                         | `{"error":"items[0]: a new ingredient needs a \"unit\" (e.g. \"lb\", \"oz\", \"each\")"}`                                                                           |
| `400` | an update item includes `unit`                                   | `{"error":"items[0]: \"unit\" is only accepted when \"new\" is true — unit can't be changed on an existing ingredient here"}`                                       |
| `400` | an item missing both `id` and `name` (and not marked `new`)      | `{"error":"items[2] needs an \"id\" or a \"name\" to identify the ingredient"}`                                                                                     |
| `400` | `cost` not a number ≥ 0                                          | `{"error":"items[0].cost must be a number >= 0"}`                                                                                                                   |
| `400` | `quantity` not a number > 0                                      | `{"error":"items[0].quantity must be a number > 0 — it's the package size \"cost\" is divided by to get unit cost"}`                                                |
| `400` | update: name doesn't match any ingredient                        | `{"error":"items[1]: no ingredient named \"Almond Milk\" for this tenant — pass \"new\": true (with a \"unit\") to create it"}`                                     |
| `400` | update: name matches several ingredients                         | `{"error":"items[1]: \"Milk\" matches 2 ingredients — pass an explicit \"id\" to disambiguate","candidates":[…]}`                                                   |
| `400` | update: unknown `id` for this tenant                             | `{"error":"items[0]: no ingredient with id … for this tenant"}`                                                                                                     |
| `400` | create: name already exists exactly                              | `{"error":"items[0]: an ingredient named \"Oat Milk\" already exists — pass its \"id\" to update it instead of creating a duplicate","existing":[…]}`               |
| `400` | two items target/create the same ingredient                      | `{"error":"items[2]: \"Espresso Beans\" is targeted by more than one item in this batch"}`                                                                          |
| `401` | missing/wrong `X-Alfred-Token`                                   | `{"error":"Authentication required"}`                                                                                                                               |
| `403` | `tenant_id` not in the token's allowlist                         | `{"error":"Token is not authorized for tenant … — check tenant_id against the token's allowlist"}`                                                                  |
| `404` | confirm: unknown token                                           | `{"error":"Unknown confirmation token"}`                                                                                                                            |
| `409` | confirm: token already used                                      | `{"error":"This confirmation token has already been used"}`                                                                                                         |
| `409` | confirm: one update target deleted since propose                 | `{"error":"\"Oat Milk\" no longer exists — the whole batch was NOT applied. Re-propose to apply the remaining changes."}`                                           |
| `409` | confirm: a create's name was taken by someone else since propose | `{"error":"An ingredient named \"Vanilla Syrup\" was created since this batch was proposed — the whole batch was NOT applied. Re-propose to review the conflict."}` |
| `410` | confirm: token expired (> 5 min)                                 | `{"error":"Confirmation token expired — re-propose to get a fresh one"}`                                                                                            |

---

## Recommended Alfred flow

1. Human hands Alfred a distributor invoice/receipt/price sheet in chat.
2. Alfred reads `GET /api/alfred/ingredients?tenant_id=auto` to get current names,
   `id`s, `unit`s, `cost`, and `quantity` for every ingredient.
3. Alfred parses the invoice and matches each line to an existing ingredient where
   possible, converting the invoice's price/pack-size to CMS's existing
   `quantity`/`unit` when they differ (see "cost and quantity are a pair" above).
   A line with no clear match is proposed as `"new": true` with its own `unit`,
   not silently dropped.
4. Alfred calls **propose** with the whole batch — updates and creates together —
   in one call.
5. Alfred reads the returned `summary` back to the human verbatim, line by line —
   it shows $/unit for updates and flags `(NEW)` items, including any
   `possible_duplicate` warning, inline.
6. On human approval, Alfred calls **confirm** with the `confirmationToken`. If any
   item was flagged as a possible duplicate, get an explicit yes on that line
   specifically before confirming the batch — don't treat silence as approval.
7. If propose 400s on one bad line, fix just that line and re-propose the batch —
   don't drop it silently.

### Idempotency caveat

Same as overhead: an update is a plain `SET cost, quantity`, not an append.
Processing the same invoice twice sets the same values twice (harmless — it's
idempotent), but CMS cannot tell you "this invoice was already recorded." A create
is different: processing the same invoice twice will hit the exact-name conflict
on the second pass (400, not a duplicate row) — that's expected, not a bug. Rely on
the propose `summary`'s `was $X` values and human confirmation to catch
reprocessing either way.
