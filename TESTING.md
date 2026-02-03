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

**Status**: Not Yet Implemented
**Planned**: 2026-02-02

### Feature Description
Transform the dashboard from just module links into an insights hub with key metrics at a glance.

### Testing Steps (To Be Updated After Implementation)

#### Test 1: Revenue Widget Display
(Testing steps will be added once implemented)

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
