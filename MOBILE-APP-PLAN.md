# Coffee Management Suite — Companion Mobile App Plan

**Date:** February 19, 2026
**Project:** Employee-facing mobile app for iOS (iPhone/iPad) and Android
**Relationship:** Companion to the existing web-based Coffee Management Suite

---

## What This Document Covers

1. What the mobile app is and what it does
2. How it connects to what you already have
3. The build broken into phases (what gets built and in what order)
4. Budget and ongoing costs
5. How Claude Code can help you build it
6. A glossary of technical terms used in this document

---

## Part 1: The Big Picture

### What you already have

Your Coffee Management Suite is a website that runs in a web browser. It handles
everything: recipes, pricing, tips, scheduling, equipment, tasks, cash deposits,
ordering, and reporting. It is your **admin headquarters**.

All of your data (employees, schedules, recipes, etc.) lives in a database hosted
by a service called **Supabase**. Your website talks to that database to read and
write information. Security rules on the database make sure each coffee shop can
only see its own data.

### What the mobile app will be

A separate app that employees download from the App Store (iPhone) or Google Play
Store (Android). It connects to the **exact same database** your website already
uses. No data gets duplicated. When a manager creates a schedule on the website,
employees see it instantly in the app.

Think of it like this:

```
  Website (for managers/owners)          Mobile App (for employees)
  ================================       ============================
  Recipe costing                         Clock in / Clock out
  Pricing matrices                       View my schedule
  Bulk ordering                          Accept or decline shifts
  Full scheduling calendar               Request time off
  Reporting & analytics                  View my tip payouts
  Equipment management                   Complete assigned tasks
  Cash deposit tracking                  Log equipment maintenance
  Employee management                    Read & acknowledge documents
  Tip calculations                       Receive push notifications
```

Both apps talk to the same database. Nothing changes about your website — it
keeps working exactly as it does today.

---

## Part 2: How It Connects to What You Already Have

This is the good news. The expensive, time-consuming parts of building an app
are usually:

- Setting up user accounts and login (you already have this)
- Building the database and security rules (you already have this)
- Writing the business logic — how tips are calculated, how shifts work, etc. (you already have this)
- Setting up payment processing, email, file storage (you already have this)

**What you are actually building is a new screen — a simpler, phone-sized window
into the system you already own.** The plumbing is done. You are adding a faucet.

### What stays the same (no changes needed)

- Your Supabase database and all its security rules
- Your server that handles Stripe payments, emails, and file uploads
- Your website — it keeps running untouched
- All employee accounts and passwords — they log into the app with the same
  email and password they would use on the website

### What is new

- A separate codebase (project folder) for the mobile app
- The visual screens of the app (buttons, lists, forms — what people see and tap)
- Push notifications (sending alerts to employees' phones)
- App Store and Google Play Store listings

---

## Part 3: The Build — Phased Approach

### Phase 1: Foundation + Clock In/Out (Weeks 1-4)

**What gets built:**

- Project setup — creating the mobile app project, connecting it to your
  existing Supabase database
- Login screen — employees enter their email and password (same credentials
  as the website)
- Home screen — a big clock-in button (your website already has a version of
  this), a display showing hours worked today, and a card showing the next
  upcoming shift
- Clock in, take breaks, clock out — all writing to the same database tables
  your website reads from
- Basic navigation — a tab bar at the bottom of the screen to move between
  sections (Home, Schedule, More)

**Why this is first:** Clock in/out is the single most-used employee action, and
your database already tracks all of this. This phase proves the app works end-to-end.

**What you can test:** An employee clocks in on the app → a manager sees it on
the website immediately.

---

### Phase 2: Schedule + Time Off (Weeks 5-7)

**What gets built:**

- My Schedule screen — a simple list showing the employee's shifts for the
  current and upcoming weeks (day, start time, end time, position)
- Accept/Decline shifts — when a manager publishes a new shift, the employee
  can accept or decline it with a reason
- Time-off request form — employee picks dates, selects a category (sick,
  vacation, personal), writes a reason, and submits
- My time-off requests list — see the status of past and pending requests
  (pending, approved, denied)
- Hours summary — a view of total hours worked per week/pay period

**Why this is second:** After clocking in, viewing your schedule is the next most
common employee need. All of this data already exists in your database.

---

### Phase 3: Tasks + Equipment (Weeks 8-10)

**What gets built:**

- My Tasks screen — a list of tasks assigned to the employee by a manager,
  showing title, due date, priority, and status
- Complete a task — tap a task, mark it done, optionally take a photo as proof
  of completion (using the phone's camera)
- Equipment maintenance — view equipment that needs attention, log that
  maintenance was completed, take photos of issues
- Document library — browse documents the shop has posted (training manuals,
  policies, etc.), and tap to acknowledge that you have read required documents

**Why this is third:** These features add real value but are used less frequently
than clock-in and scheduling. The photo capture feature requires working with the
phone's camera, which adds some complexity.

---

### Phase 4: Push Notifications (Weeks 11-12)

**What gets built:**

- Notification system — the infrastructure to send alerts to employees' phones
- Shift reminders — "You're scheduled tomorrow at 7:00 AM"
- New task alerts — "You've been assigned a new task: Clean espresso machine"
- Time-off responses — "Your time-off request for March 5-7 was approved"
- Schedule changes — "Your shift on Friday was updated"
- Announcement broadcasts — managers can send a message to all employees

**Why this is last:** Notifications require the most new infrastructure (they need
a service that sends messages to Apple's and Google's notification systems). The
app needs to be functional first before adding alerts on top.

---

### Phase 5: Polish + Store Submission (Weeks 13-14)

**What gets done:**

- Testing on real iPhones and Android phones
- Fixing visual issues on different screen sizes
- Writing App Store and Google Play Store descriptions
- Creating screenshots for store listings
- Submitting to both stores for review
- Responding to any feedback from Apple/Google reviewers

---

## Part 4: Budget

### One-Time Costs

| Item | Cost | Notes |
|------|------|-------|
| Apple Developer Account | $99/year | Required to publish to the App Store. Must be renewed annually. |
| Google Play Developer Account | $25 (one-time) | Pay once, publish forever. |
| App icon and store graphics | $0 - $200 | You can make these yourself with free tools, or hire someone on Fiverr. |
| **Total one-time** | **~$125 - $325** | |

### Ongoing Costs (Monthly)

| Item | Cost | Notes |
|------|------|-------|
| Your existing Supabase plan | No change | The mobile app uses the same database — no added cost unless you massively increase usage. |
| Your existing server hosting | No change | Same server handles both web and mobile. |
| Push notification service | $0 - $25/month | Expo (the tool used to build the app) includes free push notifications for small-to-medium usage. May cost at high volume. |
| Apple Developer Account renewal | $99/year (~$8/month) | Annual renewal. |
| **Total ongoing** | **~$8 - $33/month** | Beyond what you already pay. |

### If You Hire Help

If you decide to hire a developer instead of (or in addition to) building with
Claude Code:

| Option | Estimated Cost | Notes |
|--------|---------------|-------|
| Freelancer (Upwork/Fiverr) | $3,000 - $10,000 | Wide range depending on experience and location. Get someone with Expo/React Native experience specifically. |
| Development agency | $15,000 - $40,000 | Higher quality and reliability, but much more expensive. |
| Claude Code (you build it yourself) | $0 beyond subscription | You do the work with Claude as your guide. Requires time and patience, but no contractor cost. |

### Budget Tips

1. **Do not pay for a custom backend.** If a freelancer tells you that you need a
   new server or database, push back — your Supabase setup already does everything
   the mobile app needs.

2. **Use Expo's free tier for everything initially.** Expo provides free builds
   (compiling the app), free push notifications, and free over-the-air updates.
   You only pay if you exceed generous usage limits.

3. **Apple's review process can take 1-7 days.** Budget time, not money, for this.
   Your first submission may get rejected with feedback — that is normal and free
   to resubmit.

4. **Start with one platform if budget is tight.** If most of your employees use
   iPhones, start with iOS only. The code is the same either way — you are just
   delaying the Android launch, not doing extra work.

---

## Part 5: How Claude Code Can Help You Build This

### The honest answer

Claude Code (the tool you are using right now) can help you **significantly** with
this build. Here is what that looks like in practice:

### What Claude Code can do for you

| Task | How well Claude handles it |
|------|---------------------------|
| Create the project and install dependencies | Fully — Claude can run the setup commands and configure everything |
| Write all the app screens and logic | Fully — Claude can write React Native code, create screens, wire up navigation |
| Connect to your existing Supabase database | Fully — Claude knows your database structure and can reuse your existing queries |
| Copy and adapt your existing data logic | Fully — the hooks and queries from your web app can be brought over with modifications |
| Set up push notifications | Fully — Claude can write the Expo notification code |
| Debug problems when things break | Very well — Claude can read error messages, find issues, and fix them |
| Build the app for testing on your phone | Mostly — Claude can run Expo build commands, though you may need to scan a QR code on your phone |
| Submit to the App Store / Play Store | Partially — Claude can prepare the build, but you will need to click through the Apple/Google submission forms yourself |
| Design visual layouts (making it look good) | Moderately — Claude can build clean, functional screens, but if you want a custom brand-specific design, you may want a designer's input |

### What Claude Code cannot do

- **Tap buttons on your phone.** You will need to physically test the app on your
  phone or tablet and tell Claude what you see.
- **Log into your Apple/Google developer accounts.** You will need to create these
  accounts and handle the submission process (Claude can guide you step-by-step).
- **Make subjective design choices.** Claude can give you options, but "does this
  look good?" is a judgment call you will need to make.
- **See your phone screen.** When testing, you will need to describe what you see
  or take screenshots so Claude can help fix issues.

### Do you need a new repo?

**Yes — the mobile app should be its own separate project (repository).** Here is why:

- Your web app uses tools (Vite, Tailwind CSS, shadcn) that do not work in
  mobile apps
- The mobile app uses its own tools (Expo, React Native) that are not needed
  by your website
- Keeping them separate means changes to one cannot accidentally break the other
- They share the database, not the code — like two different buildings connected
  by the same plumbing

### Do you need a new Claude session?

You can use Claude Code for the mobile app the same way you use it now. When you
start working on the mobile app:

1. Open the mobile app project folder (the new repo)
2. Start a Claude Code session in that folder
3. Claude will learn the new project just like it learned this one
4. You can tell Claude about decisions from this plan and it will follow them

Your existing web app sessions stay separate and unaffected.

### Realistic expectations

Building this with Claude Code is like having a very skilled developer sitting
next to you who types fast but needs you to make decisions and test things. The
more clearly you describe what you want ("I want a screen that shows a list of
my shifts for this week, with the date on the left and the time on the right"),
the better the result.

You do not need to know what "UI" means or how to code. You need to be able to:
- Describe what you want in plain English
- Test the app on your phone and tell Claude what you see
- Make decisions when Claude gives you options
- Be patient when things need fixing (they always do)

**You built this entire web platform with Claude. You can build the mobile app
the same way.**

---

## Part 6: Glossary

| Term | Plain English |
|------|--------------|
| **API** | A way for two programs to talk to each other. Your app sends a request ("give me this employee's schedule") and gets back a response (the schedule data). |
| **App Store / Play Store** | Where people download apps. App Store is Apple (iPhone/iPad), Play Store is Google (Android). |
| **Backend / Server** | The behind-the-scenes computer that handles things like sending emails, processing payments, and complex calculations. Your website and mobile app both talk to the same one. |
| **Codebase / Repo (Repository)** | The folder containing all the files that make up a program. Think of it like a binder with all the blueprints for a building. |
| **Database** | Where all your data is stored — employees, schedules, recipes, etc. Think of it as a giant spreadsheet with many tabs. |
| **Expo** | A free toolkit for building mobile apps. It handles the complicated parts of making an app work on both iPhones and Android phones. |
| **Frontend** | What people see and interact with — the screens, buttons, and forms. |
| **Push Notification** | An alert that pops up on your phone even when the app is closed, like a text message from the app. |
| **React Native** | The programming language/framework used to build the mobile app. It lets you write one version of the app that works on both iPhone and Android. |
| **RLS (Row-Level Security)** | A rule on the database that says "Shop A can only see Shop A's data." It is already set up in your system. |
| **Supabase** | The service that hosts your database, handles user logins, and stores files. It is already running — the mobile app just connects to it. |
| **UI (User Interface)** | What you see on screen — the buttons, text, colors, and layout. When someone says "build the UI," they mean "make the screens that people look at and interact with." |

---

## Summary: At a Glance

| Question | Answer |
|----------|--------|
| What is it? | A phone app for employees to clock in, view schedules, complete tasks, and get notifications |
| Does it replace the website? | No — the website stays as the admin tool for owners and managers |
| Does it need a new database? | No — it connects to your existing one |
| How long to build? | ~14 weeks (3.5 months) across 5 phases |
| How much does it cost? | ~$125 to start + ~$8-33/month ongoing (if you build it yourself with Claude) |
| Can Claude Code build it? | Yes — Claude writes the code, you test and make decisions |
| Do I need to know how to code? | No — but you need to describe what you want clearly and test on your phone |
| Separate project or same one? | Separate project (new repo), same database |
| iPhone and Android? | Both, from the same codebase |

---

*This document was generated on February 19, 2026 as a planning reference for the
Coffee Management Suite companion mobile app.*
