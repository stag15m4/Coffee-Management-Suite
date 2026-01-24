# Erwin Mills Management Suite

## Overview

Erwin Mills Management Suite is a multi-tenant SaaS platform designed for food service operations. It offers a comprehensive set of white-label modules to manage various aspects of a business, including:

- **Recipe Cost Manager**: For tracking ingredients, creating recipes, and calculating costs.
- **Tip Payout Calculator**: To streamline employee tip distribution.
- **Cash Deposit Record**: For managing cash reconciliation and deposits.
- **Bulk Coffee Ordering**: To handle wholesale coffee orders efficiently.
- **Equipment Maintenance**: To schedule and track equipment upkeep.
- **Administrative Tasks**: A system for task management, delegation, and tracking.

The suite supports role-based access control (Owner, Manager, Lead, Employee) and allows for tenant-specific branding. Its business vision is to provide a robust, scalable solution for food service businesses, enhancing operational efficiency and profitability through an integrated management system.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Tenant & Multi-Location Design
The platform implements a robust multi-tenant architecture with data isolation achieved via Supabase Row Level Security (`tenant_id` on all data tables). It supports multi-location hierarchies, allowing tenants to manage multiple child locations. Users can be assigned to multiple locations, and the system includes functionality to switch between active locations. Role-based access control is granular, differentiating between Platform Admin (SaaS level) and tenant-level roles (Owner, Manager, Lead, Employee), each with specific permissions.

### Location Limits (migration 042)
- `subscription_plans.max_locations` defines location limit per plan (Free: 1, À La Carte: 1, Test & Eval: 3, Premium: 5)
- `tenants.max_locations_override` allows platform admins to override the plan limit for specific tenants (NULL = use plan limit)
- Helper functions: `get_tenant_max_locations()`, `get_tenant_location_count()`, `can_add_location()`, `get_tenant_location_usage()`
- Database trigger `check_location_limit` enforces limits on insert (prevents bypass)
- Location Management page shows "X of Y locations" usage indicator and disables Add button at limit

### Child Location Inheritance (migrations 044-045)
- **Module Inheritance**: Child locations automatically inherit enabled modules from their parent tenant's subscription
- **Data Inheritance**: Child locations can READ parent tenant's shared data:
  - Ingredients and ingredient categories
  - Recipes and base templates
  - Coffee vendors and products
  - Equipment and maintenance tasks
  - Tip employees (shared pools)
  - Admin task categories
- Helper function `can_read_tenant_data()` checks if user can access data from parent tenant
- Child locations can still create their own local data

### Branding System
Tenant-specific branding (logo, color scheme) is managed via the `tenant_branding` table and applied dynamically through a `ThemeProvider` using CSS variables.

### Location Context Indicator
When working in a child location, all module headers display:
- The location's own logo (if one exists in branding) OR the default Erwin Mills logo
- The location name (e.g., "Coffee on Broad")
- "Part of [Organization Name]" subtitle to show parent relationship

This branding is consistent across all modules: Dashboard, Recipe Cost Manager, Tip Payout Calculator, Cash Deposit Record, Coffee Order, Equipment Maintenance, and Administrative Tasks.

When working in the parent organization, the standard organization branding is shown.

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite

The frontend employs a component-based architecture with dedicated directories for pages, reusable UI components, and custom hooks.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL
- **API Design**: RESTful endpoints with Zod schema validation
- **Storage Pattern**: Repository pattern for database operations

The backend ensures a clean separation of concerns with distinct layers for API routes, database access, and schema definitions.

### Data Model
The core data model includes entities for Ingredients, Recipes, and a junction table for Recipe Ingredients, along with schemas for various modules like cash activity, tip payouts, coffee orders, equipment, and administrative tasks.

### Implemented Modules

#### Cash Deposit Record
Manages daily cash deposits, featuring auto-calculated fields, date range filtering, and CSV import/export.

#### Tip Payout Calculator
Handles weekly tip distribution, including CC fee deductions, employee management, hours entry, and comprehensive payout summaries with export options.

#### Coffee Order
Facilitates bulk coffee ordering with product pricing, order history, and export capabilities.

#### Equipment Maintenance
Tracks equipment and maintenance schedules, featuring warranty tracking with document uploads, various task intervals (time-based, usage-based), and visual status indicators.

#### Administrative Tasks
Provides comprehensive task management with custom categories, priority levels, due dates, assignee delegation, recurring task functionality, comments, audit history, and file attachments.

### Authentication System
An `AuthContext` manages user sessions, profiles, and tenant information. `ProtectedRoute` ensures role-based access control for routes, and the dashboard dynamically displays accessible modules.

### Stripe Payment Integration
The platform integrates with Stripe for subscription billing and payment processing:

**Architecture:**
- `stripe-replit-sync` manages Stripe schema and webhook sync automatically
- Products/prices stored in Stripe and synced to local `stripe.*` tables
- Tenants table has `stripe_customer_id`, `stripe_subscription_id`, `stripe_subscription_status` fields

**Subscription Products:**
- Premium Suite: $99.99/month or $999.99/year (all 6 modules, 5 locations)
- Individual modules (all $19.99/month each):
  - Recipe Cost Manager: $19.99/month
  - Tip Payout Calculator: $19.99/month
  - Equipment Maintenance: $19.99/month
  - Administrative Tasks: $19.99/month
  - Cash Deposit Record: $19.99/month
  - Coffee Ordering: $19.99/month
- Test & Eval plan exists but is gifted by platform admin only (not shown to users)

**Key Files:**
- `server/stripeClient.ts` - Stripe client initialization using Replit connector
- `server/stripeService.ts` - Service layer for Stripe operations
- `server/webhookHandlers.ts` - Webhook processing handler
- `client/src/pages/billing.tsx` - Billing & subscription management UI
- `scripts/seed-stripe-products.ts` - Creates products in Stripe

**Security:**
- Stripe routes verify user belongs to tenant via userId
- Only owners can manage billing (role check)
- Webhook route registered BEFORE express.json() for raw body access
- **Note**: Currently userId is passed from client. For production, implement server-side Supabase JWT verification to extract userId from verified token rather than trusting client-supplied values.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **Drizzle ORM**: Used for type-safe database interactions and migrations.

### External Services
- **Supabase**: Utilized for client-side SDK integration (`@supabase/supabase-js`) for authentication and real-time features.
- **Stripe**: Payment processing for subscriptions via `stripe` and `stripe-replit-sync` packages.

### Key NPM Packages
- `@tanstack/react-query`: For data fetching and caching.
- `drizzle-orm` / `drizzle-kit`: For ORM and migrations.
- `zod`: For runtime type validation.
- `@radix-ui/*`: For accessible UI primitives.
- `react-hook-form`: For form state management.
- `wouter`: For client-side routing.