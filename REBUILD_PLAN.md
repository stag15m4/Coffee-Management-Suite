# Platform Rebuild Plan: Multi-Vertical Food Service Suite

> **Goal:** Transform the Coffee Management Suite from a single-vertical coffee shop app into a dynamic, multi-vertical platform that serves coffee shops, pizzerias, pastry shops, food trucks, and more — while keeping the UX simple enough for mom-and-pop owners.

> **Approach:** Hybrid rebuild — keep the Supabase backend (DB, RLS, migrations, Stripe, auth), rebuild the frontend with a vertical-aware architecture.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Phase 1: Vertical Configuration Engine (Database)](#2-phase-1-vertical-configuration-engine)
3. [Phase 2: Frontend Foundation (Vertical-Aware Shell)](#3-phase-2-frontend-foundation)
4. [Phase 3: Onboarding & First-Run Experience](#4-phase-3-onboarding--first-run)
5. [Phase 3B: Contextual Help & Smart Guidance](#5-phase-3b-contextual-help--smart-guidance)
6. [Phase 4: Core Module Rebuild — Recipe Costing](#6-phase-4-recipe-costing-rebuild)
7. [Phase 5: Core Module Rebuild — Cash & Tips](#7-phase-5-cash--tips-rebuild)
8. [Phase 6: Core Module Rebuild — Equipment Maintenance](#8-phase-6-equipment-maintenance-rebuild)
9. [Phase 7: Second Vertical (Pizzeria)](#9-phase-7-second-vertical)
10. [Phase 8: Landing Pages & Branded Products](#10-phase-8-landing-pages)
11. [Phase 9: White-Label & Reseller Enhancements](#11-phase-9-white-label)
12. [Parallel Workstream Map](#12-parallel-workstreams)
13. [Migration Strategy](#13-migration-strategy)

---

## 1. Architecture Overview

### Current State

```
┌──────────────────────────────────────────┐
│        Coffee Management Suite           │
│   (hardcoded coffee terminology/theme)   │
├──────────────────────────────────────────┤
│  Frontend: React 18 + Vite + shadcn/ui  │
│  21 routes, 8 modules, desktop-first    │
│  Pages are 1,000-2,700 line monoliths   │
│  No onboarding, no empty states         │
├──────────────────────────────────────────┤
│  Backend: Express + Drizzle ORM         │
│  Stripe, Resend, S3 uploads             │
├──────────────────────────────────────────┤
│  Database: Supabase PostgreSQL           │
│  60+ migrations, RLS, multi-tenant      │
│  40+ tables, UUID PKs                   │
└──────────────────────────────────────────┘
```

### Target State

```
┌─────────────────────────────────────────────────────────┐
│                    Platform Engine                        │
│  Vertical-aware shell, mobile-first, simple UX           │
├────────────┬────────────┬──────────────┬────────────────┤
│ CoffeeSuite│ PizzaSuite │ PastrySuite  │  [Custom]      │
│ coffeesuite│ pizzasuite │ pastrysuite  │  white-label   │
│   .com     │   .com     │    .com      │   domains      │
├────────────┴────────────┴──────────────┴────────────────┤
│  Vertical Config Engine (DB-driven)                      │
│  Terms, themes, templates, workflow flags                │
├─────────────────────────────────────────────────────────┤
│  Simplified Core Modules                                 │
│  Recipe Costing (3 tabs) · Cash · Tips · Equipment      │
├─────────────────────────────────────────────────────────┤
│  Existing Backend (kept as-is)                           │
│  Express + Supabase + Stripe + RLS                      │
└─────────────────────────────────────────────────────────┘
```

### What We Keep vs. Rebuild

| Layer                                                          | Decision             | Rationale                                                   |
| -------------------------------------------------------------- | -------------------- | ----------------------------------------------------------- |
| Supabase DB + 60+ migrations                                   | **KEEP**             | Battle-tested multi-tenant schema with RLS                  |
| `tenants`, `user_profiles`, `modules`, `subscription_*` tables | **KEEP + EXTEND**    | Add `vertical_id` column to tenants                         |
| Express API (`server/routes.ts`, `storage.ts`)                 | **KEEP**             | Stripe, email, uploads work fine                            |
| Supabase Auth                                                  | **KEEP**             | Email/password + RLS integration is solid                   |
| Reseller/license system                                        | **KEEP + EXTEND**    | Already has reseller infra; add vertical awareness          |
| React + Vite                                                   | **KEEP** (framework) | Rebuild components, not the toolchain                       |
| shadcn/ui components                                           | **KEEP** (library)   | Continue using, just compose them differently               |
| Page components (21 routes)                                    | **REBUILD**          | Monolithic 2,700-line files → small focused components      |
| Sidebar navigation                                             | **REBUILD**          | Desktop sidebar → mobile-first bottom tabs + contextual nav |
| AuthContext                                                    | **EXTEND**           | Add `vertical` config to the context                        |
| Data hooks (`client/src/hooks/`)                               | **KEEP + REFACTOR**  | Hooks are clean; add vertical-aware term mapping            |
| Landing page                                                   | **REBUILD**          | Single coffee page → vertical-specific landing pages        |
| Onboarding                                                     | **BUILD NEW**        | Doesn't exist at all currently                              |

---

## 2. Phase 1: Vertical Configuration Engine

> **Can be done in parallel with:** Phase 2 (frontend shell)
> **Dependencies:** None — this is foundational
> **Estimated scope:** 2 new DB tables, 1 migration file, 1 seed function, platform admin UI updates

### 2.1 Database Schema

Create migration: `supabase-migrations/080_vertical_system.sql`

```sql
-- =====================================================
-- VERTICAL CONFIGURATION SYSTEM
-- Enables multi-vertical platform (coffee, pizza, etc.)
-- =====================================================

-- Verticals table — each row is a business type
CREATE TABLE IF NOT EXISTS verticals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,         -- 'coffee-shop', 'pizzeria', 'food-truck'
    product_name TEXT NOT NULL,         -- 'CoffeeSuite', 'PizzaSuite'
    display_name TEXT NOT NULL,         -- 'Coffee Shop', 'Pizzeria'
    is_published BOOLEAN DEFAULT false, -- visible to new signups?
    is_system BOOLEAN DEFAULT true,     -- system-defined vs reseller-created

    -- Theme configuration
    theme JSONB NOT NULL DEFAULT '{}',
    -- Expected shape:
    -- {
    --   "primaryColor": "#C9A227",
    --   "secondaryColor": "#4A3728",
    --   "accentColor": "#F5F0E1",
    --   "backgroundColor": "#FFFDF7",
    --   "logoUrl": null,
    --   "iconEmoji": "☕",
    --   "loadingText": "Grinding beans..."
    -- }

    -- Terminology overrides (keys map to term IDs)
    terms JSONB NOT NULL DEFAULT '{}',
    -- Expected shape:
    -- {
    --   "recipe": { "singular": "Drink", "plural": "Drinks" },
    --   "ingredient": { "singular": "Ingredient", "plural": "Ingredients" },
    --   "recipeUnit": { "singular": "drink", "plural": "drinks" },
    --   "menuItem": { "singular": "Menu Item", "plural": "Menu Items" },
    --   "vendor": { "singular": "Vendor", "plural": "Vendors" },
    --   "equipment": { "singular": "Machine", "plural": "Machines" }
    -- }

    -- Workflow feature flags
    workflows JSONB NOT NULL DEFAULT '{}',
    -- Expected shape:
    -- {
    --   "sizeVariants": false,      -- pizza needs S/M/L
    --   "batchScaling": false,      -- pastry needs batch multipliers
    --   "locationTracking": false,   -- food trucks need GPS
    --   "prepStations": false,       -- pizzerias have oven/prep stations
    --   "dailySpecials": false       -- food trucks rotate menus
    -- }

    -- Default modules to suggest during onboarding
    suggested_modules TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Landing page content
    landing_content JSONB NOT NULL DEFAULT '{}',
    -- Expected shape:
    -- {
    --   "headline": "Stop losing money on every cup you pour.",
    --   "subheadline": "CoffeeSuite helps coffee shop owners...",
    --   "heroImage": "/assets/coffee-hero.jpg",
    --   "ctaText": "Start Free Trial"
    -- }

    -- Domain routing
    domains TEXT[] DEFAULT ARRAY[]::TEXT[],  -- ['coffeesuite.com', 'www.coffeesuite.com']

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vertical starter templates — pre-loaded data for new tenants
CREATE TABLE IF NOT EXISTS vertical_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
    template_type TEXT NOT NULL,  -- 'ingredient', 'recipe', 'equipment', 'category'
    name TEXT NOT NULL,           -- display name for the template
    data JSONB NOT NULL,          -- the actual template data
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vertical_templates_vertical
    ON vertical_templates(vertical_id, template_type);

-- Link tenants to verticals
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS vertical_id UUID REFERENCES verticals(id);
CREATE INDEX IF NOT EXISTS idx_tenants_vertical ON tenants(vertical_id);

-- RLS policies
ALTER TABLE verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_templates ENABLE ROW LEVEL SECURITY;

-- Published verticals are readable by everyone (for landing pages)
CREATE POLICY "Published verticals are publicly readable" ON verticals
    FOR SELECT USING (is_published = true OR auth.role() = 'authenticated');

CREATE POLICY "Platform admins can manage verticals" ON verticals
    FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

CREATE POLICY "Templates readable by authenticated users" ON vertical_templates
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Platform admins can manage templates" ON vertical_templates
    FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());
```

### 2.2 Seed the Coffee Vertical

Create migration: `supabase-migrations/081_seed_coffee_vertical.sql`

Seed the first vertical with:

**Coffee Shop vertical config:**

- slug: `coffee-shop`
- product_name: `CoffeeSuite`
- Theme: current gold/brown colors from `tenant_branding` defaults
- Terms: drink, ingredient, shot, pump, beans, grinder, espresso machine
- Workflows: no size variants, no batch scaling, no location tracking
- Suggested modules: `recipe-costing`, `cash-deposit`, `tip-payout`

**Starter templates (coffee):**

- ~15 common ingredients (espresso, whole milk, oat milk, vanilla syrup, chocolate sauce, whipped cream, cups, lids, sleeves, straws, etc.)
- ~8 common recipes (Latte, Cappuccino, Americano, Mocha, Cold Brew, Drip Coffee, Chai Latte, Hot Chocolate)
- ~6 common equipment (Espresso machine, Grinder, Blender, Refrigerator, Ice machine, POS terminal)
- Categories for each type

**Link existing tenant:** Update the existing Erwin Mills tenant to use `vertical_id` = coffee-shop vertical.

### 2.3 Platform Admin UI for Verticals

Extend the existing platform admin page (`client/src/pages/platform-admin.tsx`) with a new "Verticals" tab:

- List all verticals with publish status
- Create/edit vertical form:
  - Basic info (slug, product name, display name)
  - Theme editor (color pickers, logo upload, icon)
  - Terms editor (key-value pairs with singular/plural)
  - Workflow flags (toggles)
  - Landing page content editor
  - Template management (add/edit/remove starter ingredients, recipes, equipment)
- Preview mode to see what the vertical looks like

### 2.4 Deliverables Checklist

- [ ] Migration `080_vertical_system.sql` — creates `verticals` and `vertical_templates` tables
- [ ] Migration `081_seed_coffee_vertical.sql` — seeds coffee vertical + templates
- [ ] Update `shared/schema.ts` — add Drizzle definitions for new tables
- [ ] Platform admin "Verticals" tab — CRUD for verticals and templates
- [ ] Backfill existing tenant with `vertical_id`

---

## 3. Phase 2: Frontend Foundation (Vertical-Aware Shell)

> **Can be done in parallel with:** Phase 1 (DB schema)
> **Dependencies:** Phase 1 must be done before this can read real vertical data, but the context/hook interfaces can be built against mock data
> **Estimated scope:** New context, hooks, layout components, navigation rebuild

### 3.1 VerticalContext

Create: `client/src/contexts/VerticalContext.tsx`

```typescript
interface VerticalConfig {
  id: string;
  slug: string;
  productName: string;
  displayName: string;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    logoUrl: string | null;
    iconEmoji: string;
    loadingText: string;
  };
  terms: Record<string, { singular: string; plural: string }>;
  workflows: Record<string, boolean>;
  suggestedModules: string[];
}

// The context provides:
// - vertical: VerticalConfig | null
// - term(key, opts?): string — e.g., term('recipe') → "Drink"
// - termPlural(key): string — e.g., termPlural('recipe') → "Drinks"
// - hasWorkflow(flag): boolean — e.g., hasWorkflow('sizeVariants') → false
// - loading: boolean
```

**How it loads:**

1. On app init, check the current domain against `verticals.domains`
2. If matched, load that vertical config
3. If not matched (e.g., localhost), load the tenant's vertical from `tenants.vertical_id`
4. Provide defaults for any missing terms (fallback to generic food service language)

### 3.2 useTerm() Hook

Create: `client/src/hooks/use-term.ts`

```typescript
// Usage in components:
const { term, termPlural } = useTerm();

// Instead of hardcoded:
<h2>Your Drinks</h2>

// Dynamic:
<h2>Your {termPlural('recipe')}</h2>
// Coffee → "Your Drinks"
// Pizza → "Your Menu Items"
// Generic → "Your Recipes"
```

**Default term map (fallbacks when vertical doesn't override):**

| Term Key     | Default Singular | Default Plural |
| ------------ | ---------------- | -------------- |
| `recipe`     | Recipe           | Recipes        |
| `ingredient` | Ingredient       | Ingredients    |
| `recipeUnit` | item             | items          |
| `menuItem`   | Menu Item        | Menu Items     |
| `vendor`     | Vendor           | Vendors        |
| `equipment`  | Equipment        | Equipment      |
| `deposit`    | Cash Deposit     | Cash Deposits  |
| `tipPayout`  | Tip Payout       | Tip Payouts    |
| `employee`   | Team Member      | Team Members   |
| `location`   | Location         | Locations      |
| `task`       | Task             | Tasks          |

### 3.3 Navigation Rebuild

**Current:** Desktop sidebar with 5 category groups, 13+ top-level items, 13 sub-tabs
**Target:** Adaptive navigation that works for iPad-at-counter AND desktop-in-office

**Mobile/Tablet (< 1024px):**

```
┌─────────────────────────────────────┐
│  [Content Area]                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│ 🏠  💰  📋  🔧  ⚙️               │
│ Home Cash Tips Equip More           │
└─────────────────────────────────────┘
```

- Bottom tab bar with 4-5 icons (role-aware — baristas see fewer tabs)
- "More" opens a sheet with remaining items
- The tabs shown are the tenant's enabled modules (not hardcoded)

**Desktop (≥ 1024px):**

- Keep a slimmed-down sidebar but reduce categories
- Collapse settings into a single gear icon → drawer
- Show breadcrumbs for sub-navigation instead of sidebar sub-tabs

**Implementation:**

- Replace `client/src/components/Sidebar.tsx` (627 lines) with:
  - `client/src/components/navigation/BottomTabBar.tsx` — mobile nav
  - `client/src/components/navigation/DesktopSidebar.tsx` — simplified sidebar
  - `client/src/components/navigation/NavigationProvider.tsx` — manages which nav items to show based on role + modules
- Replace `client/src/components/AppLayout.tsx` with a responsive layout that switches between the two

### 3.4 Theme Provider

Create: `client/src/contexts/ThemeProvider.tsx`

Reads colors from vertical config (or tenant branding override) and applies them as CSS custom properties:

```css
:root {
  --color-primary: #c9a227; /* from vertical.theme.primaryColor */
  --color-secondary: #4a3728; /* from vertical.theme.secondaryColor */
  --color-accent: #f5f0e1;
  --color-background: #fffdf7;
}
```

This replaces the current approach where colors are hardcoded in `client/src/lib/colors.ts` and scattered throughout components.

### 3.5 Role-Aware Home Screens

Replace the current one-size-fits-all dashboard with role-specific views:

| Role         | Home Screen Shows                                                        |
| ------------ | ------------------------------------------------------------------------ |
| **Owner**    | Revenue snapshot, action items across locations, setup progress (if new) |
| **Manager**  | Today's tasks, team schedule, cash deposit reminder                      |
| **Lead**     | My shift, tip entry reminder, assigned tasks                             |
| **Employee** | Time clock (big tap-to-clock-in button), my schedule, my tasks           |

The employee view should be **dead simple** — a barista opening the app on a shared iPad should be able to clock in with one tap.

### 3.6 Deliverables Checklist

- [ ] `VerticalContext.tsx` — loads and provides vertical config
- [ ] `ThemeProvider.tsx` — applies vertical theme as CSS vars
- [ ] `use-term.ts` hook — dynamic terminology
- [ ] `use-workflow.ts` hook — workflow feature flags
- [ ] `BottomTabBar.tsx` — mobile-first navigation
- [ ] `DesktopSidebar.tsx` — simplified desktop nav
- [ ] `NavigationProvider.tsx` — role + module aware nav items
- [ ] Updated `AppLayout.tsx` — responsive shell
- [ ] Role-aware dashboard views (Owner / Manager / Lead / Employee)
- [ ] Update `AuthContext.tsx` — add `vertical` to context

---

## 4. Phase 3: Onboarding & First-Run Experience

> **Can be done in parallel with:** Phase 4, 5, 6 (module rebuilds) — but needs Phase 1 + 2 foundations
> **Dependencies:** Vertical config (Phase 1) for templates, VerticalContext (Phase 2) for terms
> **Estimated scope:** New onboarding wizard component, empty state components, DB tracking

### 4.1 Signup Flow

**Current:** No self-service signup visible. Login page only.
**Target:** Vertical-specific signup flow.

1. User lands on `coffeesuite.com` (or `pizzasuite.com`, etc.)
2. Clicks "Start Free Trial"
3. **Step 1:** Email + password + shop name
4. **Step 2:** "Tell us about your shop" — number of employees (1-5, 5-15, 15+), single or multi-location
5. **Step 3:** "Pick your tools" — show the 3 suggested modules for their vertical, pre-checked. Other modules shown but unchecked. Each module has a one-sentence description.
6. Account created → redirected to Setup Wizard

### 4.2 Setup Wizard (First Login)

Track setup progress in a new table or a JSONB column on tenants:

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS setup_progress JSONB DEFAULT '{}';
-- Shape: { "completedSteps": ["team", "ingredients"], "dismissed": false }
```

**Wizard steps (shown as a checklist on the dashboard):**

| Step                             | What It Does                                                           | Why It Matters                               |
| -------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| 1. **Add your team**             | Invite 1-3 team members by email                                       | Gets buy-in from staff early                 |
| 2. **Stock your pantry**         | Load starter ingredients from vertical templates, let them edit/remove | Biggest data entry shortcut                  |
| 3. **Build your first {recipe}** | Guided recipe builder using loaded ingredients                         | Immediate "aha" moment — they see their cost |
| 4. **Set your drawer**           | Enter starting drawer amount for cash deposits                         | One number, unlocks daily tracking           |
| 5. **You're ready!**             | Summary + links to each enabled module                                 | Confidence builder                           |

Each step is optional and skippable. The checklist stays on the dashboard until all steps are done or the user dismisses it.

### 4.3 Empty State Components

Create: `client/src/components/EmptyState.tsx`

A reusable component used by every module when no data exists:

```tsx
<EmptyState
  icon={<Calculator />}
  title={`No ${termPlural('recipe')} yet`}
  description={`Add your first ${term('recipe')} to see what it costs to make.`}
  action={{ label: `Add ${term('recipe')}`, onClick: openAddDialog }}
  tip="Most shops start with their 5 best sellers."
/>
```

Every module page wraps its content:

```tsx
{data.length === 0 ? <EmptyState ... /> : <ActualContent />}
```

### 4.4 Smart Defaults

During onboarding, pre-fill as much as possible:

- **Starter ingredients** from `vertical_templates` where `template_type = 'ingredient'`
- **Starter recipes** from `vertical_templates` where `template_type = 'recipe'`
- **Starter equipment** from `vertical_templates` where `template_type = 'equipment'`
- **Starting drawer** defaults to $200 (configurable)
- **Categories** from `vertical_templates` where `template_type = 'category'`

The user can accept all defaults with one click ("Load suggested ingredients") or pick and choose.

### 4.5 Deliverables Checklist

- [ ] Signup flow component (multi-step, vertical-aware)
- [ ] Setup wizard component (dashboard checklist)
- [ ] `setup_progress` column on tenants table (migration)
- [ ] Template loading API — endpoint to populate tenant data from vertical templates
- [ ] `EmptyState.tsx` — reusable empty state component
- [ ] Empty states for: Recipe Costing, Cash Deposit, Tip Payout, Equipment, Tasks, Calendar
- [ ] "Load starter data" button that pulls from vertical templates

---

## 5. Phase 3B: Contextual Help & Smart Guidance

> **Can be done in parallel with:** Phase 4, 5, 6 (module rebuilds) — the help system is a layer on top
> **Dependencies:** Phase 2 (VerticalContext, useTerm) for vertical-aware content; Phase 3 (Onboarding) for setup tracking
> **Estimated scope:** Help tooltip system, smart suggestions engine, notification/reminder system, data memory layer

### 5.1 Philosophy

Onboarding (Phase 3) gets users **in the door**. This phase keeps them from getting **lost inside**. A mom-and-pop owner isn't an accountant — they don't know what "overhead allocation" means or whether their food cost percentage is healthy. The app should teach them as they go, not assume expertise.

Three layers of ongoing guidance:

1. **Contextual help** — explain terms and concepts right where they appear
2. **Smart suggestions** — proactive insights based on their data
3. **Nudges & reminders** — keep them engaged with daily habits

### 5.2 Contextual Help System

Create: `client/src/components/HelpTip.tsx`

A small `(?)` icon next to any term or concept that might confuse a non-expert. Tap/hover to see a plain-English explanation.

```tsx
<HelpTip term="overhead">
  Overhead is the stuff that costs money even when you're not making drinks — rent, electricity, water, insurance. We
  spread that cost across everything you sell so you can see your true profit.
</HelpTip>
```

**Implementation:**

- Help content is stored in a `help_content` table or a static JSON file per vertical
- Each entry has: `term_key`, `vertical_id` (nullable for universal tips), `title`, `body`, `learn_more_url` (optional)
- Content is vertical-aware — a coffee shop gets coffee examples, a pizzeria gets pizza examples
- Dismissable per-user: once they tap "Got it, don't show again" for a term, it stays hidden (stored in `user_preferences` JSONB or localStorage)

**Where help tips appear (initial set):**

| Location       | Term                   | Explanation                                                                                                                                                        |
| -------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Recipe Costing | Food Cost %            | "This is how much of your selling price goes to ingredients. Most coffee shops aim for 15-25%. If yours is over 30%, you're losing money on that item."            |
| Recipe Costing | Overhead               | "Monthly costs that aren't ingredients — rent, electric, water, insurance, loan payments. We divide this across your items so you see real profit."                |
| Recipe Costing | Margin                 | "What's left after ingredients and overhead. This is your actual profit per item. Higher is better."                                                               |
| Recipe Costing | Cost per unit          | "How much it costs YOU to make one of these. Compare this to what you charge to see if you're making money."                                                       |
| Cash Deposit   | Discrepancy            | "The difference between what the register says you should have and what you actually counted. Small differences ($1-5) are normal. Large ones need investigation." |
| Cash Deposit   | Starting Drawer        | "The amount of cash you put in the register at the start of the day. This stays the same most days."                                                               |
| Tip Payout     | Tip Pool               | "All tips combined before splitting. We divide this by total hours worked so everyone gets a fair share based on time worked."                                     |
| Equipment      | Preventive Maintenance | "Cleaning and servicing equipment BEFORE it breaks. Costs less than emergency repairs and keeps you open."                                                         |
| Billing        | A La Carte             | "Pick only the tools you need. You're not locked in — add or remove anytime."                                                                                      |

### 5.3 Smart Suggestions Engine

Proactive insights that appear as cards/banners within modules when the user's data reveals something actionable.

Create: `client/src/components/SmartSuggestion.tsx`

```tsx
<SmartSuggestion
  type="warning" // or "tip" or "celebration"
  title="Your Mocha costs more than you think"
  body="At $1.85 to make and $4.50 selling price, your margin is only 22% after overhead. Most shops aim for 60%+. Consider raising the price to $5.25."
  action={{ label: 'See breakdown', onClick: () => navigateToRecipe(mochaId) }}
  dismissable={true}
/>
```

**Suggestion rules (computed from user data):**

| Trigger                                     | Suggestion                                                                                           | Type        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------- |
| Any recipe has food cost > 35%              | "Your {recipe} has a high food cost ({x}%). Consider adjusting portion size or price."               | warning     |
| Any recipe has margin > 75%                 | "Nice! Your {recipe} is a high-margin item. Feature it on your menu!"                                | celebration |
| No cash deposit logged in 2+ days           | "You haven't logged a deposit since {date}. Staying on top of this catches cash issues early."       | tip         |
| Ingredient price increased > 10%            | "Your {ingredient} cost went up {x}%. This affects {n} recipes — check your Menu Pricing."           | warning     |
| First recipe created                        | "You just built your first recipe! Head to Menu Pricing to see what it costs."                       | celebration |
| 7-day streak of cash deposits               | "7 days in a row! Consistent tracking is the #1 habit of profitable shops."                          | celebration |
| Equipment maintenance overdue > 7 days      | "Your {equipment} maintenance is {n} days overdue. Skipping maintenance leads to costly breakdowns." | warning     |
| Tip payout not entered by end of pay period | "Tips for this week haven't been calculated yet. Your team is counting on you!"                      | tip         |

**Implementation:**

- Suggestions are computed client-side from existing data (no new API needed)
- Create `client/src/hooks/use-smart-suggestions.ts` that runs rule checks against cached data
- Rules are defined as functions: `(data, vertical) => Suggestion | null`
- Each suggestion has a unique key for dismissal tracking
- Dismissed suggestions stored in localStorage (or `user_preferences` table)
- Suggestions surface on the dashboard and inline within relevant modules
- Limit to 1-2 suggestions visible at a time (don't overwhelm)

### 5.4 Nudges & Reminders

Keep users engaged with daily/weekly habits through gentle reminders.

**In-app nudges (dashboard cards):**

| When                                          | Nudge                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| Opening the app and no deposit logged today   | "Good morning! Don't forget to log yesterday's cash deposit." with a one-tap shortcut |
| End of pay period (configurable day)          | "It's tip day! Calculate this week's payouts." with link to Tip Payout                |
| Equipment maintenance due today               | "Maintenance due today: {task} on {equipment}"                                        |
| New team member added but no shifts scheduled | "{Name} was added but doesn't have any shifts yet."                                   |

**Push notifications (future enhancement — Phase 3B+):**

- Requires service worker registration for web push or native app wrapper
- Configurable per user (Settings → Notifications)
- Default schedule: daily deposit reminder at configurable time, weekly tip reminder on pay day
- Mark as out of scope for initial build but design the system to support it later

**Implementation:**

- Nudges are computed at dashboard render time from data freshness checks
- Create `client/src/components/NudgeCard.tsx` — dismissable, time-aware
- Create `client/src/hooks/use-nudges.ts` — checks last deposit date, last tip payout, overdue maintenance
- Nudges respect "quiet hours" — don't show reminders before the shop's configured open time

### 5.5 Data Memory & Auto-Fill

Reduce repetitive data entry by remembering patterns.

| Feature                | What It Remembers                                      | Where It Helps                                                                                                                     |
| ---------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Last drawer amount** | The starting drawer from the most recent deposit       | Cash Deposit — pre-fills starting drawer (already exists via `starting_drawer_default`, but should also learn from actual entries) |
| **Tip team roster**    | Which employees were included in the last tip payout   | Tip Payout — pre-selects the same team instead of starting from scratch each week                                                  |
| **Typical hours**      | Each employee's average weekly hours from last 4 weeks | Tip Payout — suggests hours based on recent patterns, user confirms or adjusts                                                     |
| **Common adjustments** | Whether the shop typically has pay-ins/pay-outs        | Cash Deposit — auto-expand adjustments section if they use it regularly                                                            |
| **Ingredient prices**  | Last entered price per ingredient                      | Ingredients — flags when a new price differs significantly from the last one                                                       |

**Implementation:**

- Most of this is already queryable from existing tables (deposits, tip payouts, time clock entries)
- Create `client/src/hooks/use-data-memory.ts` — queries recent data to generate smart defaults
- No new tables needed — computed from existing data at query time
- Pre-fill is always editable — show as suggestion, not forced value

### 5.6 POS Integration Pathway (CSV Bridge)

Full POS integrations (Square API, Toast API) are complex and can come later. For now, provide a **CSV import bridge** that covers the 80% use case.

**Cash Deposit CSV import:**

- Upload daily sales report CSV from Square/Toast/Clover
- Map columns: date, gross revenue, cash sales, credit card sales
- Auto-populate deposit form fields
- Saves the column mapping so subsequent imports are one-click

**Ingredient Price CSV import:**

- Already planned in Phase 4 (Recipe Costing rebuild)
- Add vendor-specific import templates (US Foods, Sysco, Restaurant Depot formats)
- "Paste from invoice" — paste a vendor invoice table and we parse it

**Implementation:**

- Create `client/src/components/CsvImport.tsx` — reusable CSV upload + column mapping component
- Create `client/src/lib/csv-templates.ts` — known CSV formats for common POS systems and vendors
- Store column mappings per tenant in `tenant_preferences` JSONB so repeat imports are faster

### 5.7 "Recommended For You" Module Suggestions

On the billing/modules page, instead of showing all 8 modules equally, highlight the ones most relevant to the user's vertical and usage patterns.

**Logic:**

1. Start with the vertical's `suggested_modules` list (from vertical config)
2. Boost modules the user hasn't tried but their vertical commonly uses
3. Show social proof: "87% of coffee shops use Recipe Costing + Cash Deposit together"
4. De-emphasize modules less relevant to their vertical (e.g., "Bulk Ordering" for food trucks)

**Implementation:**

- Sort modules on billing page: suggested first, then enabled, then others
- Add a "Recommended" badge to suggested modules
- Add one-line "why" text: "Most {vertical.displayName} owners start with this"

### 5.8 Deliverables Checklist

- [ ] `HelpTip.tsx` — contextual help tooltip component
- [ ] Help content JSON/table — vertical-aware term explanations (initial set of ~15 terms)
- [ ] Per-user help dismissal tracking (localStorage or user_preferences)
- [ ] `SmartSuggestion.tsx` — proactive insight card component
- [ ] `use-smart-suggestions.ts` — rule engine that checks data for actionable insights
- [ ] Initial suggestion rules (8-10 rules covering Recipe Costing, Cash, Tips, Equipment)
- [ ] `NudgeCard.tsx` — time-aware reminder component
- [ ] `use-nudges.ts` — dashboard nudge logic (deposit reminder, tip day, maintenance due)
- [ ] `use-data-memory.ts` — smart defaults from recent data patterns
- [ ] `CsvImport.tsx` — reusable CSV upload + column mapping component
- [ ] CSV templates for common POS exports (Square, Toast, Clover)
- [ ] "Recommended" module badges on billing page
- [ ] All help content uses `useTerm()` for vertical-appropriate language

---

## 6. Phase 4: Core Module Rebuild — Recipe Costing

> **Can be done in parallel with:** Phase 5, Phase 6
> **Dependencies:** Phase 2 (VerticalContext, useTerm)
> **Estimated scope:** Rebuild `client/src/pages/home.tsx` (2,704 lines) into ~5-6 focused components

### 5.1 Simplification Plan

**Current:** 7 sub-tabs (Pricing Matrix, Ingredients, Recipes, Vendors, Bases, Overhead, Settings)
**Target:** 3 views

| Current Tab    | Action                           | Rationale                                                   |
| -------------- | -------------------------------- | ----------------------------------------------------------- |
| Pricing Matrix | **KEEP → rename "Menu Pricing"** | This is the payoff — what things cost                       |
| Ingredients    | **KEEP**                         | Core data entry                                             |
| Recipes        | **KEEP**                         | Core data entry                                             |
| Vendors        | **MERGE into Ingredients**       | Vendor is an attribute of an ingredient, not its own entity |
| Bases          | **MERGE into Recipes**           | Bases are recipe templates — just flag recipes as "base"    |
| Overhead       | **MOVE to Settings**             | Set once, rarely changed                                    |
| Settings       | **MOVE to gear icon**            | Rarely accessed                                             |

**New structure:**

```
Recipe Costing
├── Menu Pricing (read-only cost/margin dashboard — the "wow" screen)
├── Ingredients (with vendor info inline, CSV import)
└── Recipes (with base/template support, quick-add mode)
    └── [Settings gear icon] → Overhead, export, preferences
```

### 5.2 Key UX Improvements

**CSV Import for Ingredients:**

- Paste from spreadsheet or upload .csv
- Map columns (name, cost, quantity, unit, vendor)
- Preview before import
- Handles duplicates (update existing by name match)

**Quick Recipe Builder:**

- Visual ingredient picker (grid of ingredient cards, tap to add)
- Inline quantity entry
- Running cost total shown as you build
- Save → immediately shows up in Menu Pricing

**Size Variants (workflow flag: `sizeVariants`):**

- Only shown for verticals that enable it (pizza, some coffee shops)
- Adds S/M/L multiplier to recipes
- Each size can have different ingredient quantities

**Batch Scaling (workflow flag: `batchScaling`):**

- Only shown for verticals that enable it (pastry, bakery)
- "This recipe makes X items" with cost-per-item calculation

### 5.3 Component Breakdown

Replace `home.tsx` (2,704 lines) with:

```
client/src/pages/recipe-costing/
├── index.tsx              (~100 lines — tab container + routing)
├── MenuPricing.tsx        (~300 lines — cost/margin dashboard)
├── Ingredients.tsx         (~400 lines — ingredient CRUD + CSV import)
├── Recipes.tsx             (~400 lines — recipe CRUD + quick builder)
├── RecipeBuilder.tsx       (~300 lines — the recipe building UI)
├── IngredientImport.tsx    (~200 lines — CSV import dialog)
└── RecipeSettings.tsx      (~150 lines — overhead, export, prefs)
```

Total: ~1,850 lines across 7 files (vs. 2,704 in one file), each focused and testable.

### 5.4 Deliverables Checklist

- [ ] Break `home.tsx` into focused components in `pages/recipe-costing/`
- [ ] Rename "Pricing Matrix" → "Menu Pricing"
- [ ] Merge vendor management into ingredient form (vendor as a field)
- [ ] Merge bases into recipes (add `is_base` flag)
- [ ] Move overhead to settings drawer
- [ ] CSV import for ingredients
- [ ] Quick recipe builder (visual ingredient picker)
- [ ] Size variant support (behind `sizeVariants` workflow flag)
- [ ] Batch scaling support (behind `batchScaling` workflow flag)
- [ ] All terminology uses `useTerm()` — no hardcoded "drink"/"recipe" text
- [ ] Empty state for zero ingredients / zero recipes
- [ ] Mobile-responsive layouts for all views

---

## 7. Phase 5: Core Module Rebuild — Cash Deposit & Tip Payout

> **Can be done in parallel with:** Phase 4, Phase 6
> **Dependencies:** Phase 2 (VerticalContext, useTerm), Phase 3B (HelpTip, SmartSuggestion, data memory)
> **Estimated scope:** Rebuild 2 pages (~1,860 combined lines) into faster daily workflows

### 6.1 Cash Deposit Simplification

**Current:** `cash-deposit.tsx` (1,249 lines), 11 fields, adjustments behind toggle
**Target:** 60-second daily workflow

**Key changes:**

- Pre-fill `drawer_date` with today
- Pre-fill `starting_drawer` from tenant setting (already exists: `starting_drawer_default`)
- Show only 4 primary fields: Gross Revenue, Cash Sales, Actual Deposit, Notes
- Adjustments (pay_in, pay_out, refunds, owner_tips, tip_pool) stay behind "Adjustments" toggle — this is already done, keep it
- Auto-calculate expected deposit and show discrepancy in big, color-coded text
- **New: "Quick Deposit" mode** — for shops that just need to record the deposit amount and gross revenue (2 fields)
- History view below the form (already exists, simplify the table)

**Component breakdown:**

```
client/src/pages/cash-deposit/
├── index.tsx              (~80 lines — page shell)
├── DepositForm.tsx        (~300 lines — the entry form)
├── QuickDeposit.tsx       (~100 lines — 2-field fast mode)
├── DepositHistory.tsx     (~250 lines — past deposits table)
└── DepositSummary.tsx     (~100 lines — discrepancy display)
```

### 6.2 Tip Payout Simplification

**Current:** `tip-payout.tsx` (611 lines) + sub-components, 7-day grid with 14 inputs + per-employee hours
**Target:** Two workflow options

**Option A: "Simple Split" (default for small shops)**

- Enter total tips for the week (cash + CC = 2 fields)
- Enter hours per employee (auto-populated from time clock if calendar module enabled)
- Auto-calculate each person's share
- Done. 3 fields + employee hours.

**Option B: "Daily Breakdown" (opt-in for shops that need it)**

- Current 7-day grid with daily cash + CC
- Same per-employee hours
- This is the existing functionality, just cleaned up

Let the shop choose their preference in settings. Default to Simple Split.

**Component breakdown:**

```
client/src/pages/tip-payout/
├── index.tsx              (~80 lines — page shell)
├── SimpleSplit.tsx         (~250 lines — weekly total + hours split)
├── DailyBreakdown.tsx     (~350 lines — 7-day grid, cleaned up)
├── EmployeeHours.tsx      (~200 lines — shared hours entry)
├── PayoutSummary.tsx       (~150 lines — results + export)
└── PayoutHistory.tsx       (~200 lines — historical payouts)
```

### 6.3 Deliverables Checklist

- [ ] Break `cash-deposit.tsx` into focused components in `pages/cash-deposit/`
- [ ] Quick Deposit mode (2-field fast entry)
- [ ] Smart pre-fills (today's date, starting drawer from tenant setting)
- [ ] Color-coded discrepancy display
- [ ] Break `tip-payout.tsx` into focused components in `pages/tip-payout/`
- [ ] Simple Split mode (weekly totals, default)
- [ ] Daily Breakdown mode (opt-in, current behavior cleaned up)
- [ ] Auto-populate hours from time clock (if calendar module enabled)
- [ ] All terminology uses `useTerm()`
- [ ] Empty states for both modules
- [ ] Mobile-responsive layouts (especially the 7-day grid)

---

## 8. Phase 6: Core Module Rebuild — Equipment Maintenance

> **Can be done in parallel with:** Phase 4, Phase 5
> **Dependencies:** Phase 2 (VerticalContext, useTerm), Phase 3B (HelpTip, nudges)
> **Estimated scope:** Rebuild `equipment-maintenance.tsx` (2,630 lines) into reminder-focused UX

### 7.1 Philosophy Shift

**Current:** Equipment inventory management system (add equipment with serial numbers, brand, model, warranty, manuals, maintenance schedules)
**Target:** "What's overdue?" reminder system

Mom and pop owners don't want to catalog their equipment. They want to know: **"What do I need to clean/maintain today?"**

### 7.2 Simplified Structure

**Two views instead of complex tabs:**

**View 1: "Maintenance Due" (default view)**

- Shows overdue items in red, due-today in yellow, upcoming in gray
- Big tap targets — tap to mark as done
- One-tap "Done" with optional photo/notes
- Most-used view, optimized for speed

**View 2: "My Equipment" (setup/reference)**

- List of equipment with simplified entry (name, category, photo — that's it for the basics)
- Expandable details (brand, model, serial, warranty) for those who want it
- Maintenance schedule setup (what task, how often)

**Drop or defer:**

- Manual URL tracking → not critical for MVP
- Google Calendar export → nice-to-have, not essential
- Complex file attachments → keep photo capture, drop document uploads for now

### 7.3 Component Breakdown

```
client/src/pages/equipment/
├── index.tsx                  (~80 lines — page shell with view toggle)
├── MaintenanceDue.tsx         (~300 lines — overdue/today/upcoming lists)
├── MaintenanceAction.tsx      (~150 lines — mark-as-done dialog with photo)
├── EquipmentList.tsx          (~250 lines — equipment inventory)
├── EquipmentForm.tsx          (~200 lines — add/edit equipment)
└── MaintenanceSchedule.tsx    (~200 lines — set up recurring tasks)
```

### 7.4 Deliverables Checklist

- [ ] Break `equipment-maintenance.tsx` into focused components in `pages/equipment/`
- [ ] "Maintenance Due" as default view (overdue-first)
- [ ] One-tap "mark as done" with optional photo
- [ ] Simplified equipment entry (name + category + photo minimum)
- [ ] Expandable details for power users (brand, model, serial, warranty)
- [ ] Vertical-specific starter equipment from templates
- [ ] Push notification support for overdue maintenance (future enhancement)
- [ ] All terminology uses `useTerm()`
- [ ] Empty state: "Add your first piece of equipment"
- [ ] Mobile-optimized (big tap targets for shop floor use)

---

## 9. Phase 7: Second Vertical (Pizzeria)

> **Dependencies:** Phase 1 (vertical system), Phase 2 (frontend foundation), at least one module rebuild
> **Purpose:** Validate that the vertical system works — if no code changes are needed beyond config, the architecture is proven

### 8.1 Pizzeria Vertical Config

```json
{
  "slug": "pizzeria",
  "productName": "PizzaSuite",
  "displayName": "Pizzeria",
  "theme": {
    "primaryColor": "#D32F2F",
    "secondaryColor": "#388E3C",
    "accentColor": "#FFF8E1",
    "backgroundColor": "#FFFDF7",
    "iconEmoji": "🍕",
    "loadingText": "Preheating the oven..."
  },
  "terms": {
    "recipe": { "singular": "Menu Item", "plural": "Menu Items" },
    "ingredient": { "singular": "Ingredient", "plural": "Ingredients" },
    "recipeUnit": { "singular": "pie", "plural": "pies" },
    "equipment": { "singular": "Equipment", "plural": "Equipment" }
  },
  "workflows": {
    "sizeVariants": true,
    "batchScaling": true,
    "locationTracking": false,
    "prepStations": true
  },
  "suggestedModules": ["recipe-costing", "cash-deposit", "equipment-maintenance"]
}
```

### 8.2 Pizzeria Starter Templates

**Ingredients:** Pizza dough (per ball), marinara sauce, mozzarella, pepperoni, sausage, mushrooms, peppers, onions, olives, pizza boxes (S/M/L), parchment circles

**Recipes:** Cheese Pizza, Pepperoni Pizza, Margherita, Meat Lovers, Veggie Supreme — each with S/M/L size variants

**Equipment:** Pizza oven, Dough mixer, Dough sheeter, Prep table, Walk-in cooler, Pizza peel, Dough docker

### 8.3 Validation Criteria

The pizzeria vertical is **successful** if:

- [ ] Creating it requires ONLY database inserts (vertical config + templates) — no code changes
- [ ] All terminology renders correctly ("Menu Items" not "Drinks")
- [ ] Size variants appear in recipe builder (workflow flag works)
- [ ] Starter templates load correctly during onboarding
- [ ] Theme applies correctly (red/green instead of gold/brown)
- [ ] Landing page renders with pizzeria content

If code changes ARE needed, document them and fix the vertical engine to be more flexible.

---

## 10. Phase 8: Landing Pages & Branded Products

> **Dependencies:** Phase 1 (vertical config with landing_content), Phase 2 (theme system)
> **Can be done in parallel with:** Phase 7

### 9.1 Dynamic Landing Page

Replace `client/src/pages/landing.tsx` (645 lines of hardcoded coffee content) with a vertical-aware landing page:

```
client/src/pages/landing/
├── index.tsx              (~100 lines — loads vertical config, renders template)
├── HeroSection.tsx        (~100 lines — headline, subheadline, CTA from config)
├── ModuleShowcase.tsx     (~150 lines — shows modules with vertical-appropriate descriptions)
├── PricingSection.tsx     (~150 lines — pricing cards from modules table)
├── TestimonialsSection.tsx(~100 lines — from vertical config)
└── FooterSection.tsx      (~50 lines — links, legal)
```

**Domain routing:**

- `coffeesuite.com` → loads coffee vertical → renders coffee landing page
- `pizzasuite.com` → loads pizza vertical → renders pizza landing page
- `app.yourdomain.com/signup?v=coffee-shop` → fallback for verticals without custom domains

### 9.2 Deliverables Checklist

- [ ] Dynamic landing page components (driven by vertical config)
- [ ] Domain-based vertical detection middleware
- [ ] Signup flow passes `vertical_id` through to tenant creation
- [ ] Each branded product gets distinct meta tags, favicon, page title

---

## 11. Phase 9: White-Label & Reseller Enhancements

> **Dependencies:** Phase 1 (vertical system), Phase 8 (landing pages)
> **This is a later phase — foundational work makes it possible**

### 10.1 Reseller-Created Verticals

The existing reseller system (`resellers` table, `license_codes` table) gets extended:

- Add `reseller_id` column to `verticals` table (nullable — null = system-defined)
- Resellers can create custom verticals through a self-service UI
- Their verticals are only available to their referred tenants (via license codes)
- Revenue share: reseller gets percentage of subscriptions from their vertical's tenants

### 10.2 Custom Domain Mapping

- Resellers can map their own domains to their vertical
- DNS verification flow (add CNAME record)
- SSL certificate provisioning (Let's Encrypt or platform-level wildcard)

### 10.3 Deliverables Checklist

- [ ] Add `reseller_id` to `verticals` table
- [ ] Reseller vertical creation UI
- [ ] Custom domain mapping with DNS verification
- [ ] Revenue share tracking
- [ ] Reseller analytics (signups, active tenants, revenue per vertical)

---

## 12. Parallel Workstream Map

These workstreams can be run simultaneously by different people or AI sessions:

```
Week 1-2:
├── Workstream A: Phase 1 — Vertical DB schema + seed data
├── Workstream B: Phase 2 — VerticalContext + useTerm + ThemeProvider
└── Workstream C: Phase 2 — Navigation rebuild (BottomTabBar + DesktopSidebar)

Week 3-4:
├── Workstream A: Phase 3 — Onboarding wizard + empty states
├── Workstream B: Phase 3B — HelpTip, SmartSuggestion, NudgeCard components
├── Workstream C: Phase 3B — use-smart-suggestions rules + use-data-memory hook
└── Workstream D: Phase 3B — CsvImport component + POS templates

Week 5-7:
├── Workstream A: Phase 4 — Recipe Costing rebuild (with HelpTips + suggestions integrated)
├── Workstream B: Phase 5 — Cash Deposit + Tip Payout rebuild (with nudges + data memory)
├── Workstream C: Phase 6 — Equipment Maintenance rebuild (with nudges integrated)
└── Workstream D: Phase 3B — "Recommended" module badges on billing page

Week 8-9:
├── Workstream A: Phase 7 — Pizzeria vertical (validation)
├── Workstream B: Phase 8 — Dynamic landing pages
└── Workstream C: Integration testing + polish

Future:
├── Workstream A: Phase 9 — White-label + reseller enhancements
└── Workstream B: Phase 3B+ — Push notifications (service worker)
```

### Dependency Graph

```
Phase 1 (Vertical DB) ──────┐
                             ├──→ Phase 3 (Onboarding) ──┐
Phase 2 (Frontend Shell) ───┤                            ├──→ Phase 7 (Pizzeria)
                             ├──→ Phase 3B (Help/Guide) ──┤
                             │                            │
                             ├──→ Phase 4 (Recipe Costing) ┤
                             │    + HelpTips + Suggestions  │
                             ├──→ Phase 5 (Cash & Tips) ────┤──→ Phase 8 (Landing Pages)
                             │    + Nudges + Data Memory    │         │
                             └──→ Phase 6 (Equipment) ──────┘         ↓
                                  + Nudges                    Phase 9 (White-Label)
```

### What Can Run Right Now (No Dependencies)

1. **Phase 1: Database schema** — write and test migrations
2. **Phase 2: useTerm hook + defaults** — can build against mock data
3. **Phase 2: Navigation component design** — can build UI components in isolation
4. **Starter template research** — compile ingredient/recipe/equipment lists for each vertical
5. **Phase 3B: Help content writing** — draft all HelpTip explanations and SmartSuggestion rule definitions (no code needed, just content)
6. **Phase 3B: CSV template research** — collect sample CSV exports from Square, Toast, Clover POS systems to build import templates

---

## 13. Migration Strategy

### For the Existing Pilot Store (Erwin Mills)

1. **Before rebuild:** Snapshot current data (ingredients, recipes, deposits, etc.)
2. **During rebuild:** Keep current app running on `migrate-off-replit` branch
3. **Rebuild on new branch:** `platform-rebuild` branch with new frontend
4. **Migration day:**
   - Run migration `080_vertical_system.sql` to add vertical tables
   - Run migration `081_seed_coffee_vertical.sql` to create coffee vertical
   - Update Erwin Mills tenant: `SET vertical_id = (coffee vertical id)`
   - Deploy new frontend
   - Existing data (ingredients, recipes, deposits) is untouched — only the UI changes
5. **Rollback plan:** Switch back to old frontend if issues arise (backend is unchanged)

### For New Signups

- New tenants go through the onboarding wizard
- Vertical is selected during signup (or auto-detected from domain)
- Starter templates are offered during setup
- No migration needed — they start fresh

---

## Appendix A: Term Map by Vertical

| Term Key        | Coffee Shop | Pizzeria   | Pastry Shop  | Food Truck |
| --------------- | ----------- | ---------- | ------------ | ---------- |
| recipe          | Drink       | Menu Item  | Pastry       | Dish       |
| recipe (plural) | Drinks      | Menu Items | Pastries     | Dishes     |
| ingredient      | Ingredient  | Ingredient | Ingredient   | Ingredient |
| recipeUnit      | drink       | pie        | batch        | serving    |
| equipment       | Machine     | Equipment  | Equipment    | Equipment  |
| menuItem        | Menu Item   | Menu Item  | Display Item | Menu Item  |
| vendor          | Supplier    | Supplier   | Supplier     | Supplier   |

## Appendix B: Workflow Flags by Vertical

| Flag             | Coffee | Pizza | Pastry | Food Truck |
| ---------------- | ------ | ----- | ------ | ---------- |
| sizeVariants     | ❌     | ✅    | ❌     | ❌         |
| batchScaling     | ❌     | ✅    | ✅     | ❌         |
| locationTracking | ❌     | ❌    | ❌     | ✅         |
| prepStations     | ❌     | ✅    | ❌     | ❌         |
| dailySpecials    | ❌     | ❌    | ❌     | ✅         |
| displayCase      | ❌     | ❌    | ✅     | ❌         |

## Appendix C: Module Relevance by Vertical

| Module            | Coffee    | Pizza     | Pastry    | Food Truck       |
| ----------------- | --------- | --------- | --------- | ---------------- |
| Recipe Costing    | ⭐ Core   | ⭐ Core   | ⭐ Core   | ⭐ Core          |
| Cash Deposit      | ⭐ Core   | ⭐ Core   | ⭐ Core   | ⭐ Core          |
| Tip Payout        | ⭐ Core   | ⭐ Core   | ✅ Useful | ⭐ Core          |
| Equipment Maint   | ✅ Useful | ⭐ Core   | ✅ Useful | ⭐ Core          |
| Bulk Ordering     | ✅ Useful | ✅ Useful | ✅ Useful | ❌ Less relevant |
| Calendar/Schedule | ✅ Useful | ✅ Useful | ✅ Useful | ✅ Useful        |
| Admin Tasks       | ✅ Useful | ✅ Useful | ✅ Useful | ✅ Useful        |
| Reporting         | ✅ Useful | ✅ Useful | ✅ Useful | ✅ Useful        |
