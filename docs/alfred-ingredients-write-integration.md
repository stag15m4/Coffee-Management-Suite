# CMS Integration Spec — Ingredient Cost Write Path (Batch)

For Alfred's Claude Code session. This describes a **live** endpoint in the Coffee
Management Suite (CMS) that lets Alfred write ingredient cost/quantity updates into
CMS after reading a distributor invoice, receipt, or price sheet in chat.

Scope: **`cost` and `quantity` on EXISTING ingredients only.** Not `unit`, not
`vendor_id`, not new ingredients — see "What this does NOT do" below.

---

## The one thing that differs from overhead's write path

Overhead writes one line item per call. This endpoint writes a **batch** — a whole
invoice's worth of ingredient price changes — behind a **single** confirmation token,
because a real distributor invoice is typically 10–30 line items, and proposing/
confirming each one individually would mean 20+ round trips per invoice.

Consequence: **the batch is all-or-nothing**, at both steps.

- **Propose** resolves every line item to exactly one existing ingredient before
  issuing a token. If ANY item fails to match (unknown name, ambiguous name, bad
  number), the WHOLE call is rejected with a 400 and **no token is issued** — fix
  that one line and resubmit the batch.
- **Confirm** applies every item's update in one database transaction. If an
  ingredient was deleted between propose and confirm, the WHOLE batch rolls back —
  nothing is left half-applied.

## `cost` and `quantity` are a pair — never send one without the other

CMS stores `cost` as **the price of the whole package** and `quantity` as **the
package size** — unit cost, which is what every recipe's margin is computed from, is
`cost / quantity`. Both fields are **required on every item**.

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

Every `propose` response includes `unit_cost` (new) and `previous_unit_cost` (old)
for each item — computed by CMS, not by you. **Read that back to the human, not just
the raw price** — it's the number that actually catches a case/unit mixup.

---

## What this does NOT do

- **No new ingredients.** An item that doesn't match an existing ingredient by `id`
  or name is a 400, not an insert. If a distributor invoice includes a genuinely new
  product, tell the human to add it in CMS first (Menu Cost Manager → Ingredients),
  then re-run the batch.
- **No `unit` changes.** `unit` (e.g. `lb`, `oz`, `each`) is read-only here. A pack
  size changing (5 lb bag → 5 lb bag, same unit) is a `quantity` change, not a `unit`
  change. If the unit itself genuinely changes, that's a human edit in CMS.
- **No `vendor_id` changes.**

---

## Endpoint

```
POST /api/alfred/ingredients
```

- Auth header: `X-Alfred-Token: <the same token used for every other Alfred call>`
- Content-Type: `application/json`
- One endpoint, two steps, dispatched on request-body shape.
- Read `GET /api/alfred/ingredients?tenant_id=auto` first to get current `id`,
  `name`, `unit`, `cost`, `quantity` for every ingredient — you need this to build
  the batch and to reason about the case/unit conversion above.

### Step 1 — PROPOSE (writes nothing)

Send the whole batch and **no** `confirmationToken`:

```json
{
  "tenant_id": "auto",
  "items": [
    { "name": "Espresso Beans", "cost": 45.0, "quantity": 5 },
    { "id": "3f9c1e2a-…", "cost": 54.0, "quantity": 6 }
  ]
}
```

Per-item fields:

| Field      | Required           | Notes                                                                                        |
| ---------- | ------------------ | -------------------------------------------------------------------------------------------- |
| `id`       | one of `id`/`name` | Target a specific ingredient (from `GET /api/alfred/ingredients`). Use to disambiguate.      |
| `name`     | one of `id`/`name` | Case-insensitive, trimmed. Must match an existing ingredient — this endpoint is update-only. |
| `cost`     | yes                | Number ≥ 0. Price of the whole package. Rounded to cents.                                    |
| `quantity` | yes                | Number > 0. Package size `cost` is divided by. Send the current value if it didn't change.   |

Batch limits: 1–50 items per call. Larger invoices → split into multiple `propose`/
`confirm` pairs.

Target resolution (per item, same as overhead):

- `id` given → that ingredient. 400 if it doesn't exist for this tenant.
- Else match by case-insensitive `name`:
  - **0 matches → 400** (`"..." not found — this endpoint only updates existing
ingredients"`). No insert.
  - **1 match → resolved.**
  - **> 1 match → 400** with a `candidates` array — retry with an explicit `id`.
- Two items in the same batch resolving to the **same** ingredient → 400 (which
  value should win is ambiguous — send one line per ingredient).

Response (`200`):

```json
{
  "proposed": true,
  "summary": "Update 2 ingredients:\n- Espresso Beans: $42.00 → $45.00 for 5 lb ($8.40/lb → $9.00/lb)\n- Oat Milk: $48.00 → $54.00 for 6 carton ($8.00/carton → $9.00/carton)",
  "confirmationToken": "8a1e...f02c",
  "expires_at": "2026-09-25T16:42:27.606Z",
  "changes": [
    {
      "item_id": "…",
      "name": "Espresso Beans",
      "unit": "lb",
      "cost": 45.0,
      "previous_cost": 42.0,
      "quantity": 5,
      "previous_quantity": 5,
      "unit_cost": 9.0,
      "previous_unit_cost": 8.4
    }
  ]
}
```

**Read the `summary` back to the human before confirming.** It's built to always show
$/unit on both sides, specifically so a case/unit mixup is visible before it's
written.

### Step 2 — CONFIRM (performs the write)

Send **only** the token:

```json
{ "confirmationToken": "8a1e...f02c" }
```

Response (`200`):

```json
{
  "applied": true,
  "summary": "Update 2 ingredients:\n- …",
  "items": [{ "id": "…", "name": "Espresso Beans", "unit": "lb", "cost": 45, "quantity": 5 }]
}
```

Tokens are **single-use**, cover the **whole batch**, and expire **5 minutes** after
propose. They are persisted server-side (survive redeploys; safe across instances).

---

## Error table

| HTTP  | When                                                 | Example body                                                                                                                  |
| ----- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `400` | `items` missing/empty/not an array                   | `{"error":"\"items\" must be a non-empty array"}`                                                                             |
| `400` | more than 50 items                                   | `{"error":"A batch can update at most 50 ingredients — split into multiple calls"}`                                           |
| `400` | an item missing both `id` and `name`                 | `{"error":"items[2] needs an \"id\" or a \"name\" to identify the ingredient"}`                                               |
| `400` | `cost` not a number ≥ 0                              | `{"error":"items[0].cost must be a number >= 0"}`                                                                             |
| `400` | `quantity` not a number > 0                          | `{"error":"items[0].quantity must be a number > 0 — it's the package size \"cost\" is divided by to get unit cost"}`          |
| `400` | name doesn't match any ingredient                    | `{"error":"items[1]: no ingredient named \"Almond Milk\" for this tenant — this endpoint only updates existing ingredients"}` |
| `400` | name matches several ingredients                     | `{"error":"items[1]: \"Milk\" matches 2 ingredients — pass an explicit \"id\" to disambiguate","candidates":[…]}`             |
| `400` | unknown `id` for this tenant                         | `{"error":"items[0]: no ingredient with id … for this tenant"}`                                                               |
| `400` | two items in the batch target the same ingredient    | `{"error":"items[2]: \"Espresso Beans\" is targeted by more than one item in this batch"}`                                    |
| `401` | missing/wrong `X-Alfred-Token`                       | `{"error":"Authentication required"}`                                                                                         |
| `403` | `tenant_id` not in the token's allowlist             | `{"error":"Token is not authorized for tenant … — check tenant_id against the token's allowlist"}`                            |
| `404` | confirm: unknown token                               | `{"error":"Unknown confirmation token"}`                                                                                      |
| `409` | confirm: token already used                          | `{"error":"This confirmation token has already been used"}`                                                                   |
| `409` | confirm: one target ingredient deleted since propose | `{"error":"\"Oat Milk\" no longer exists — the whole batch was NOT applied. Re-propose to apply the remaining changes."}`     |
| `410` | confirm: token expired (> 5 min)                     | `{"error":"Confirmation token expired — re-propose to get a fresh one"}`                                                      |

---

## Recommended Alfred flow

1. Human hands Alfred a distributor invoice/receipt/price sheet in chat.
2. Alfred reads `GET /api/alfred/ingredients?tenant_id=auto` to get current names,
   `id`s, `unit`s, `cost`, and `quantity` for every ingredient.
3. Alfred parses the invoice and matches each line to an existing ingredient,
   converting the invoice's price/pack-size to CMS's existing `quantity`/`unit` where
   they differ (see "cost and quantity are a pair" above). Any line that doesn't
   clearly match an existing ingredient is set aside and flagged to the human — don't
   guess.
4. Alfred calls **propose** with the whole resolved batch in one call.
5. Alfred reads the returned `summary` back to the human verbatim, line by line —
   it shows $/unit before and after for every item.
6. On human approval, Alfred calls **confirm** with the `confirmationToken`.
7. If propose 400s on one bad line, fix just that line and re-propose the batch —
   don't drop it silently.

### Idempotency caveat

Same as overhead: writes are a plain `SET cost, quantity`, not an append. Processing
the same invoice twice sets the same values twice (harmless, since it's idempotent),
but CMS cannot tell you "this invoice was already recorded." Rely on the propose
`summary`'s `was $X` values and human confirmation to catch reprocessing.
