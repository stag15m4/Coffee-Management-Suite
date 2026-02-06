# Testing Documentation

This document provides step-by-step testing procedures for all features and bug fixes in the Coffee Management Suite.

---

## Table of Contents

- [iPad Safari App Resume Bug Fix](#ipad-safari-app-resume-bug-fix)
- [Dashboard Analytics Widgets](#dashboard-analytics-widgets)
- [Future Feature Testing](#future-feature-testing)

---

## iPad Safari App Resume Bug Fix

**Fixed**: 2026-02-02
**Commit**: [BUGFIX] - Fix iPad Safari app resume hanging issue

### Issue Description
When using the app on iPad Safari, switching to another app and then returning would cause the page to hang indefinitely, requiring a full page refresh.

### What Was Fixed
- Added timeout protection to session refresh (5 seconds max)
- Prevented duplicate resume events from cascading
- Added graceful error handling for network timeouts
- Added visual "Refreshing..." indicator during app resume
- Improved async operation handling for location queries

### Testing Steps

#### Test 1: Quick App Switch (< 5 seconds)
**Expected Behavior**: No refresh should occur, app continues normally

1. Open the Coffee Management Suite on iPad Safari
2. Log in to your account
3. Navigate to any module (e.g., Cash Deposit)
4. **Switch to another app** (e.g., Settings, Notes, etc.)
5. **Wait 3 seconds**
6. **Switch back to Safari**

**✅ Pass Criteria**:
- Page does NOT show "Refreshing..." banner
- Page remains responsive immediately
- No data refetch occurs
- Console shows: "App was only hidden briefly, skipping refresh"

---

#### Test 2: Medium App Switch (5-30 seconds)
**Expected Behavior**: Session refresh but no page data refresh

1. Open the Coffee Management Suite on iPad Safari
2. Log in to your account
3. Navigate to any module with data (e.g., Cash Deposit with entries)
4. **Switch to another app**
5. **Wait 10 seconds**
6. **Switch back to Safari**

**✅ Pass Criteria**:
- "Refreshing..." banner appears briefly at top (gold background)
- Banner disappears after ~2 seconds
- Page remains responsive (no hanging)
- No data refetch occurs (existing data still visible)
- Console shows: "Session refreshed successfully"

---

#### Test 3: Long App Switch (> 30 seconds)
**Expected Behavior**: Full refresh including page data

1. Open the Coffee Management Suite on iPad Safari
2. Log in to your account
3. Navigate to Cash Deposit or Tip Payout page
4. **Switch to another app**
5. **Wait 35 seconds**
6. **Switch back to Safari**

**✅ Pass Criteria**:
- "Refreshing..." banner appears at top
- Banner disappears after ~2 seconds
- Page data refreshes (you may see loading states briefly)
- Page remains responsive throughout
- Console shows: "Dispatching app-resumed event to refresh page data"
- All data loads successfully

---

#### Test 4: App Switch with Poor Network
**Expected Behavior**: Graceful degradation, no hanging

1. Open the Coffee Management Suite on iPad Safari
2. Log in to your account
3. **Enable Airplane Mode** (Settings > Airplane Mode)
4. Wait 2 seconds
5. **Disable Airplane Mode**
6. Immediately **switch to another app**
7. **Wait 10 seconds**
8. **Switch back to Safari**

**✅ Pass Criteria**:
- "Refreshing..." banner appears
- Page does NOT hang or freeze
- If session refresh fails, console shows: "Session refresh failed" but app continues
- Page falls back to existing cached data
- User can still interact with the app

---

#### Test 5: Rapid App Switching
**Expected Behavior**: No duplicate refresh operations

1. Open the Coffee Management Suite on iPad Safari
2. Log in to your account
3. **Rapidly switch** between Safari and another app 3-4 times within 10 seconds
4. Return to Safari and leave it in foreground

**✅ Pass Criteria**:
- "Refreshing..." banner appears only ONCE
- Console shows: "Resume already in progress, skipping duplicate event" for duplicate switches
- No multiple simultaneous data fetches
- Page remains stable and responsive

---

#### Test 6: Background Tab Return (Desktop Safari)
**Expected Behavior**: Similar behavior to iPad app switching

1. Open the app in Safari (desktop)
2. Log in
3. **Open a new tab** and browse other sites for 35+ seconds
4. **Return to the Coffee Management Suite tab**

**✅ Pass Criteria**:
- Session refresh occurs
- Data refresh occurs if hidden > 30 seconds
- No hanging or freezing
- Console shows appropriate log messages

---

### Debugging

If the test fails, check the browser console for these log messages:

**Expected Console Logs (Successful Resume)**:
```
[Session] App returned to foreground after Xs
[Session] Session refreshed successfully
[Session] Dispatching app-resumed event to refresh page data (if > 30s)
[useAppResume] App resumed, executing callback (if > 30s)
[CashDeposit] Refreshing data after app resume (if on that page)
```

**Expected Console Logs (Failed Resume - Graceful)**:
```
[Session] App returned to foreground after Xs
[Session] Session refresh failed: [error message]
[Session] Retrieved existing session (fallback)
```

**Console Logs Indicating a Problem**:
```
[Session] Session refresh failed: [error]
[Session] Failed to get session: [error]
(No fallback message)
```

**Console Logs for Skipped Refresh**:
```
[Session] App returned to foreground after Xs
[Session] App was only hidden briefly, skipping refresh
```

**Console Logs for Duplicate Prevention**:
```
[Session] Resume already in progress, skipping duplicate event
```

---

### Known Limitations

1. **First app switch after login**: The first time you switch apps after logging in, the refresh might take slightly longer as caches are empty.

2. **Very slow networks**: On extremely slow or unstable networks (< 2G speeds), the 5-second timeout might trigger before the session refresh completes. This is intentional to prevent hanging; the app will fall back to the existing session.

3. **Multiple tabs**: If you have multiple tabs of the app open and switch between them, each tab will independently manage its session refresh.

---

### Rollback Instructions

If this fix causes issues, you can temporarily rollback:

```bash
git revert a4ed3f4
```

This will restore the previous behavior, but the hanging issue will return.

---

## Dashboard Analytics Widgets

**Status**: ✅ Implemented
**Completed**: 2026-02-02
**Branch**: `dashboard-widgets`

### Feature Description
Transform the dashboard from just module links into an insights hub with key metrics at a glance. Four widgets display real-time insights:
- Revenue This Month (from cash deposits)
- Upcoming Maintenance (next 7 days)
- Your Active Tasks (assigned to current user)
- Recent Coffee Orders (last 5 orders)

### What Was Added

**New Components**:
- `client/src/components/dashboard/DashboardWidget.tsx` - Reusable widget container
- `client/src/components/dashboard/RevenueWidget.tsx` - Revenue insights with trend
- `client/src/components/dashboard/UpcomingMaintenanceWidget.tsx` - Maintenance due dates
- `client/src/components/dashboard/ActiveTasksWidget.tsx` - User's active tasks
- `client/src/components/dashboard/RecentOrdersWidget.tsx` - Recent coffee orders

**Modified Files**:
- `client/src/pages/dashboard.tsx` - Added Insights section with widgets

### Testing Steps

#### Test 1: Revenue Widget Display

**Prerequisites**: Must have cash deposit module enabled and some cash activity entries

1. **Log in** to the Coffee Management Suite
2. **Navigate to Dashboard**
3. **Locate the "Insights" section** (above the module cards)
4. **Find the "Revenue This Month" widget**

**✅ Pass Criteria**:
- Widget displays with gold icon (DollarSign)
- Shows current month's total gross revenue from cash deposits
- If you have previous month data, shows trend arrow (up/down) and percentage change
- Revenue amount is formatted as currency (e.g., "$5,234")
- Trend is green (up arrow) if revenue increased, red (down arrow) if decreased

**Edge Cases to Test**:
- **No cash deposits**: Widget should still display $0
- **First month**: No trend comparison shown (only current revenue)
- **Large numbers**: Verify currency formatting (e.g., $1,234,567)

---

#### Test 2: Upcoming Maintenance Widget

**Prerequisites**: Must have equipment maintenance module enabled and equipment with maintenance tasks

1. **Navigate to Dashboard**
2. **Find the "Upcoming Maintenance" widget**

**✅ Pass Criteria**:
- Widget displays with wrench icon
- Shows up to 5 maintenance tasks due in the next 7 days
- Each task shows:
  - Equipment name
  - Task type (e.g., "Cleaning", "Inspection")
  - Due date info (e.g., "Due in 3 days", "Due today", "2 days overdue")
- Overdue tasks have red alert icon and pink background
- Upcoming tasks have orange alert icon
- "View all maintenance →" link at bottom
- If no maintenance due: Shows "No maintenance due in the next 7 days" with green checkmark

**Edge Cases to Test**:
- **Overdue maintenance**: Should appear with red styling and "X days overdue"
- **Due today**: Should say "Due today"
- **Due tomorrow**: Should say "Due tomorrow"
- **No maintenance**: Shows empty state message
- **Many tasks**: Only shows first 5, link to view all

---

#### Test 3: Active Tasks Widget

**Prerequisites**: Must have admin tasks module enabled and tasks assigned to your user

1. **Navigate to Dashboard**
2. **Find the "Your Active Tasks" widget**

**✅ Pass Criteria**:
- Widget displays with ListTodo icon
- Shows up to 5 tasks in "pending" or "in_progress" status assigned to you
- Each task shows:
  - Task title
  - Priority indicator (colored circle: red=high, orange=medium, blue=low)
  - Category badge (if task has category)
  - Due date with clock icon
- Overdue tasks show due date in red
- "View all tasks →" link at bottom
- If no active tasks: Shows "No active tasks assigned to you" with circle icon

**Edge Cases to Test**:
- **High priority tasks**: Red circle indicator
- **Medium priority tasks**: Orange circle indicator
- **Low priority tasks**: Blue circle indicator
- **Overdue tasks**: Due date in red
- **No due date**: No clock icon or date shown
- **Long task titles**: Should truncate with ellipsis
- **No tasks**: Shows empty state

---

#### Test 4: Recent Orders Widget

**Prerequisites**: Must have bulk-ordering module enabled and coffee order history

1. **Navigate to Dashboard**
2. **Find the "Recent Coffee Orders" widget**

**✅ Pass Criteria**:
- Widget displays with Coffee icon
- Shows last 5 coffee orders
- Each order shows:
  - Vendor name
  - Number of items
  - How long ago (e.g., "Today", "Yesterday", "3 days ago")
  - Total amount formatted as currency
- Shows "Total this month" sum at bottom
- "View all orders →" link
- If no orders: Shows "No orders yet" with Package icon

**Edge Cases to Test**:
- **Today's orders**: Shows "Today"
- **Yesterday's orders**: Shows "Yesterday"
- **Recent orders**: Shows "X days ago"
- **Old orders**: Shows "Dec 15" (month/day format)
- **Large order totals**: Verify currency formatting
- **No orders**: Shows empty state

---

#### Test 5: Widget Responsiveness

**Test on different screen sizes**:

1. **Desktop (1920px wide)**:
   - All 4 widgets should display in a row (4 columns)
   - Widgets should have equal height
   - Content should not overflow

2. **Tablet (768px wide)**:
   - Widgets should display in 2 columns, 2 rows
   - Still readable and not cramped

3. **Mobile (375px wide)**:
   - Widgets should stack vertically (1 column)
   - Each widget should be full width
   - Content should remain readable

**✅ Pass Criteria**:
- Widgets resize gracefully
- No horizontal scrolling
- Text doesn't overlap
- Icons and spacing look good at all sizes

---

#### Test 6: Widget Loading States

1. **Clear browser cache** or use **Network throttling (Slow 3G)**
2. **Navigate to Dashboard**
3. **Watch widgets load**

**✅ Pass Criteria**:
- While loading, each widget shows skeleton/pulse animation
- Skeleton matches general layout of widget content
- After loading, smooth transition to actual content
- No flickering or layout shifts

---

#### Test 7: Widget Error States

**Test 1: Network Error**:
1. **Disconnect internet** (or block requests in DevTools)
2. **Reload Dashboard**
3. **Check widgets**

**✅ Pass Criteria**:
- Widgets show error message: "Failed to load [widget type] data"
- Error message is user-friendly
- Other widgets that loaded successfully still show data
- No console errors that crash the app

**Test 2: No Data Permissions**:
1. **Log in as employee** (if you're owner/manager)
2. **Navigate to Dashboard**

**✅ Pass Criteria**:
- Only widgets for modules you have access to are shown
- Other widgets are hidden (not shown with error)

---

#### Test 8: Widget Data Accuracy

**Revenue Widget**:
1. **Go to Cash Deposit page**
2. **Note the total gross revenue for current month**
3. **Go back to Dashboard**
4. **Verify Revenue Widget shows same total**

**Upcoming Maintenance Widget**:
1. **Go to Equipment Maintenance page**
2. **Note tasks due in next 7 days**
3. **Go back to Dashboard**
4. **Verify widget shows same tasks**

**Active Tasks Widget**:
1. **Go to Admin Tasks page**
2. **Filter to show tasks assigned to you**
3. **Count pending + in_progress tasks**
4. **Go back to Dashboard**
5. **Verify widget shows same tasks**

**Recent Orders Widget**:
1. **Go to Coffee Orders page**
2. **Note last 5 orders**
3. **Go back to Dashboard**
4. **Verify widget shows same orders**

**✅ Pass Criteria**:
- All widget data matches source data
- Calculations are correct (revenue totals, etc.)
- No stale/cached data shown

---

#### Test 9: Widget Links

Test each "View all →" link:

1. **Revenue Widget**: (No link - just displays data)
2. **Maintenance Widget**: Click "View all maintenance →"
   - Should navigate to `/equipment-maintenance`
3. **Tasks Widget**: Click "View all tasks →"
   - Should navigate to `/admin-tasks`
4. **Orders Widget**: Click "View all orders →"
   - Should navigate to `/coffee-order`

**✅ Pass Criteria**:
- Links work correctly
- Navigation is instant (no delays)
- Correct page loads

---

#### Test 10: Module Access Control

**Test with different user roles**:

1. **Owner**: Should see all 4 widgets (if all modules enabled)
2. **Manager**: Should see widgets for modules they have access to
3. **Lead**: Should see subset based on permissions
4. **Employee**: Should only see equipment maintenance widget (typically)

**✅ Pass Criteria**:
- Only widgets for accessible modules are shown
- No errors for hidden widgets
- Empty state doesn't show if no widgets available

---

### Known Limitations

1. **Real-time Updates**: Widgets refresh when dashboard loads, not in real-time
   - **Workaround**: Refresh page or navigate away and back

2. **Widget Cache**: Data is cached for 1 minute
   - If you add a new order and immediately check dashboard, it might not show for up to 60 seconds
   - **Workaround**: This is by design for performance

3. **Mobile Widget Order**: On mobile, widgets stack in this order: Revenue, Maintenance, Tasks, Orders
   - Cannot be reordered currently

---

### Troubleshooting

**Widgets not showing**:
- Verify you have the corresponding modules enabled
- Check browser console for errors
- Verify you have data in the database tables

**Wrong data displayed**:
- Clear browser cache
- Check that you're looking at the correct tenant/location
- Verify database permissions in Supabase

**Widgets loading forever**:
- Check network tab for failed requests
- Verify Supabase connection
- Check if you're hitting rate limits

---

### Testing Checklist

- [ ] Revenue Widget displays correct data
- [ ] Revenue Widget shows trend comparison
- [ ] Maintenance Widget shows upcoming tasks
- [ ] Maintenance Widget highlights overdue tasks
- [ ] Tasks Widget shows user's active tasks
- [ ] Tasks Widget shows priority indicators
- [ ] Orders Widget shows recent orders
- [ ] Orders Widget shows monthly total
- [ ] All widgets responsive on mobile
- [ ] Loading states work correctly
- [ ] Error states display properly
- [ ] Links navigate to correct pages
- [ ] Module access control works
- [ ] Data accuracy verified
- [ ] Empty states display correctly

---

## Future Feature Testing

Testing procedures for new features will be added to this document as they are implemented.

---

## General Testing Guidelines

### Before Testing Any Feature

1. **Clear browser cache** if testing data-related features
2. **Check console** for errors (F12 > Console)
3. **Test on target devices**:
   - Desktop Safari (macOS)
   - iPad Safari (iPadOS)
   - Mobile Safari (iOS)
   - Chrome (desktop)
4. **Test with different user roles**: owner, manager, lead, employee
5. **Test with different network conditions**: fast WiFi, slow 3G, airplane mode toggle

### During Testing

1. **Document unexpected behavior** even if it doesn't break functionality
2. **Check console logs** for warnings or errors
3. **Note performance** - does the page feel responsive?
4. **Test edge cases** - empty data, large datasets, special characters

### After Testing

1. **Report bugs** with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Console errors (if any)
   - Browser/device details
   - User role being tested

---

## Bug Reporting Template

When reporting bugs found during testing, use this format:

```markdown
## Bug: [Short Description]

**Severity**: Critical / High / Medium / Low
**Feature**: [Name of feature being tested]
**User Role**: Owner / Manager / Lead / Employee
**Device**: iPad Pro 2021 / iPhone 13 / MacBook Pro M1 / etc.
**Browser**: Safari 17.2 / Chrome 120 / etc.

### Steps to Reproduce
1. Step one
2. Step two
3. Step three

### Expected Behavior
What should happen...

### Actual Behavior
What actually happens...

### Console Errors
```
(paste console errors here)
```

### Screenshots
(attach if relevant)

### Workaround
(if you found one)
```

---

**Last Updated**: 2026-02-02
