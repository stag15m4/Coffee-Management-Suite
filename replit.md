# Erwin Mills Management Suite

## Overview

This is a multi-tenant SaaS management suite for food service operations, designed to be white-labeled for multiple businesses. The suite includes:
- **Recipe Cost Manager** - Track ingredients, create recipes, calculate costs and margins
- **Tip Payout Calculator** - Calculate and distribute employee tips (Leads, Managers, Owners)
- **Cash Deposit Record** - Track cash deposits and reconciliation (Managers, Owners)
- **Bulk Coffee Ordering** - Manage wholesale coffee orders (Leads, Managers, Owners)

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
2. **Manager** - Can manage recipes, ingredients, settings
3. **Lead** - Access to Tip Payout and Bulk Ordering
4. **Employee** - View-only access (future expansion)

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

### Subscription & Module Access System
- **Subscription Plans**: Free Trial, Basic, Standard, Premium with different module access
- **Module Access Control**: Platform admin can assign plans to tenants and toggle individual modules
- **Per-Tenant Overrides**: Modules can be enabled/disabled per tenant beyond their plan defaults
- **Database Function**: `get_tenant_enabled_modules(tenant_id)` returns enabled modules for a tenant
- Tables: `modules`, `subscription_plans`, `subscription_plan_modules`, `tenant_module_overrides`

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
- Employee management (add new employees)
- Hours entry per employee with hours/minutes inputs
- Team hours verification check
- Payout summary showing:
  - Total tips after CC fee
  - Total team hours
  - Calculated hourly rate
  - Per-employee payouts
- CSV export functionality
- Tables: tip_employees, tip_weekly_data, tip_employee_hours

#### Coffee Order (`/coffee-order`)
- Bulk coffee ordering from Five Star Coffee Roasters
- Products: 5lb bags (Espresso, Double Stack, Triple Stack, Decaf, Cold Brew) and 12oz bags
- Settings panel for vendor/CC email and product pricing
- Order history with load previous order functionality
- Summary showing items, units, and total cost
- Notes field for special instructions
- Export to CSV and PDF
- Tables: coffee_product_prices, coffee_order_history

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