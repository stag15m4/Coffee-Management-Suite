# Erwin Mills Management Suite

## Overview

This is a multi-tenant SaaS management suite for food service operations, designed to be white-labeled for multiple businesses. The suite includes:
- **Recipe Cost Manager** - Track ingredients, create recipes, calculate costs and margins
- **Tip Payout Calculator** - Calculate and distribute employee tips (Leads, Managers, Owners)
- **Cash Deposit Record** - Track cash deposits and reconciliation (Managers, Owners)
- **Bulk Coffee Ordering** - Manage wholesale coffee orders (Leads, Managers, Owners)
- **Equipment Maintenance** - Track equipment maintenance schedules (All team members)

Features role-based access control (Owner, Manager, Lead, Employee) with tenant-specific branding (logo, colors).

## User Preferences

Preferred communication style: Simple, everyday language.

## Multi-Tenant Architecture

### Tenant Isolation
- Each business (tenant) has isolated data via Supabase Row Level Security
- Tenant identified by `tenant_id` on all data tables
- Helper functions: `get_current_tenant_id()`, `get_current_user_role()`, `has_role_or_higher()`

### Role Hierarchy

#### Platform Level (SaaS Management)
- **Platform Admin** - Superuser role for SaaS operations. Can manage all tenants, view usage stats, create new businesses, activate/deactivate subscriptions. Separate from tenant users.

#### Tenant Level (Per-Business)
1. **Owner** - Full access within their business, can manage users and branding
2. **Manager** - Can manage recipes, ingredients, settings, and user management (cannot change owner roles)
3. **Lead** - Access to Tip Payout, Bulk Ordering, and Equipment Maintenance
4. **Employee** - Access to Equipment Maintenance only

### Branding System
- `tenant_branding` table stores logo URL and color scheme per tenant
- ThemeProvider loads branding on login and applies CSS variables
- Default: Erwin Mills gold/cream/brown color scheme

### Database Migrations
SQL migration files in `supabase-migrations/`:
1. `001_multi_tenant_schema.sql` - Creates tenants, tenant_branding, user_profiles tables
2. `002_add_tenant_to_tables.sql` - Adds tenant_id to existing tables
3. `003_row_level_security.sql` - Enables RLS policies for data isolation
4. `004_fix_user_profile_security.sql` - Prevents user role self-escalation
5. `005_create_first_user.sql` - Template for creating first owner account
6. `006_cash_activity_schema.sql` - Cash deposit tracking with auto-calculated fields
7. `007_tip_payout_schema.sql` - Tip employees, weekly tips, and employee hours tables
8. `008_coffee_order_schema.sql` - Coffee product prices and order history tables
9. `009_fix_user_profile_read.sql` - Fixes RLS circular dependency bug
10. `010_platform_admin_schema.sql` - Platform admin tables for SaaS management
11. `011_subscription_modules.sql` - Subscription plans and module access control
12. `013_equipment_maintenance_schema.sql` - Equipment, maintenance tasks, and logs tables
13. `014_maintenance_cost_field.sql` - Adds cost field to maintenance logs

### Subscription & Module Access System
- **Pricing Model**:
  - **À La Carte**: Tips, Deposits, Ordering at $19.99 each (pick and choose)
  - **Premium Suite**: All 4 modules for $99.99/month (includes Recipe Costing)
  - **Recipe Costing** is premium-only (the "heavy hitter" module)
- **Free Trial**: 14-day trial with all features
- **Platform Admin** can assign plans and select à la carte modules per tenant
- **Database Function**: `get_tenant_enabled_modules(tenant_id)` returns enabled modules
- Tables: `modules`, `subscription_plans`, `subscription_plan_modules`, `tenant_module_subscriptions`, `tenant_module_overrides`

### Implemented Modules

#### Cash Deposit Record (`/cash-deposit`)
- Tracks daily cash deposits with calculated deposit amounts
- Fields: drawer date, gross revenue, cash sales, tip pool, owner tips, pay in/out
- Auto-calculated: calculated deposit, difference, net cash
- Features: date range filtering, archive toggle, CSV import/export, flagging
- Styling: Erwin Mills branding with gold buttons, cream inputs

#### Tip Payout Calculator (`/tip-payout`)
- Manages tip distribution based on employee hours worked
- Week-based system (Monday-Sunday) with week picker
- Daily tip entry grid (7 days) for Cash and CC tips
- Automatic 3.5% CC fee deduction
- Employee management with deactivation:
  - Add new employees
  - Deactivate employees (preserves historical data for tax/audit)
  - Reactivate previously deactivated employees
  - Toggle to show/hide inactive employees
- Hours entry per employee with hours/minutes inputs
- Team hours verification check
- Payout summary showing:
  - Total tips after CC fee
  - Total team hours
  - Calculated hourly rate
  - Per-employee payouts
- Export functionality:
  - **Weekly export**: CSV and PDF with summary + individual paystubs
  - **Historical export**: Date range picker for payroll/audit purposes
    - Group report: All employees across multiple weeks
    - Individual report: Single employee history
- Tables: tip_employees (with is_active flag), tip_weekly_data, tip_employee_hours

#### Coffee Order (`/coffee-order`)
- Bulk coffee ordering from Five Star Coffee Roasters
- Products: 5lb bags (Espresso, Double Stack, Triple Stack, Decaf, Cold Brew) and 12oz bags
- Settings panel for vendor/CC email and product pricing
- Order history with load previous order functionality
- Summary showing items, units, and total cost
- Notes field for special instructions
- Export to CSV and PDF
- Tables: coffee_product_prices, coffee_order_history

#### Equipment Maintenance (`/equipment-maintenance`)
- Track equipment and maintenance schedules
- Dashboard with status overview (overdue, due soon, good)
- Equipment management (add/edit/delete equipment items with categories)
- Maintenance tasks support two interval types:
  - **Time-based**: Every X days (e.g., clean ice maker every 14 days)
  - **Usage-based**: Every X units (e.g., change burrs every 1000 lbs)
- Log completed maintenance with notes
- Visual color-coded status indicators:
  - Red: Overdue
  - Yellow: Due soon (within 7 days or 90% usage)
  - Green: Good
- Accessible to all team members (Employees, Leads, Managers, Owners)
- Tables: equipment, maintenance_tasks, maintenance_logs

### Authentication System
- **AuthContext** (`client/src/contexts/AuthContext.tsx`) - Manages user session, profile, tenant, and branding state
- **Login page** (`client/src/pages/login.tsx`) - Email/password authentication with Erwin Mills branding
- **ProtectedRoute** (`client/src/components/ProtectedRoute.tsx`) - Route-level access control by role/module
- **Dashboard** (`client/src/pages/dashboard.tsx`) - Role-based module cards showing accessible apps

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend follows a component-based architecture with:
- Pages in `client/src/pages/` for route-level components
- Reusable UI components in `client/src/components/ui/`
- Custom hooks in `client/src/hooks/` for data fetching and state
- Shared type definitions and schemas in `shared/`

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL
- **API Design**: RESTful endpoints defined in `shared/routes.ts` with Zod schema validation
- **Storage Pattern**: Repository pattern via `server/storage.ts` abstracting database operations

The backend uses a clean separation:
- `server/routes.ts` - API route handlers
- `server/storage.ts` - Database access layer implementing `IStorage` interface
- `server/db.ts` - Database connection pool setup
- `shared/schema.ts` - Drizzle table definitions and insert schemas

### Data Model
Three main entities:
1. **Ingredients** - Name, unit, price per package, amount in package
2. **Recipes** - Name, servings count, instructions
3. **Recipe Ingredients** - Junction table linking recipes to ingredients with quantities

### Build System
- Development: Vite dev server with HMR for frontend, tsx for backend
- Production: Custom build script using esbuild for server bundling and Vite for client

## External Dependencies

### Database
- **PostgreSQL** - Primary data store accessed via `DATABASE_URL` environment variable
- **Drizzle ORM** - Type-safe database queries with schema migrations in `migrations/` directory

### External Services
- **Supabase** - Client-side Supabase SDK is initialized in frontend code (`@supabase/supabase-js`) using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables. Note: The backend currently uses direct PostgreSQL via Drizzle, not Supabase.

### Key NPM Packages
- `@tanstack/react-query` - Data fetching and caching
- `drizzle-orm` / `drizzle-kit` - Database ORM and migrations
- `zod` - Runtime type validation for API inputs/outputs
- `@radix-ui/*` - Accessible UI primitives
- `react-hook-form` - Form state management
- `wouter` - Client-side routing