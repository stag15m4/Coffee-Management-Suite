# Coffee Management Suite - Improvement Roadmap

**Created**: 2026-02-02
**Last Updated**: 2026-02-02

This document tracks architectural improvements, code quality enhancements, and UI/UX recommendations for the Coffee Management Suite.

---

## Table of Contents

- [High Priority (Quick Wins)](#high-priority-quick-wins)
- [Medium Priority (High Impact)](#medium-priority-high-impact)
- [Long-term (Strategic)](#long-term-strategic)
- [Architecture & Code Quality](#architecture--code-quality)
- [Performance Optimizations](#performance-optimizations)
- [Security Enhancements](#security-enhancements)
- [UI/UX Improvements](#uiux-improvements)
- [Module-Specific Enhancements](#module-specific-enhancements)

---

## High Priority (Quick Wins)

### ✅ 1. Add Unit Tests for Calculation Functions
**Status**: Not Started
**Priority**: CRITICAL
**Effort**: Medium
**Impact**: High - Prevents bugs in financial calculations

**Tasks**:
- [ ] Set up Vitest testing framework
- [ ] Add tests for cash deposit calculations (`calculatedDeposit`, `difference`, `netCash`)
- [ ] Add tests for tip payout distribution logic
- [ ] Add tests for recipe costing calculations
- [ ] Set up CI/CD to run tests on PR

**Files to Test**:
- `client/src/pages/cash-deposit.tsx` (lines 182-201)
- Tip payout calculation logic
- Recipe costing calculations

**Acceptance Criteria**:
- 80%+ coverage on calculation functions
- All edge cases tested (negative numbers, zero values, etc.)

---

### ✅ 2. Standardize Error Handling
**Status**: Not Started
**Priority**: HIGH
**Effort**: Medium
**Impact**: High - Better user experience

**Tasks**:
- [ ] Create error handling middleware (`server/middleware/errorHandler.ts`)
- [ ] Define standard error response format
- [ ] Replace all `any` error types with proper Error types
- [ ] Add error boundaries in React components
- [ ] Implement retry logic for transient failures

**Standard Response Format**:
```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: { message: string, code: string, details?: any } }
```

**Files to Update**:
- `server/index.ts` (error middleware)
- All API route handlers
- `client/src/contexts/AuthContext.tsx` (error handling)

**Acceptance Criteria**:
- All API endpoints return consistent error format
- User-friendly error messages displayed
- No `any` types in error handling

---

### ✅ 3. Add Empty States
**Status**: Not Started
**Priority**: HIGH
**Effort**: Low
**Impact**: Medium - Polished feel

**Tasks**:
- [ ] Create reusable `<EmptyState>` component
- [ ] Update Cash Deposit empty state
- [ ] Update Tip Payout empty state
- [ ] Update Coffee Orders empty state
- [ ] Update Equipment Maintenance empty state
- [ ] Update Admin Tasks empty state
- [ ] Add illustrations/icons to empty states

**Component Design**:
```tsx
<EmptyState
  icon={<ReceiptIcon />}
  title="No cash deposits yet"
  description="Record your first deposit to start tracking daily cash activity"
  action={<Button onClick={onAddFirst}>Add First Entry</Button>}
/>
```

**Acceptance Criteria**:
- All modules have actionable empty states
- Consistent design across modules
- Clear call-to-action buttons

---

### ✅ 4. Loading Skeletons
**Status**: Not Started
**Priority**: HIGH
**Effort**: Low
**Impact**: Medium - Professional feel

**Tasks**:
- [ ] Create `<Skeleton>` component
- [ ] Create `<TableSkeleton>` component
- [ ] Create `<CardSkeleton>` component
- [ ] Update Dashboard loading state
- [ ] Update Cash Deposit loading state
- [ ] Update all module loading states

**Component Location**: `client/src/components/ui/skeleton.tsx`

**Acceptance Criteria**:
- No blank screens during loading
- Skeleton matches actual content layout
- Smooth transition from skeleton to content

---

### ✅ 5. Dashboard Analytics Widgets
**Status**: Not Started
**Priority**: HIGH
**Effort**: Medium
**Impact**: High - Immediate value

**Tasks**:
- [ ] Design dashboard widget layout
- [ ] Create "Revenue This Month" widget (from cash deposits)
- [ ] Create "Upcoming Maintenance" widget (next 7 days)
- [ ] Create "Recent Orders" widget (last 5)
- [ ] Create "Active Tasks" widget (assigned to user)
- [ ] Add loading states for widgets
- [ ] Make widgets responsive

**Data Sources**:
- Cash Deposit: Total gross revenue (current month)
- Equipment: Maintenance tasks due in next 7 days
- Orders: Last 5 coffee orders
- Tasks: Active tasks assigned to current user

**Files to Update**:
- `client/src/pages/dashboard.tsx`

**Acceptance Criteria**:
- Dashboard shows 4-6 insight widgets
- Data loads efficiently (parallel queries)
- Widgets link to respective modules

---

### ✅ 6. Auto-Save Drafts
**Status**: Not Started
**Priority**: HIGH
**Effort**: Medium
**Impact**: High - Prevents data loss

**Tasks**:
- [ ] Create `useAutoSave` hook
- [ ] Implement localStorage draft storage
- [ ] Add "Draft saved" indicator
- [ ] Add "Restore draft" prompt on page load
- [ ] Clear draft after successful save
- [ ] Implement for Cash Deposit form
- [ ] Implement for Tip Payout form

**Hook Design**:
```typescript
const { saveDraft, restoreDraft, clearDraft, lastSaved } = useAutoSave('cash-deposit', formData);
```

**Files to Update**:
- `client/src/hooks/use-auto-save.ts` (new)
- `client/src/pages/cash-deposit.tsx`
- `client/src/pages/tip-payout.tsx`

**Acceptance Criteria**:
- Drafts saved every 30 seconds
- User prompted to restore on page reload
- Drafts cleared after successful submission

---

### ✅ 7. Environment Variable Validation
**Status**: Not Started
**Priority**: HIGH
**Effort**: Low
**Impact**: Medium - Catch config errors early

**Tasks**:
- [ ] Create Zod schema for environment variables
- [ ] Validate on server startup
- [ ] Provide helpful error messages for missing vars
- [ ] Create `.env.example` file
- [ ] Document all required environment variables

**File Location**: `server/config/env.ts` (new)

**Required Variables**:
- DATABASE_URL
- STRIPE_SECRET_KEY
- RESEND_API_KEY
- REPLIT_DOMAINS
- NODE_ENV

**Acceptance Criteria**:
- Server fails fast with clear error if env vars missing
- .env.example has all required variables documented

---

## Medium Priority (High Impact)

### ✅ 8. Global Search/Command Palette
**Status**: Not Started
**Priority**: MEDIUM
**Effort**: Medium
**Impact**: Very High - Major productivity boost

**Tasks**:
- [ ] Implement command palette using `cmdk` library
- [ ] Add keyboard shortcut (Cmd/Ctrl + K)
- [ ] Add navigation commands (go to modules)
- [ ] Add search across entries/tasks/orders
- [ ] Add quick actions (create new entry, switch location)
- [ ] Add recent items
- [ ] Style to match branding

**Features**:
- Navigate to any module
- Search cash deposits by date
- Search tasks by title
- Search orders by product
- Quick create actions
- Location switcher

**Files to Create**:
- `client/src/components/CommandPalette.tsx`

**Acceptance Criteria**:
- Cmd+K opens palette
- Fuzzy search works
- Recent items shown by default
- ESC closes palette

---

### ✅ 9. Mobile Bottom Navigation
**Status**: Not Started
**Priority**: MEDIUM
**Effort**: Medium
**Impact**: High - Better mobile UX

**Tasks**:
- [ ] Create bottom tab bar component
- [ ] Show on mobile, hide on desktop (media query)
- [ ] Add icons for main modules
- [ ] Highlight active tab
- [ ] Make sticky at bottom
- [ ] Ensure doesn't interfere with input keyboards

**Navigation Items**:
- Dashboard (Home icon)
- Cash Deposit (Receipt icon)
- Tips (DollarSign icon)
- Orders (Coffee icon)
- More (Menu icon)

**Files to Create**:
- `client/src/components/MobileBottomNav.tsx`

**Acceptance Criteria**:
- Shows on screens < 768px
- Hides on desktop
- Active tab highlighted
- Doesn't cover content

---

### ✅ 10. Cash Deposit Trend Charts
**Status**: Not Started
**Priority**: MEDIUM
**Effort**: Medium
**Impact**: High - Visual insights

**Tasks**:
- [ ] Add recharts visualization section
- [ ] Create "Revenue Over Time" line chart
- [ ] Create "Weekly Comparison" bar chart
- [ ] Create "Variance Trends" chart
- [ ] Add date range selector for charts
- [ ] Make charts responsive
- [ ] Add export chart as image

**Chart Placement**: After stats cards, before transaction history

**Files to Update**:
- `client/src/pages/cash-deposit.tsx`

**Acceptance Criteria**:
- Charts load efficiently
- Responsive on mobile
- Color-coded for clarity
- Tooltips show detailed data

---

### ✅ 11. Onboarding Flow
**Status**: Not Started
**Priority**: MEDIUM
**Effort**: High
**Impact**: High - Reduce friction for new users

**Tasks**:
- [ ] Create welcome modal for first login
- [ ] Add interactive tour of dashboard
- [ ] Create "Getting Started" checklist
- [ ] Add tooltips for first-time actions
- [ ] Store onboarding completion in user preferences
- [ ] Allow skip/dismiss of tour

**Checklist Items**:
- [ ] Explore available modules
- [ ] Set up your first cash deposit
- [ ] Add team members
- [ ] Customize branding (owners only)
- [ ] Review subscription plan

**Files to Create**:
- `client/src/components/OnboardingModal.tsx`
- `client/src/components/OnboardingTour.tsx`

**Acceptance Criteria**:
- Shows only on first login
- Can be dismissed
- Can be re-triggered from settings
- Doesn't block critical functionality

---

### ✅ 12. Bulk Actions
**Status**: Not Started
**Priority**: MEDIUM
**Effort**: Medium
**Impact**: Medium - Power user efficiency

**Tasks**:
- [ ] Add checkbox selection to tables
- [ ] Create bulk action toolbar
- [ ] Implement bulk archive (cash deposits)
- [ ] Implement bulk complete (tasks)
- [ ] Implement bulk export (selected entries)
- [ ] Add "Select All" option
- [ ] Add confirmation dialogs for destructive actions

**Modules to Update**:
- Cash Deposit (bulk archive)
- Admin Tasks (bulk complete, bulk delete)
- Equipment Maintenance (bulk log maintenance)

**Acceptance Criteria**:
- Checkboxes in table headers and rows
- Action bar appears when items selected
- Confirmation for destructive actions

---

### ✅ 13. Real-time Notifications
**Status**: Not Started
**Priority**: MEDIUM
**Effort**: High
**Impact**: High - Leverage Supabase

**Tasks**:
- [ ] Set up Supabase real-time subscriptions
- [ ] Create notification center component
- [ ] Add bell icon in header with badge
- [ ] Subscribe to task assignments
- [ ] Subscribe to maintenance due dates
- [ ] Subscribe to subscription changes
- [ ] Add notification preferences
- [ ] Mark notifications as read

**Notification Types**:
- Task assigned to you
- Task completed
- Maintenance due soon
- Subscription expiring
- New team member added

**Files to Create**:
- `client/src/components/NotificationCenter.tsx`
- `client/src/hooks/use-notifications.ts`

**Acceptance Criteria**:
- Real-time updates without page refresh
- Unread count badge on bell icon
- Notification list with timestamps
- Click to view related item

---

### ✅ 14. API Documentation
**Status**: Not Started
**Priority**: MEDIUM
**Effort**: Medium
**Impact**: Medium - Developer experience

**Tasks**:
- [ ] Install swagger-jsdoc and swagger-ui-express
- [ ] Add JSDoc comments to all routes
- [ ] Generate OpenAPI spec
- [ ] Serve Swagger UI at /api/docs
- [ ] Document all request/response schemas
- [ ] Add authentication documentation
- [ ] Include example requests

**Endpoint Groups**:
- Authentication
- Cash Deposits
- Tip Payouts
- Coffee Orders
- Equipment Maintenance
- Admin Tasks
- Users & Tenants
- Billing

**Files to Create**:
- `server/swagger.ts`

**Acceptance Criteria**:
- All endpoints documented
- Interactive API explorer available
- Request/response examples included

---

### ✅ 15. Rate Limiting
**Status**: Not Started
**Priority**: MEDIUM
**Effort**: Low
**Impact**: Medium - Security hardening

**Tasks**:
- [ ] Install express-rate-limit
- [ ] Add rate limiting to login endpoint
- [ ] Add rate limiting to all POST endpoints
- [ ] Configure different limits per endpoint type
- [ ] Add rate limit headers in responses
- [ ] Log rate limit violations

**Rate Limits**:
- Login: 5 attempts per 15 minutes
- Data mutations: 100 per 15 minutes
- Exports: 10 per hour
- Feedback: 5 per hour (already implemented)

**Files to Update**:
- `server/index.ts`
- `server/routes.ts`

**Acceptance Criteria**:
- Rate limits enforced
- Clear error messages when limited
- Different limits per endpoint type

---

## Long-term (Strategic)

### ✅ 16. PWA/Offline Support
**Status**: Not Started
**Priority**: LOW
**Effort**: High
**Impact**: Very High - Game changer

**Tasks**:
- [ ] Add service worker
- [ ] Create offline page
- [ ] Cache static assets
- [ ] Queue mutations when offline
- [ ] Sync when back online
- [ ] Add install prompt
- [ ] Create app manifest
- [ ] Add offline indicators

**Acceptance Criteria**:
- App works offline
- Queued actions sync when online
- User notified of offline status
- Can be installed as app

---

### ✅ 17. Advanced Report Builder
**Status**: Not Started
**Priority**: LOW
**Effort**: Very High
**Impact**: High - Premium differentiator

**Tasks**:
- [ ] Design report builder UI
- [ ] Create drag-and-drop metric selector
- [ ] Add filter options (date, location, employee)
- [ ] Add chart/table selector
- [ ] Save report templates
- [ ] Schedule recurring reports
- [ ] Email delivery
- [ ] PDF generation with branding

**Acceptance Criteria**:
- Visual builder interface
- Save and reuse templates
- Scheduled email delivery
- Professional PDF output

---

### ✅ 18. White-Label/Custom Domains
**Status**: Not Started
**Priority**: LOW
**Effort**: Very High
**Impact**: High - Enterprise feature

**Tasks**:
- [ ] Add custom domain support
- [ ] SSL certificate management
- [ ] Remove "Powered by" footer (premium)
- [ ] Full branding customization
- [ ] Custom email domain integration
- [ ] Pricing tier for white-label

**Acceptance Criteria**:
- Premium customers can use custom domains
- No branding references for white-label
- SSL automatically provisioned

---

### ✅ 19. Cross-Location Insights Dashboard
**Status**: Not Started
**Priority**: LOW
**Effort**: High
**Impact**: High - Multi-location value

**Tasks**:
- [ ] Create organization-level dashboard
- [ ] Compare revenue across locations
- [ ] Equipment status across all sites
- [ ] Task completion rates by location
- [ ] Tip distribution comparisons
- [ ] Location ranking/leaderboards

**Files to Create**:
- `client/src/pages/organization-insights.tsx`

**Acceptance Criteria**:
- Owner-only access
- View all child locations at once
- Export consolidated reports

---

### ✅ 20. Equipment QR Codes
**Status**: Not Started
**Priority**: LOW
**Effort**: Medium
**Impact**: Medium - Innovation

**Tasks**:
- [ ] Generate QR codes for equipment
- [ ] Print QR code labels
- [ ] Scan QR to log maintenance
- [ ] Mobile-optimized scanner
- [ ] Link to equipment details

**Acceptance Criteria**:
- Each equipment has unique QR code
- Scan to quickly log maintenance
- Works on mobile devices

---

## Architecture & Code Quality

### Type Safety Improvements
**Status**: Not Started

**Tasks**:
- [ ] Replace all `any` types with proper types
- [ ] Create shared API types in `/shared`
- [ ] Add strict TypeScript settings
- [ ] Fix type errors in error handlers

**Priority Fixes**:
- `server/index.ts:71` (error handling)
- `client/src/pages/cash-deposit.tsx:242` (error catch)

---

### Code Organization
**Status**: Not Started

**Tasks**:
- [ ] Extract business logic from large components
- [ ] Create domain-specific component folders
- [ ] Create custom hooks for modules
- [ ] Split 1000+ line components

**Large Components to Refactor**:
- `client/src/pages/cash-deposit.tsx` (1092 lines)
- Other module pages if similar size

---

### Shared Types Between Frontend/Backend
**Status**: Not Started

**Tasks**:
- [ ] Move API request/response types to `/shared`
- [ ] Create shared validation schemas
- [ ] Import shared types in both client and server
- [ ] Ensure type consistency across stack

---

## Performance Optimizations

### Query Optimization
**Status**: Not Started

**Tasks**:
- [ ] Add pagination to transaction history
- [ ] Add pagination to task lists
- [ ] Add infinite scroll where appropriate
- [ ] Optimize date range queries

---

### Database Indexing
**Status**: Not Started

**Tasks**:
- [ ] Audit slow queries
- [ ] Add index: `cash_activity(tenant_id, drawer_date)`
- [ ] Add index: `admin_tasks(tenant_id, status, due_date)`
- [ ] Add index: `tip_weekly_data(tenant_id, week_start_date)`
- [ ] Run EXPLAIN ANALYZE on common queries

---

### React Query Cache Tuning
**Status**: Not Started

**Tasks**:
- [ ] Increase stale times for static data (modules, branding)
- [ ] Optimize refetch settings
- [ ] Review cache invalidation logic
- [ ] Add selective query invalidation

---

## Security Enhancements

### Input Sanitization
**Status**: Not Started

**Tasks**:
- [ ] Add sanitization for text fields
- [ ] Sanitize notes, comments, descriptions
- [ ] Add XSS protection middleware
- [ ] Test for injection vulnerabilities

---

### CSRF Protection
**Status**: Not Started

**Tasks**:
- [ ] Install csurf middleware
- [ ] Add CSRF tokens to forms
- [ ] Configure CSRF exemptions (API endpoints)
- [ ] Test CSRF protection

---

### Audit Logging
**Status**: Not Started

**Tasks**:
- [ ] Expand audit logging to critical operations
- [ ] Log user role changes
- [ ] Log module subscription changes
- [ ] Log tenant settings modifications
- [ ] Log financial data edits
- [ ] Create audit log viewer for owners

---

## UI/UX Improvements

### Responsive Table Design
**Status**: Not Started

**Tasks**:
- [ ] Card view on mobile for cash deposits
- [ ] Card view on mobile for tip payouts
- [ ] Card view on mobile for tasks
- [ ] Media query responsive tables
- [ ] Test on various screen sizes

---

### Inline Validation
**Status**: Not Started

**Tasks**:
- [ ] Real-time email validation
- [ ] Real-time date range validation
- [ ] Real-time number validation (positive only)
- [ ] Show validation errors immediately
- [ ] Clear errors on fix

---

### Keyboard Shortcuts
**Status**: Not Started

**Tasks**:
- [ ] Document keyboard shortcuts
- [ ] Add Ctrl+S to save entries
- [ ] Add Ctrl+Enter to submit forms
- [ ] Add Esc to cancel/close modals
- [ ] Show shortcuts on hover

---

### Toast Improvements
**Status**: Not Started

**Tasks**:
- [ ] Add action buttons to toasts (Undo, View, etc.)
- [ ] Add toast queue management
- [ ] Add different toast types (info, warning, success, error)
- [ ] Add progress toasts for long operations

---

### Accessibility (A11y)
**Status**: Not Started

**Tasks**:
- [ ] Audit keyboard navigation
- [ ] Add skip links for forms
- [ ] Add ARIA labels to icon-only buttons
- [ ] Add screen reader announcements
- [ ] Run WCAG contrast checker
- [ ] Test 200% zoom compliance
- [ ] Add focus indicators

---

## Module-Specific Enhancements

### Recipe Costing
**Status**: Not Started

**Tasks**:
- [ ] Add recipe search/filter
- [ ] Visual recipe cards with photos
- [ ] Cost history tracking
- [ ] Print-friendly recipe view
- [ ] Ingredient inventory tracking

---

### Tip Payout
**Status**: Not Started

**Tasks**:
- [ ] Export to PDF per employee
- [ ] Historical tip trends
- [ ] Shift-based tip entry
- [ ] Custom tip pooling rules

---

### Cash Deposit
**Status**: Not Started

**Tasks**:
- [ ] Quick entry mode
- [ ] Photo attachment for deposit slips
- [ ] Bank reconciliation matching
- [ ] Auto-flag variance threshold

---

### Coffee Orders
**Status**: Not Started

**Tasks**:
- [ ] Favorite orders
- [ ] Order templates
- [ ] Inventory deduction
- [ ] Vendor performance tracking

---

### Equipment Maintenance
**Status**: Not Started

**Tasks**:
- [ ] QR codes for equipment
- [ ] Photo attachments
- [ ] Maintenance cost tracking
- [ ] Vendor management

---

### Admin Tasks
**Status**: Not Started

**Tasks**:
- [ ] Kanban board view
- [ ] Task dependencies
- [ ] Time tracking
- [ ] Task templates

---

## Testing Infrastructure

### Unit Tests
**Status**: Not Started

**Tasks**:
- [ ] Set up Vitest
- [ ] Test calculation functions
- [ ] Test auth context logic
- [ ] Test API route handlers
- [ ] Achieve 80% coverage

---

### Integration Tests
**Status**: Not Started

**Tasks**:
- [ ] Test user registration flow
- [ ] Test multi-location switching
- [ ] Test subscription checkout flow
- [ ] Test module access control

---

### E2E Tests
**Status**: Not Started

**Tasks**:
- [ ] Set up Playwright
- [ ] Test cash deposit entry
- [ ] Test tip payout calculation
- [ ] Test coffee order submission
- [ ] Test task creation and assignment

---

## Developer Experience

### Development Scripts
**Status**: Not Started

**Tasks**:
- [ ] Add `test` script
- [ ] Add `test:e2e` script
- [ ] Add `db:seed` script
- [ ] Add `db:reset` script
- [ ] Add `format` script
- [ ] Add `lint` script

---

### Environment Documentation
**Status**: Not Started

**Tasks**:
- [ ] Create `.env.example`
- [ ] Document all environment variables
- [ ] Add README section on setup
- [ ] Document development workflow

---

## Migration and Schema

### Migration Organization
**Status**: Not Started

**Tasks**:
- [ ] Consolidate older migrations
- [ ] Create baseline migration
- [ ] Document migration process

---

### Soft Delete Standardization
**Status**: Not Started

**Tasks**:
- [ ] Standardize on `deleted_at` pattern
- [ ] Update all tables to use `deleted_at`
- [ ] Update queries to filter deleted records
- [ ] Add restore functionality

---

### User Tracking
**Status**: Not Started

**Tasks**:
- [ ] Add `created_by_user_id` to tables
- [ ] Add `updated_by_user_id` to tables
- [ ] Update insert/update logic
- [ ] Add audit trail queries

---

## Notes

### Completed Items
- None yet

### Blocked Items
- None yet

### Questions/Decisions Needed
- Theme builder scope - how customizable?
- White-label pricing model?
- Report builder complexity level?
- Offline support - which modules priority?

---

**Last Updated**: 2026-02-02
