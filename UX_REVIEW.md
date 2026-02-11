# UX Review: Coffee Management Suite

**Date:** 2026-02-11
**Reviewed by:** Claude (AI-assisted audit)

After reviewing all 24 pages, 77 components, the sidebar, layout, and dashboard, here are findings organized by impact. These draw on patterns from competitors like Toast, Square, and 7shifts, as well as current SaaS best practices (progressive disclosure, modular dashboards, mobile-first design).

---

## 1. No Mobile/Responsive Support (Critical)

Target users are **coffee shop employees and managers** — people who are often on their feet, not at a desk. Right now the app has **zero mobile responsiveness**:

- `AppLayout.tsx` is a fixed `flex` layout — sidebar is always 224px, no hamburger menu, no responsive breakpoints
- No `useMediaQuery`, no `sm:`/`md:`/`lg:` Tailwind breakpoints anywhere in the layout
- Competitors like 7shifts and Homebase are **mobile-first** — employees clock in, check schedules, and request time off from their phones

**Suggestions:**
- Add a collapsible sidebar with hamburger toggle on `md:` and below
- Make the dashboard stack vertically on mobile
- Prioritize mobile layouts for employee-facing features: Time Clock, Schedule, Time Off requests
- Consider a bottom navigation bar on mobile (like Toast/7shifts apps) for the 4-5 most common actions

---

## 2. Navigation Overload — 14+ Sidebar Items

The sidebar currently shows **up to 15 items** including Dashboard, 7 modules, disabled module teasers, 4 admin links, Profile, and Sign Out. This violates the "7 plus or minus 2" cognitive load principle.

Current structure in `Sidebar.tsx`:
```
Dashboard
── MODULES ──
  Location Switcher
  Recipe Costing (6 sub-tabs)
  Tip Payout
  Cash Deposit
  Coffee Orders
  Equipment (2 sub-tabs)
  Tasks
  Calendar (4 sub-tabs)
  [Locked modules...]
── ADMIN ──
  Locations
  Users
  Branding
  Billing
── USER ──
  Profile
  Sign Out
```

**Suggestions:**
- **Group by workflow, not by module.** Consider grouping into 3-4 categories like Toast does:
  - **Home** (dashboard)
  - **Operations** (Cash Deposit, Tip Payout, Coffee Orders)
  - **Kitchen** (Recipe Costing)
  - **Team** (Calendar, Tasks, My Team)
  - **Settings** (Admin, Billing, Branding, Profile) — collapsed by default
- **Remove disabled module teasers from nav.** They add clutter. Instead, show a single "Explore more modules" link that goes to billing, or surface them on the dashboard as upsell cards
- **Collapse the Admin section** into a Settings page with tabs, rather than 4 separate nav items. This is how Square, Linear, and Notion handle it
- **Move Sign Out** into a user avatar dropdown (top or bottom of sidebar), not a standalone nav item

---

## 3. Recipe Costing Page Is a 4,589-Line Monolith

`home.tsx` is by far the largest page — it contains **7 tabs** (Pricing, Ingredients, Recipes, Vendors, Bases, Overhead, Settings) with inline editing, forms, calculations, and bulk operations all in one file.

**Problems:**
- Overwhelming for first-time users — all 7 tabs visible immediately
- Performance risk — the entire 4,589-line component tree renders even when viewing a single tab
- Hard to maintain — a bug in the Vendors tab requires navigating a 4,589-line file

**Suggestions:**
- **Split each tab into its own component file** (e.g., `IngredientsTab.tsx`, `RecipesTab.tsx`). Use lazy loading (`React.lazy`) so only the active tab loads
- **Default to the most useful tab** for each role. New users should land on the Pricing Matrix or a "Getting Started" view, not a raw ingredient list
- **Add empty states with guidance** — "Add your first ingredient to start building recipes" with a clear CTA
- **Progressive disclosure on the Ingredients table**: show Name, Category, Cost, and Unit by default. Hide Vendor, Manufacturer, Item # behind a "Show more columns" toggle or an expandable row detail

---

## 4. Dashboard Could Be More Actionable

The dashboard (`dashboard.tsx`) is actually reasonably clean — StoreCards with action items grouped by urgency (Overdue, Today, This Week). But it could do more:

**Suggestions:**
- **Add quick-action buttons** at the top: "Clock In", "Enter Tips", "Log Deposit" — the 3 things an employee/manager does daily. Toast and 7shifts both surface high-frequency actions prominently
- **Show a "Today" summary card** above store cards: who's working, what's due, any flags. This replaces scanning across multiple store cards
- **Role-based dashboard content**: Employees should see their schedule, clock in/out, and assigned tasks. Managers see the current store overview with action items. Owners see multi-location aggregates. Right now everyone sees the same view
- **Collapse the MyDashboardCard** (clock in/out + weekly schedule) into a persistent top bar element rather than a card that pushes store metrics down

---

## 5. Duplicated Color Constants Everywhere

`const colors = { gold: '#C9A227', brown: '#4A3728', ... }` is copy-pasted in **every single page and component** — Sidebar, Dashboard, StoreCard, MyDashboardCard, home.tsx, billing.tsx, etc. Each has slightly different values too (e.g., `goldLight` is `'#D4B23A'` in one file and `'#D4B84A'` in another).

**Suggestions:**
- Extract into a shared `client/src/lib/colors.ts` or, better yet, configure as Tailwind CSS theme tokens in `tailwind.config.ts`. This way you get:
  - `text-brand-gold`, `bg-brand-cream` etc. everywhere
  - Consistent values (no more divergent `goldLight` shades)
  - Branding customization support already built into the admin branding page could feed these tokens
- This is also a prerequisite for dark mode if you ever want to support it

---

## 6. Missing Progressive Disclosure on Complex Forms

Several pages dump all fields on the user at once:

- **Cash Deposit**: 10 input fields visible immediately (date + 8 currency amounts + notes)
- **Admin Tasks**: Task creation has title, description, category, assignee, priority, due date, recurrence, estimated cost, attachments — all in one form
- **Tip Payout**: 7-day grid with cash/CC columns, plus employee hours below

**Suggestions:**
- **Cash Deposit**: Show the essential fields (date, net sales, tips, actual cash) first. Put "POS variance" and "other adjustments" under an "Advanced" accordion
- **Admin Tasks**: Use a two-step creation flow — Step 1: title, assignee, due date (the essentials). Step 2: description, priority, recurrence, estimated cost (the details). Or show them inline but collapsed
- **Tip Payout**: Default to showing the current day expanded, with other days collapsed. Add a "Quick entry" mode for the common case (enter today's totals only)
- In general, follow the pattern: **show what's needed 80% of the time by default; reveal the rest on demand**

---

## 7. No Global Search or Command Palette

With 7+ modules, 24 pages, and growing, there's no way to quickly navigate or find things. Modern SaaS apps (Linear, Notion, Vercel) all offer a `Cmd+K` command palette.

**Suggestion:**
- Add a command palette component (libraries like `cmdk` by Pacocoursey make this trivial). Actions like:
  - Navigate to any module
  - Search for an ingredient, recipe, employee, or task
  - Quick actions: "New task", "Log deposit", "Clock in"
- This is especially valuable on mobile where the sidebar may be collapsed

---

## 8. Missing Onboarding / Empty States

When a new tenant signs up and enables modules, they likely see empty tables with no guidance. The current pages jump straight to "here are your 7 tabs of data."

**Suggestions:**
- Add **contextual empty states** per module: "No ingredients yet — import from a spreadsheet or add your first one"
- Consider a **setup checklist** on the dashboard for new tenants (like Stripe's onboarding): "1. Add your first recipe, 2. Set up tip categories, 3. Invite your team"
- Hide tab counts/badges when they'd show "0" — don't draw attention to emptiness

---

## 9. Inconsistent Page Patterns

Some pages use inline editing in tables (Recipe Costing), some use modals (Admin Tasks, Admin Users), some use full forms (Cash Deposit). This inconsistency increases the learning curve.

**Suggestion:**
- Standardize on a pattern: **list view with slide-over/drawer for details and editing**. This is the pattern used by Toast, 7shifts, Linear, and most modern SaaS. It lets users maintain context (the list is visible behind the drawer) while editing
- Reserve modals for confirmations and simple actions (delete, role change)

---

## 10. Small but High-Impact Quick Wins

| Issue | Fix |
|-------|-----|
| Location switcher is buried in the sidebar under "Modules" label | Move to sidebar header, right under branding — it's a top-level context switch |
| "My Team" is a separate nav item from Calendar/Workforce | Merge into Calendar module as a "Team" sub-tab |
| Trial banner + sidebar trial badge = double messaging | Keep one — the sidebar badge. Remove the page banner or show it only on dashboard |
| No keyboard shortcuts | Add at minimum: `Cmd+K` (search), `G then D` (go to dashboard), `G then T` (go to tasks) |
| Footer component exists but adds little value | Remove it from module pages; keep it only on landing/public pages |

---

## Summary: Priority Ranking

| # | Change | Effort | Impact | Status |
|---|--------|--------|--------|--------|
| 1 | Mobile responsive layout | Medium | Very High | DONE |
| 2 | Consolidate navigation (group + reduce items) | Low | High | DONE |
| 3 | Split Recipe Costing into sub-components | Medium | High | DONE (overhead tab split, PricingTab, IngredientsTab, RecipesTab extracted) |
| 4 | Extract shared color tokens | Low | Medium | DONE |
| 5 | Add command palette (`Cmd+K`) | Low | Medium | DONE |
| 6 | Progressive disclosure on complex forms | Medium | High | DONE (cash deposit, admin tasks, ingredients column toggle) |
| 7 | Role-based dashboard customization | Medium | High | DONE |
| 8 | Empty states / onboarding checklist | Low | Medium | DONE (tip-payout, cash deposit, coffee orders, recipe costing tabs) |
| 9 | Standardize edit pattern (drawers vs modals) | High | Medium | DONE (ingredients, admin users, admin locations → sheet drawers; confirmations stay as modals) |
| 10 | Quick wins (location switcher, merge My Team, etc.) | Low | Low-Med | DONE (location switcher, trial banner, footer removal, search hint, keyboard shortcuts) |

---

## Feature Requests

Items from the product board — not UX overhaul, but tracked here so nothing is lost.

| # | Feature | Module | Effort | Status |
|---|---------|--------|--------|--------|
| F1 | Add vendor contact fields (name, phone, email) — requires new `recipe_vendors` table + modal (vendors are currently just text on ingredients) | Recipe Costing (Vendors) | Medium | DONE |
| F2 | Add "Food Items" to Overall Shop Averages modal | Recipe Costing (Pricing) | Low | DONE |
| F3 | Add Average Gross Daily Revenue calculation (compare to Daily Overhead Cost) | Recipe Costing (Overhead/Settings) | Medium | DONE |
| F4 | Add average daily revenue with outlier exclusion (checkbox to withhold festival/event days) | Cash Deposit / Reporting | Medium | DONE |
| F5 | Fix maintenance tasks to allow different images for the task vs the equipment (e.g. burr vs grinder) | Equipment Maintenance | Low | DONE |
| F6 | Add a reporting section for various statistics | New module | High | |
| F7 | Move overhead calculator onto its own tab | Recipe Costing | Low | DONE |

---

## References

- [Progressive Disclosure in SaaS UX (Lollypop Design)](https://lollypop.design/blog/2025/may/progressive-disclosure/)
- [Progressive Disclosure Examples (Userpilot)](https://userpilot.com/blog/progressive-disclosure-examples/)
- [SaaS UX Design Best Practices 2025 (Orbix Studio)](https://www.orbix.studio/blogs/saas-ux-design-best-practices-2025)
- [Dashboard UI/UX Design Principles 2025 (Medium)](https://medium.com/@allclonescript/20-best-dashboard-ui-ux-design-principles-you-need-in-2025-30b661f2f795)
- [SaaS UX Best Practices (Mouseflow)](https://mouseflow.com/blog/saas-ux-design-best-practices/)
- [Toast Software for Restaurants 2026 (Slam Media Lab)](https://www.slammedialab.com/post/toast-software)
- [7shifts for Cafes and Coffee Shops](https://www.7shifts.com/built-for/cafes/)
- [Best Restaurant Management Software 2026 (Homebase)](https://www.joinhomebase.com/blog/restaurant-management-software)
