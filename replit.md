# Erwin Mills Recipe Cost Manager

## Overview

This is a full-stack recipe cost management application designed for food service operations. The application allows users to track ingredients with their costs, create recipes with ingredient quantities, and automatically calculate recipe costs and profit margins. The system features a custom branded UI with gold, cream, and brown color schemes matching Erwin Mills tools branding.

## User Preferences

Preferred communication style: Simple, everyday language.

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