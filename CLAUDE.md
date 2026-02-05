# Coffee Management Suite

Multi-tenant SaaS platform for coffee shop operations — recipe costing, tip payouts, cash deposits, bulk ordering, equipment maintenance, and admin tasks.

## Quick Start

**Dev server:** `npm run dev` (port 5001). Check health: `curl http://localhost:5001/api/health`

If the server isn't running, ask the user if they'd like to start it.

**Hot reload:** Frontend changes (React components, hooks, pages) are hot-reloaded via Vite HMR — no restart needed. Server changes (`server/*.ts`, `shared/*.ts`) require restarting `npm run dev`.

**Other commands:**
- `npm run check` — TypeScript type check
- `npm run build` — Production build to `dist/`
- `npm run db:push` — Push Drizzle schema to database

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript, Vite, Wouter (routing), TanStack Query, Tailwind + shadcn/ui |
| Backend | Express.js, Drizzle ORM |
| Database | PostgreSQL via Supabase (all IDs are UUIDs) |
| Auth | Supabase Auth (email/password), roles: owner/manager/lead/employee |
| Payments | Stripe (webhooks at `/api/stripe/webhook`) |
| Email | Resend API |
| File uploads | AWS S3 via Supabase storage + Uppy |

## Architecture

**Multi-tenant:** Every table has `tenant_id`. Supabase Row-Level Security enforces isolation. Tenants can have child locations.

**Module system:** Features are gated per tenant — `recipe-costing`, `tip-payout`, `cash-deposit`, `bulk-ordering`, `equipment-maintenance`, `admin-tasks`.

**Dual data access pattern:**
- **Client-side:** Most reads go directly to Supabase via `@supabase/supabase-js` (RLS protects data). See `client/src/lib/supabase-queries.ts` and hooks in `client/src/hooks/`.
- **Server-side:** Express API handles complex ops (Stripe, email, file uploads, validation). See `server/routes.ts`.

**Auth context:** `client/src/contexts/AuthContext.tsx` — provides `user`, `tenant`, `profile`, `platformAdmin`, enabled modules, branding.

## Key Directories

```
client/src/pages/       # ~24 route pages
client/src/hooks/       # Data hooks (use-recipes, use-ingredients, etc.)
client/src/components/  # Shared components (ui/ = shadcn)
client/src/contexts/    # AuthContext
client/src/lib/         # Supabase client, query client
server/                 # Express backend
  routes.ts             # API endpoints + seed function
  storage.ts            # DB operations via Drizzle
  db.ts                 # Drizzle + pg Pool connection
  stripeService.ts      # Stripe integration
  resend.ts             # Email service
shared/
  schema.ts             # Drizzle table defs + Zod schemas (source of truth)
  routes.ts             # API route definitions with validation
supabase-migrations/    # 60+ SQL migration files
```

## Database Schema (Drizzle)

The Drizzle schema in `shared/schema.ts` covers: `ingredients`, `recipes`, `recipe_ingredients`, `resellers`, `license_codes`. The actual Supabase DB has 40+ tables — most are queried directly from the client, not through Drizzle.

**Important:** DB columns use snake_case (`cost`, `quantity`, `recipe_id`). Drizzle maps these to camelCase in TypeScript (`recipeId`). All primary keys are `uuid` with `gen_random_uuid()` defaults.

## Environment

Configured via `.env` (loaded by `tsx --env-file`). Required vars:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — client Supabase access
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — server admin access
- `DATABASE_URL` — Postgres connection string
- `PORT` — server port (default 5001)

Optional: `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `VITE_USE_MOCK_DATA`

## Git Workflow

After making changes, always commit and push to the remote branch. If unsure about the commit message or scope, ask the user before pushing. Never leave work uncommitted at the end of a session.

## Gotchas

- The client queries Supabase directly for most data — changing DB columns may require updating both Drizzle schema AND client hooks/queries.
- `shared/schema.ts` only defines a subset of tables. Most tables exist only in Supabase migrations and are accessed via raw SQL or Supabase client.
- Platform admin status is checked at runtime via the `platform_admins` table, not a role flag.
- The seed function in `routes.ts` runs on every server start but no-ops if data exists.
