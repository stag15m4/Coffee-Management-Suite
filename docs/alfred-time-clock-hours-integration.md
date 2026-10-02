# CMS Integration Spec — Daily Labor Hours (Time Clock)

For Alfred's Claude Code session. This describes a **live, read-only** endpoint
in the Coffee Management Suite (CMS) that answers "how many hours do I have to
pay for labor on day X" from actual clock-in/clock-out data (the native time
clock and whatever Connecteam has synced into it).

---

## This is NOT the same data as `/api/alfred/employee-hours`

`/api/alfred/employee-hours` reads `tip_employee_hours` — a **weekly**
aggregate used only for tip-pool math. It has no daily resolution and isn't
sourced from actual clock punches.

This new endpoint reads `time_clock_entries` / `time_clock_breaks` directly —
real clock-in/out sessions, bucketed into **net hours per employee per local
calendar day**.

---

## Endpoint

```
GET /api/alfred/time-clock-hours
```

Query params (all optional except `tenant_id`, which auth already provides):

| Param | Format | Notes |
|---|---|---|
| `date` | `YYYY-MM-DD` | A single day. |
| `start_date` / `end_date` | `YYYY-MM-DD` | A range, inclusive. Must both be given together. Max 31 days. |
| `timezone` | IANA name, e.g. `America/New_York` | Default `America/New_York`. Rejected with 400 if not a real IANA name. |

**With no date params at all, this defaults to yesterday** (in `timezone`) —
the common case ("how many hours did I owe for labor yesterday") needs no
params.

`date` and `start_date`/`end_date` are mutually exclusive in effect — if
`date` is given it wins.

## Why timezone matters here

Clock timestamps are stored in UTC. CMS has no stored per-tenant timezone
(the rest of the app leaves "today" to the viewer's own browser), so day
boundaries only come out correct for whichever timezone you pass. If you
don't know the shop's timezone, the default (`America/New_York`) is correct
for this tenant; for a different one, ask rather than guess — an hour's worth
of labor can land on the wrong day with the wrong timezone.

## What counts as "hours"

`net hours = gross clock time − unpaid breaks only`. A break logged as paid
(`is_paid = true`) still counts as worked time and is **not** subtracted —
same formula CMS itself uses for payroll/tip-pool math elsewhere
(`calcNetHoursFromEntry`). A session with no `clock_out` yet (still clocked
in) contributes nothing — there's nothing billable to report until it closes.
A shift crossing midnight is split by actual elapsed time across both local
days it touches, not double-counted or dropped.

## Response shape

```json
{
  "tenant_id": "…",
  "timezone": "America/New_York",
  "start_date": "2026-10-01",
  "end_date": "2026-10-01",
  "days": [
    {
      "date": "2026-10-01",
      "total_hours": 23.5,
      "employees": [
        { "employee_id": "…", "employee_name": "Ava", "hours": 7.5 },
        { "employee_id": "…", "employee_name": "Seth", "hours": 16 }
      ]
    }
  ]
}
```

One entry in `days` per requested calendar day, even if no one worked that
day (`total_hours: 0`, `employees: []`). `employee_id` is the stable identity
key CMS uses internally — a `user_profiles.id` when the clock session belongs
to a login account, otherwise the roster (`tip_employees.id`) when it doesn't.
Don't try to resolve it further; `employee_name` is already the display name
to use.

## Errors

- `401` — no/invalid auth.
- `403` — token not authorized for the requested tenant.
- `400` — bad `timezone`, bad date format, `start_date` without `end_date`,
  `start_date` after `end_date`, or a range over 31 days.
- `500` — unexpected server error (not a validation problem — worth reporting
  back rather than retrying silently).

## No wage/cost figures here

This endpoint returns **hours only**, not dollars. Employee hourly rates are
deliberately not exposed to Alfred through this path. If you need labor
*cost* (hours × rate), that would need a separate, explicitly-scoped
endpoint — don't try to combine this with another Alfred endpoint to back
into a wage figure.
