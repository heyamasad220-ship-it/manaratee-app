# FEATURES.md

# Feature Documentation

This document contains implementation notes and feature history for major Manaratee modules.

---

# Authentication

## Login Page

Status: Complete

### Improvements

* Increased logo size
* Removed footer links
* Improved mobile branding
* Kept responsive layout

### OAuth

Implemented:

* Google OAuth

Planned:

* Apple OAuth

### OAuth Flow

Uses:

* Supabase Authentication
* OAuth callback route
* Google Cloud OAuth credentials

### Password reset

* Route: `/forgot-password` — request reset email
* Route: `/auth/set-password` — set new password after email link
* Route: `/auth/confirm` — server-side `token_hash` exchange for recovery (see `docs/Known_Issues.md` for Supabase email template)

---

# Roles, Permissions & Access Control

Status: Complete

## Architecture

Platform Owner:

* owner role reserved for platform owner

Organization Roles:

* organization_roles
* custom role names
* organization-specific permissions

Organization Members:

* organization_members.role
* organization_members.role_id

Permissions:

* role_permissions

---

## Features

Completed:

* Users page rebuilt
* Roles & Permissions page rebuilt
* Permission matrix
* Server-side protection
* Unauthorized page
* Permission-aware sidebar
* Subscription-aware modules
* **Org subscription view (June 2026):** `/settings/subscription` — read-only plan bundle price, persona bundle, and enabled modules (`lib/organizations/organization-subscription-summary.ts`). Requires `settings.users.view` (owners always). Plan changes remain platform-admin managed.

---

## Current Issue

User Invitations

File:

app/api/organizations/invite-user/route.ts

Status:

Working — requires Supabase email + redirect URL configuration (see `docs/Known_Issues.md`)

---

# Customer Portal

Status: Partial

## Module-aware navigation (June 2026)

Customer sidebar and dashboard only show areas enabled for the active organization (`organization_modules`), matching the staff sidebar.

| Customer area | Required module slug |
|---------------|----------------------|
| Venue Rentals / Book a Space | `bookings` |
| Donations | `donations` |
| Programs | `programs` |
| My Bazaars | `vendor-hub` |
| Opportunities | `membership` |
| Dashboard / Profile | always visible |

Key files: `lib/customer/customer-portal-modules.ts` (client-safe), `lib/customer/customer-portal-modules-server.ts` (server loaders/guards), `components/customer/customer-nav.tsx`, `app/(customer)/layout.tsx`. Disabled module routes redirect to `/customer/dashboard`.

For a donations-only org (e.g. MAS Dallas on the **Nonprofit** bundle), ensure only `donations` is enabled in platform admin → organization modules (or assign bundle `nonprofit`).

## Customer Venue Rentals (pilot — Phase 1 UX)

Status: Pilot preparation (June 2026)

Routes: `/customer/rentals`, `/customer/rentals/new`, `/customer/rentals/[id]`

**Phase 1 Deliverable #3 (payment UX honesty):** Customer payment and contract-signing flows clearly state that **staff will email payment instructions** and handle agreement follow-up. Disabled “Pay deposit” / “Sign agreement” buttons removed; informational callouts replace them. Payment architecture unchanged — `rental_payments` ledger and future Stripe checkout (Phase 6) remain the target path.

**Phase 1 Deliverable #1 (cancel rental staff UI):** Staff can cancel active rentals from `/bookings/rentals/[id]` via `cancelVenueRental`. Eligible statuses: awaiting approval, awaiting payment, partial payment, confirmed. Blocked during refund workflow and terminal states. Releases `rental_reservations` (calendar sync), appends cancellation to rental notes, writes `reservation_override_logs`. After-payment cancellations require confirmation when payments are recorded.

**Phase 1 Deliverable #2 (hold expiry automation):** Unpaid holds expire automatically via scheduled cron. Targets only `approved_pending_payment`, `deposit_paid`, and `security_deposit_paid` when `hold_expires_at` has elapsed. Sets rental → `hold_expired`, `rental_reservations` → `expired` (calendar release via existing sync). Multi-tenant safe: service-role job processes all organizations with org-scoped updates; staff `expireVenueRentalHolds` remains for single-org manual runs. Cron: `GET|POST /api/cron/venue-rental-hold-expiry` (Bearer `CRON_SECRET`; dev open when unset). Vercel schedule: hourly (`0 * * * *`). No schema changes.

**Live-safe validation:** `node scripts/validate-venue-rental-hold-expiry.mjs` — read-only dry-run (SELECT only; no cron invocation). Requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Production also requires `CRON_SECRET`. Report: `scripts/reports/venue-rental-hold-expiry-validation.json`.

**Phase 1 Deliverable #4 (force-book override UI):** Authorized staff (`BOOKINGS_MANAGE` or `PROGRAMS_MANAGE` + finance visibility) can force-book pre-confirmation rentals from `/bookings/rentals/[id]` via `forceBookVenueRentalWithOverride`. Exception-only UI with amber warning card, required override reason, confirmation dialog, conflict visibility, and outstanding-payment acknowledgement. Sets rental → `confirmed` without marking payments paid; writes `reservation_override_logs` (`action: force_book`) with previous/next status and override metadata. Blocked for confirmed, terminal, and refund workflow states.

Key files:

* `lib/bookings/customer-rental-process-guidance.ts` — customer-facing copy for staff-mediated payment and contract review
* `components/customer/rentals/customer-rental-process-guidance-callout.tsx` — shared callout UI
* `components/customer/rentals/customer-rental-next-action-panel.tsx`, `customer-rental-payments-section.tsx`, `customer-rental-documents-section.tsx`
* `components/bookings/venue-rental-detail-client.tsx` — staff cancel + force-book UI
* `lib/bookings/venue-rental-status.ts` — `canStaffCancelVenueRental`, `canStaffForceBookVenueRental`, `summarizeOutstandingRentalPayments`
* `lib/bookings/venue-rental-hold-expiry.ts` — `expireVenueRentalHoldsForScope`, `runVenueRentalHoldExpiryJob`
* `app/api/cron/venue-rental-hold-expiry/route.ts` — cron entry point
* `vercel.json` — hourly hold-expiry schedule

Tests: `lib/bookings/customer-rental-process-guidance.test.ts`, `lib/bookings/customer-venue-rental-experience.test.ts`, `lib/bookings/venue-rental-cancel.test.ts`, `lib/bookings/venue-rental-force-book.test.ts`, `lib/bookings/venue-rental-hold-expiry.test.ts` (included in `npm run test:conflicts`).

**Phase 1 Deliverable #5 (pilot readiness validation):** Read-only harness `node scripts/validate-venue-rental-pilot-readiness.mjs` checks deliverables, workflow actions, env vars, unit tests, hold-expiry dry-run (`eligibleCount = 0`), and audit log readability. Full staff/customer E2E still requires manual walkthrough — no live mutations during validation. Pilot assumes **external payment collection** and **staff-mediated email** for payment instructions (no Stripe checkout for venue rentals in Phase 1).

## Pilot Data Cleanup — Vendor Hub (June 2026)

Status: **Vendor import cleanup complete** (MAS Dallas pilot org)

Removed **255** legacy imported rows from `public.vendors` (May 2026 CSV import). These were standalone directory records with no `contact_id` — not part of the contact-centric Vendor Hub model (`lib/vendor-hub/contact-centric-model.ts`).

**Preserved:** vendor catalog/config (`vendor_categories`, `vendor_hub_vendor_types`, booth attributes/types, booths, events), applications engine (`application_type_definitions` includes `vendor`), auth, profiles, contacts, memberships, permissions, module configuration.

**Backup:** `scripts/backups/vendor-cleanup/vendors-2026-06-16.json` (255 rows). Reports: `scripts/reports/vendor-cleanup-pre-2026-06-16.json`, `scripts/reports/vendor-cleanup-post-2026-06-16.json`.

**Tooling:** `node scripts/vendor-cleanup-pilot.mjs` (inventory + export); `node scripts/vendor-cleanup-pilot.mjs --execute` (FK-safe operational delete).

**Pending pilot cleanup (separate approval):** donations stress/seed data, experimental venue rental chain — see `scripts/reports/pilot-cleanup-execution-preview.json`.

**MAS Dallas `contact_import_staging` cleared (June 2026):** 4,651 staging rows deleted. Backup: `scripts/backups/contact-import-staging/contact_import_staging-mas-dallas-2026-06-16.json`. Tool: `node scripts/clear-mas-contact-import-staging.mjs --execute`.

**MAS Dallas contacts cleaned (June 2026):** Removed `DONATIONS_DEV_SEED_V1` test contacts; only pilot contact Heyam Asad retained. Removed erroneous `member` membership/role from Heyam (kept `employee` via active staff record). Tool: `node scripts/clean-mas-contacts-pilot.mjs`.

**Contacts list UI (June 2026):** Removed Teams column and team filter from `ContactsCrmList` (`/contacts`, `/contacts/people`, `/contacts/organizations`). Team assignment remains on individual contact profiles where HR teams are enabled.

**Settings → Users list fix (June 2026):** `/settings/users` now loads members via `fetchOrganizationUsersForSettings()` (service role + `settings.users.view`) instead of browser Supabase queries limited by RLS — admins see all org members (e.g. invited Super Admins), not only their own row. Key file: `lib/organizations/organization-users-actions.ts`.

**Contacts add form (June 2026):** Add Contact no longer requires affiliations at create time; donor and other tags sync from activity or can be set on the contact profile.

**Donor affiliation after first payment (June 2026):** Pledge-only or `donors` extension rows do **not** assign the Donor affiliation. The tag is added on the first linked `payments` row (staff, portal, or Stripe). Migration `scripts/114_donor_affiliation_requires_payment.sql` patches `sync_contact_affiliations` and removes incorrect auto-assigned donor roles with no payments. Key files: `lib/contacts/contact-affiliation-sync.ts`, `lib/contacts/contact-affiliation-rules.ts`.

**Contacts search fix (June 2026):** Contact list search no longer references `primary_contact_name` when that column is absent in the database — fixes production search errors after bulk import.

**Contact profile module gating (June 2026):** Contact detail tabs and panels respect org-enabled modules from `/api/organizations/sidebar-modules` — e.g. MAS Dallas (donations-only) hides Workforce, venue rentals, programs/membership participation, and applications sections. Key files: `lib/contacts/contact-profile-module-access.ts`, `components/contacts/contact-profile-client.tsx`.

**Configurable automatic affiliations (June 2026):** Contacts → Settings → **Affiliations** lets each org turn activity-based affiliations on/off. Defaults follow subscribed modules (e.g. venue-only orgs have Donor off when Donations is not enabled). Stored in `organization_affiliation_settings`; enforced by `sync_contact_affiliations` (migration `115`). Manual affiliations on contact profiles are unchanged. Files: `lib/contacts/contact-affiliation-settings.ts`, `components/contacts/affiliation-rules-panel.tsx`, `scripts/115_organization_affiliation_settings.sql`.

**Contacts profile edit (June 2026):** Contacts list **View & edit profile** (and row click) opens `/contacts/[id]?edit=1` with the Contact information form in edit mode. Profile header includes **Edit contact**; record type and primary contact are editable on save. Files: `components/contacts/contact-profile-client.tsx`, `components/contacts/contact-basics-panel.tsx`, `lib/contacts/contact-profile-path.ts`.

**Donation contact picker (June 2026):** Add Pledge and Record Payment search **org contacts** (name, email, phone), not only existing `donors` rows. On save, `ensureDonorExtensionForContact` creates the donor extension when needed. Add Pledge shows an **Add contact** button when search returns no matches; quick-add dialog supports **Person / Organization**, primary contact name for organizations, and auto-suggests Organization when the name looks like a company (LLC, Inc, etc.). Donor affiliation syncs on **first payment**, not pledge creation. Key files: `lib/donations/donation-list-actions.ts`, `components/contacts/quick-add-contact-dialog.tsx`.

**Payment import & match (June 2026 — unified flow):** `/donations/import` replaces the old staging + reconcile split. Upload CSV → payments are created immediately in the match queue (`pending_review`) in **100-row server chunks**. **Auto-match after import** is on by default: high-confidence contact matches (≥85%, email/phone/exact name) link automatically; remainder stays in Match Queue for manual review. **Auto-allocate to best pledge** (default on with auto-match) uses `lib/donations/payment-pledge-allocation.ts`: prefers **lump-sum** (`one_time`) open pledges over **installment** schedules (`monthly`, `quarterly`, `yearly`); skips installment pledges when donor has an active `recurring_donation_plans` row and a lump-sum pledge exists; leaves payment **unallocated** when two pledges tie on top balance. Bulk auto-match and **Quick Apply** share the same picker. Migrations `116`–`118`. Key files: `components/donations/payment-import-match-workspace.tsx`, `lib/donations/payment-import-match-actions.ts`, `lib/donations/payment-contact-matching.ts`, `lib/donations/payment-pledge-allocation.ts`.

**Payment reconcile matching (June 2026):** Superseded by unified Import & Match flow above. Legacy reconcile page redirects to `/donations/import?tab=match`.

**Campaign progress gauge (June 2026):** Speedometer-style fundraising gauge on `/donations/campaigns` (card grid for campaigns with goals) and campaign detail **Goal Progress**. Red/orange/green arc, needle, and total raised; supports exceeding 100% of goal. Component: `components/donations/campaign-progress-gauge.tsx`.

**Donations payment methods add (June 2026):** Donations Settings → Payment Methods now supports **Add Payment Method** (custom name, processing fee label, enabled toggle) in addition to edit/delete/toggle. File: `app/(dashboard)/donations/settings/page.tsx`.

**MAS campaign ledger import (June 2026):** Historical pledge/payment spreadsheet import via `node scripts/import-mas-campaign-ledger.mjs --file <csv> [--campaign <name>] [--execute] [--create-campaigns]`. Dry-run by default. Maps Pledge → `pledges`, Cash/Checks/One-time/Recurring → `payments`, normalizes names for contact matching. Tag: `MAS_CAMPAIGN_LEDGER_V1`.

**Donations pilot blockers (June 2026):** Migrations `119`–`120` — voided payments excluded from `pledge_status_view` balances and headline totals; cancelled pledges emit `calculated_status = cancelled` (excluded from Collect/allocation); portal pledge pay saves `status = allocated`. Validation: `lib/donations/pilot-blocker-validation.test.ts`. Apply: `119_donations_pilot_blocker_views.sql`, `120_donations_pilot_blocker_totals.sql`.

**Donations sidebar (June 2026):** Under Donations: **Overview**, **Donors**, **Records** (Payments, Pledges, Recurring, Campaigns tabs), **Donation Manager** (Collect, Import & Match tabs), **Reports**, **Settings**. Donation Manager routes: `/donations/collect`, `/donations/import`; `/donations/reconcile` redirects to match queue. Files: `components/layout/sidebar.tsx`, `components/donations/donation-payments-nav.tsx`, `components/donations/donation-manager-nav.tsx`, `app/(dashboard)/donations/(donation-manager)/layout.tsx`.

**Pledges summary cards (June 2026):** Pledges page stat cards match Donations Overview styling (colored left border, rounded icon badges). File: `app/(dashboard)/donations/(operations)/pledges/page.tsx`.

**Donation attribution fields (June 2026):** Add Pledge / Record Payment forms pick **Fund** first (enabled); **Category** auto-fills from the fund and is read-only when funds exist in settings. File: `components/donations/donation-attribution-fields.tsx`.

**The Asad Realty org removed (June 2026):** Deleted dev/stress org `95c4eb7d-b151-4aa1-a489-a3c1e1289c7e` and org-scoped data (~7.5k payments, 1k donors, campaigns, contacts, etc.). **MAS Dallas pilot org preserved.** Backup: `scripts/backups/organization-delete/organization-delete-95c4eb7d-...json`. Tools: `node scripts/delete-organization.mjs` (dry run / `--execute --confirm-name=...`), `node scripts/cleanup-organization-orphans.mjs` for leftover rows. Auth users with **only** Asad membership were removed; `heyamasad220@gmail.com` kept (MAS membership).

**MAS Dallas program registrations cleared (June 2026):** Removed 4 experimental enrollments (Youth Seasonal Camps), 3 charges, 9 charge lines, and related status/lifecycle rows. Preserved programs catalog (2 programs), sessions, offerings, and registration options. Reset program `enrolled`/`waitlist` counters. Backup: `scripts/backups/program-registrations/`. Report: `scripts/reports/mas-program-registrations-cleanup-2026-06-16.json`. Tool: `node scripts/clean-mas-program-registrations.mjs --execute`.

**MAS Dallas donations seed config cleared (June 2026):** Removed `DONATIONS_DEV_SEED_V1` categories, subcategories, payment methods, campaign, seed contacts/donors, pledges, payments, and **orphaned `donation_receipts`** (2 rows left after ledger delete). Reports overview/collection/receipts should read $0 / 0 pledges after tab refresh. Tool: `node scripts/clean-mas-donations-seed.mjs --execute`. Reports tabs refetch on tab switch (`app/(dashboard)/donations/reports/page.tsx`) so Receipts/Collection no longer show stale seed totals.

## Organization Switching

Completed

Uses:

active_organization_id

Components:

* organization-switcher.tsx
* customer-nav.tsx
* switch-organization.ts

---

# Customer Programs

Status: Partial

Routes:

* /customer/programs
* /customer/programs/[id]
* /customer/programs/[id]/register

### Features

* Organization filtering
* Active program filtering
* Program cards
* Enrollment badges
* Loading states
* Empty states

### Current Issue

Customer membership lookup.

Possible causes:

* user_id mismatch
* NULL organization_members.user_id
* membership linked only by email

---

# Programs Module

Status: Active Development

## Dashboard access (June 2026)

Staff routes under `/programs/*` require the **Programs** product module to be enabled for the selected organization (`organization_modules.enabled = true`, module catalog `is_active`). Disabled modules redirect to `/dashboard` even when the user role still has `programs.view` / `programs.manage`. Layout: `app/(dashboard)/programs/layout.tsx`; helper: `lib/modules/dashboard-module-access-server.ts`.

## Staff setup UI (June 2026)

**Doc:** [programs-staff-setup-ui.md](./programs-staff-setup-ui.md)

Completed:

* **Quick Create** (`/programs/create`) — basics only; redirects to edit after save
* **Edit Program** (`/programs/[id]/edit`) — tabbed full setup (Basics, Enrollment, Registration, Pricing, Sessions, Financial Assistance)
* Shared section components in `components/programs/edit/`
* `saveEditProgram` wrapper for edit save (returns errors instead of throwing)
* Legacy Billing / Program Fees cards removed from edit form; fee plans are SSOT on Pricing tab
* Capacity group gender/grade rules (Male/Female parallel pools)

Quick Create collects: name, type, department, description, dates, eligibility, capacity, visibility, draft/active.

Edit Program completes: registration options, fee plans, sessions, waitlist, financial assistance.

---

## Programs

Completed:

* Program CRUD
* Departments
* Eligibility fields (min/max age, grade levels, gender)
* Registration types (Edit Program → Registration tab)
* Visibility on create + edit

---

## Program Sessions

Table:

program_sessions

Supported:

* Capacity
* Enrollment counts
* Pricing
* Registration windows

Decision:

Use program_sessions.

Do not use schedule_sessions.

---

## Lunch Options

Table:

program_lunch_options

Status:

Working

Current records:

* No Lunch
* Basic Lunch
* Hot Lunch

---

## Registration Types

Supported:

* Full Program Registration
* Session-Based Registration

Field:

session_registration_enabled

---

# Registrations

Status: Partial

## Tables

* program_enrollments
* program_waitlist
* registration_carts
* registration_orders

---

## Admin Registration Management

Routes:

* /programs/registrations
* /programs/registrations/enrollment/[id]
* /programs/registrations/waitlist/[id]

Features:

* Search
* Filters
* Stats
* Status changes
* Waitlist conversion

---

## Registration Fixes

Completed:

* Status constraint fix
* Lunch option loading fix

---

## Planned Improvements

* Enrollment-session linking
* Session capacity tracking
* Session-based registration workflow

---

# Financial Assistance

Status: Database Complete

## Program Settings

Added to programs:

* financial_assistance_enabled
* financial_assistance_open
* financial_assistance_close_date
* financial_assistance_instructions

---

## Tables

* program_financial_assistance
* program_financial_assistance_documents
* program_financial_assistance_status_history

---

## Customer Workflow

Planned Route:

/customer/programs/[id]/financial-assistance

Features:

* Application submission
* Document upload
* Status tracking

---

## Admin Workflow

Planned Routes:

* /programs/financial-assistance
* /programs/financial-assistance/[id]

Features:

* Review queue
* Approval workflow
* Status history

---

# Development Preferences

Always:

* Provide full files
* Provide exact SQL
* Provide permanent solutions
* Provide beginner-friendly instructions
* Inspect schema before creating tables
* Update `docs/` when making meaningful changes (see `docs/AI_INSTRUCTIONS.md`)

Avoid:

* Abstract explanations
* Mock data
* Duplicate systems
* Large rewrites

---

# People Management

Status: Active Development

Display label: **People Management** (module slug `hr`, routes `/hr/*`).

Migration: `scripts/013_rename_hr_module.sql` updates `modules.name` in the database.

---

## Module Rename

Completed:

* User-facing label changed from HR to People Management
* Sidebar uses `PEOPLE_MANAGEMENT_MODULE_LABEL` from `lib/hr/hr-module-label.ts`
* Page headers and copy updated across HR routes

Technical note: URL paths remain `/hr/*`; only display names changed.

---

## Employees Module Simplification

Completed:

* Tabs reduced to: Overview, Employees, Departments, Positions
* Removed: Time Off, Work Schedule, Notifications, Teams, Applications (as employee sub-tabs)
* Removed QuickBooks payroll/scheduling note from copy
* Employment applications linked from Employees header via `ModuleApplicationsLink`

Redirects:

* `/hr/time-off` → `/hr/employees?tab=overview`
* Old settings tab URLs for departments/positions → `/hr/employees?tab=...`

---

## Child Care

Status: Complete (data wiring)

Route: `/hr/childcare`

Completed:

* Moved under People Management at `/hr/childcare`
* Removed mock provider array
* Providers loaded from approved `childcare_provider` applications
* Summary stat cards preserved (blue/green/purple/amber color scheme)
* Provider detail dialog shows real `form_data` from applications
* Empty states for no providers and no event history
* Review Applications / Add Provider flows link to Applications Submissions tab

Pending:

* Event participation tracking (Total Hours, Events Worked, History tab)

Key files:

* `lib/hr/childcare-provider-actions.ts`
* `components/hr/hr-childcare-panel.tsx`

---

## People Management Settings

Completed:

* Removed General tab (fiscal year, timezone, employee ID format — was non-functional UI)
* Removed Roles tab from Settings UI
* Kept Discount Policies as the sole Settings content
* `/hr/discount-policies` redirects to `/hr/settings`

---

## Unified Applications Engine

Status: Active Development

Migration: `scripts/012_applications.sql`

### Database

Tables:

* `application_type_definitions`
* `applications`
* `application_history`
* `application_documents`

### Application Types (seeded)

| ID | Module |
|----|--------|
| volunteer | hr |
| employment | hr |
| committee_member | hr |
| childcare_provider | hr |
| vendor | vendor_hub |
| financial_aid | programs |

### Lib Layer

* `lib/applications/application-types.ts` — types, registry, PM hub type list
* `lib/applications/application-actions.ts` — server actions (list, stats, submit, review)
* `lib/applications/application-routes.ts` — URL builders
* `lib/applications/application-status-tabs.ts` — status tab definitions
* `lib/applications/application-nav.ts` — sidebar nav helpers

### UI

* `components/applications/applications-module-page.tsx` — shared list/dashboard component
* `components/applications/applications-overview-client.tsx` — cross-module overview
* `components/contacts/contact-applications-panel.tsx` — contact profile integration
* Application detail: `/applications/[id]`

### Sidebar Changes

Completed:

* Removed duplicate Applications under Vendor Hub settings path
* Single **Applications** entry under People Management
* Removed separate Pending / Approved / Rejected sidebar items (now status tabs/filters on one page)

---

## People Management Applications Page

Status: Active Development

Route: `/people-management/applications`

Completed:

* Three top-level tabs: **Overview**, **Submissions**, **Templates**
* Overview: stat cards, status shortcuts, per-type counts; clicks navigate to Submissions with filters
* Submissions: status tabs, search, type/status filters, applications table
* Templates: cards per PM application type with scaffold for future form builder
* Module shortcut links (Child Care, Employees, etc.) open Submissions tab with type filter
* `PEOPLE_MANAGEMENT_APPLICATIONS_HUB_TYPES` excludes employment from default hub view

URL behavior:

* `/people-management/applications` → Overview
* `?tab=submissions` → Submissions
* `?tab=templates` → Templates
* `?application_type=` or `?status=` → Submissions (auto)

Pending:

* Template form builder (Configure Fields)
* Custom org-defined application types in UI

Key files:

* `components/applications/people-management-applications-client.tsx`
* `components/applications/application-templates-panel.tsx`

---

## Layout

Completed:

* Sidebar logo enlarged to fill header area (`components/layout/sidebar.tsx`)
* Scale applied to compensate for whitespace in `public/logo.png`

---

# Donations

## Ledger stabilization (Priority 1 — stop new corruption)

Status: In progress (June 2026)

### Canonical tables

All new payments → `payments`. All new pledges → `pledges`. Donor identity → `donors` (via `ensureDonorExtensionForContact`).

### Legacy tables (no new writes)

`donation_payments` and `donation_pledges` are **not deleted** but are **no longer written** by the app. Historical data in those tables is **not shown** on stabilized screens until a migration is run.

### Key files changed

* `app/(dashboard)/donations/pledges/page.tsx` — pledges CRUD + record payment on canonical tables only
* `app/(dashboard)/donations/page.tsx` — dashboard reads `pledge_status_view` + per-pledge outstanding
* `app/(customer)/customer/donation/page.tsx` — portal writes to `payments` / `pledges`
* `lib/customer/customer-portal-data-actions.ts` — portal reads canonical tables
* `lib/contacts/contact-profile-data.ts` — pledge activity from `pledge_status_view`
* `lib/donations/donation-status.ts` — lowercase status values + display labels

### Pending (not in this phase)

* SQL migration script for historical `donation_*` → canonical tables
* Committed DDL for `pledge_status_view` / `donor_summary_view` definitions
* Data migration / backfill

### Dev seed + validation (canonical only)

Dev-only scripts to populate and verify the stabilized ledger **without** touching `donation_payments`, `donation_pledges`, or `backup_*` tables.

| Script | Purpose |
|--------|---------|
| `scripts/seed-donations-dev.mjs` | Seed contacts, donors, campaigns, categories/funds, payment methods, pledges, payments, import staging |
| `scripts/validate-donations-seed.mjs` | Assert pledge balances, dashboard totals, portal write path, import/reconcile queue |
| `scripts/fixtures/donations-import-test.csv` | Sample CSV for manual import UI testing |
| `scripts/verify-donations-priority1.mjs` | Read-only integrity audit (legacy vs canonical counts) |
| `scripts/088_payments_source_type_check.sql` | Expand `payments.source_type` to manual/import/portal/processor |
| `scripts/smoke-portal-donation-payment.mjs` | One-time portal payment smoke (Seed Zelle display name) |
| `scripts/validate-campaign-analytics.mjs` | Assert campaign raised/pledged/progress math |
| `scripts/089_campaign_goals.sql` | Add `goal_amount` + `description` to campaigns |

**Run (dev Supabase only):**

```bash
npm run seed:donations-dev
# reset + re-seed: node scripts/seed-donations-dev.mjs --clean --confirm-dev
# remove seed only (no re-seed): node scripts/seed-donations-dev.mjs --clean --clean-only --confirm-dev
npm run validate:donations-seed
```

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Optional `DONATIONS_SEED_ORG_ID` to target a specific org (defaults to first org).

Seed marker: `DONATIONS_DEV_SEED_V1` (emails `donations-seed-*@dev.test`). Clean removes only tagged rows.

**Validated June 2026 (MAS Dallas dev):** 21/21 checks — pledge balances, dashboard totals, portal/import/manual writes, payment method display-name normalization, import reconcile queue; legacy tables at 0 rows.

## Attribution integrity (Priority 10)

Status: Implemented (June 2026)

### Goal

Every canonical `payments` and `pledges` write path stores `campaign_id`, `category_id`, and `subcategory_id` as foreign keys — not fund/campaign names in `memo` or `notes`.

### Shared helpers

* `lib/donations/payment-attribution.ts` — merge attribution, resolve names from CSV, fetch pledge/plan FKs
* `components/donations/donation-attribution-fields.tsx` — reusable Campaign / Category / Fund pickers

### Paths updated

| Path | File | Behavior |
|------|------|----------|
| Staff one-time payment | `app/(dashboard)/donations/payments/page.tsx` | Contact picker searches all contacts; attribution pickers on insert; pledge allocate copies FKs from pledge |
| Staff pledge create/edit | `app/(dashboard)/donations/pledges/page.tsx` | Contact picker searches all contacts; full FK pickers; **fixed** edit pledge writing campaign UUID (was display name) |
| Staff pledge payment | `app/(dashboard)/donations/pledges/page.tsx` | Copies pledge FKs onto payment |
| Portal one-time / pledge / pledge pay | `app/(customer)/customer/donation/page.tsx` | FKs on insert; optional campaign picker |
| Portal data | `lib/customer/customer-portal-data-actions.ts` | Payments select includes attribution columns; loads campaigns |
| Recurring plan create | `app/(dashboard)/donations/recurring/page.tsx` | Category + fund + campaign on plan (`recurring-donation-actions` already copies to manual payments) |
| CSV import & match | `app/(dashboard)/donations/import/page.tsx` | Upload CSV → payments created directly; Match Queue tab; email/phone matching; bulk auto-match; add contact |
| Legacy reconcile URL | `/donations/reconcile` | Redirects to `/donations/import?tab=match` |

### Validation

```bash
node scripts/seed-donations-dev.mjs --clean --confirm-dev
node scripts/validate-payment-attribution.mjs
node scripts/validate-campaign-analytics.mjs
node scripts/validate-recurring-donations.mjs
```

`scripts/validate-payment-attribution.mjs` — seed payment FK coverage, import attribution, campaign raised math, fund totals, recurring linkage.

**Apply migration:** `npx supabase db query --linked -f scripts/088_payments_source_type_check.sql` (or Supabase SQL Editor).

## Stripe one-time donation checkout (Priority 11)

Status: Implemented (June 2026)

### Goal

One-time online donations via Stripe Checkout write **only** to canonical `payments` after webhook confirmation. No second ledger, no unpaid portal inserts for card payments.

### Schema (migration `093_stripe_one_time_donations.sql`)

* `payments` — `stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_charge_id`, `refunded_amount`; unique index on `stripe_payment_intent_id`
* `donation_checkout_sessions` — in-flight checkout state (not a payment ledger)
* `payment_processor_events` — webhook audit + idempotency (`UNIQUE (stripe_event_id)`)

### Environment

* `STRIPE_SECRET_KEY`
* `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
* `STRIPE_WEBHOOK_SECRET`
* `NEXT_PUBLIC_APP_URL`

Stripe secrets are env-only — never stored in the database.

### Checkout flow

1. Portal card/online method → `createOneTimeDonationCheckoutAction` (`lib/donations/stripe-donation-actions.ts`)
2. Inserts `donation_checkout_sessions` row, creates Stripe Checkout Session (`mode: payment`)
3. Metadata: `organization_id`, `donor_id`, `contact_id`, `campaign_id`, `category_id`, `subcategory_id`, `checkout_type=one_time`, `manaratee_checkout_id`
4. Redirect to Stripe — **no** `payments` insert until webhook

Offline/manual methods still insert `payments` with `source_type: portal` directly.

### Webhook

`POST /api/webhooks/stripe/donations` — verifies `Stripe-Signature`, service-role Supabase.

| Event | Behavior |
|-------|----------|
| `checkout.session.completed` | Insert `payments` (`source_type=processor`, `source=stripe`, `status=unallocated`, `is_verified=true`); link checkout session |
| `payment_intent.succeeded` | Idempotent fallback if checkout event missed |
| `payment_intent.payment_failed` | Mark checkout session `failed` |
| `checkout.session.expired` | Mark checkout session `expired` |

Receipts: `maybeAutoGeneratePaymentReceipt` after payment insert when `auto_generate_receipts` is enabled (`status: not_sent` only — no email).

### Key files

| Area | Path |
|------|------|
| Checkout creation | `lib/donations/stripe/checkout.ts` |
| Webhook processor | `lib/donations/stripe/processor-payment.ts` |
| Metadata | `lib/donations/stripe/metadata.ts` |
| Server actions | `lib/donations/stripe-donation-actions.ts` |
| Stripe client | `lib/stripe/stripe-server.ts` |
| Portal UI | `app/(customer)/customer/donation/page.tsx` |
| Webhook route | `app/api/webhooks/stripe/donations/route.ts` |

### Validation

```bash
npx supabase db query --linked -f scripts/093_stripe_one_time_donations.sql
npm run validate:stripe-one-time
```

**Validated (June 2026):** 14/14 — schema, checkout row, webhook payment insert, idempotency (payment + event), attribution FKs, campaign analytics delta, donor history, legacy tables untouched.

### Manual test (Stripe CLI)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe/donations
# Use test card 4242 4242 4242 4242 in portal online donation flow
```

### Out of scope (P11)

Refunds, pledge-via-Stripe, per-org Stripe Connect onboarding. (Stripe **subscriptions** moved to Priority 16.)

## Stripe recurring donation subscriptions (Priority 16)

Status: Implemented (June 2026)

### Goal

Stripe-powered recurring billing on top of existing `recurring_donation_plans`. Canonical `payments` rows are created only from `invoice.paid` / `invoice.payment_succeeded` webhooks — not at checkout start.

### Schema (migration `100_stripe_recurring_donations.sql`)

* `payments.stripe_invoice_id` — unique partial index for invoice idempotency
* `recurring_donation_plans.stripe_customer_id`
* Plan statuses extended: `pending_setup`, `past_due` (plus existing `active`, `paused`, `cancelled`, `completed`)

### Customer portal

* `/customer/donation` — **Recurring Donation** dialog: amount, frequency (monthly / quarterly / annually), campaign, category/fund, Stripe card checkout
* `createRecurringDonationCheckoutAction` creates `recurring_donation_plans` (`pending_setup`) + `donation_checkout_sessions` (`recurring_setup`) + Stripe Checkout `mode: subscription`
* Success redirect: `/customer/donation?checkout=success&type=recurring&session_id={CHECKOUT_SESSION_ID}`

### Webhook events (`POST /api/webhooks/stripe/donations`)

| Event | Behavior |
|-------|----------|
| `checkout.session.completed` (recurring_setup) | Link `external_processor_id` (subscription), `stripe_customer_id`, activate plan; **no** payment insert |
| `invoice.paid` / `invoice.payment_succeeded` | Insert canonical `payments` with `recurring_donation_plan_id`, `stripe_invoice_id`; auto-receipt when enabled |
| `invoice.payment_failed` | Log event; set plan `past_due`; no payment |
| `customer.subscription.updated` | Sync plan status + `next_payment_date` from Stripe period |
| `customer.subscription.deleted` | Set plan `cancelled` |

One-time checkout events unchanged (P11).

### Key files

| Area | Path |
|------|------|
| Recurring checkout | `lib/donations/stripe/recurring-checkout.ts` |
| Subscription webhooks | `lib/donations/stripe/processor-subscription.ts` |
| Stripe helpers | `lib/donations/stripe/recurring-stripe-utils.ts` |
| Server actions | `lib/donations/stripe-donation-actions.ts` |
| Portal UI | `app/(customer)/customer/donation/page.tsx` |
| Staff UI | `app/(dashboard)/donations/(operations)/recurring/page.tsx` |

### Validation

```bash
npx supabase db query --linked -f scripts/100_stripe_recurring_donations.sql
npm run validate:stripe-recurring
```

**Validated (June 2026):** 19/19 — subscription checkout, plan link, invoice payment insert, idempotency (invoice + event), attribution FKs, donor/recurring/campaign reporting, legacy tables untouched.

### Manual test (Stripe CLI)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe/donations
# Portal → Recurring Donation → test card 4242 4242 4242 4242
# Subscribe to webhook events: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted
```

### Out of scope (P16)

Refunds, donor self-service pause/cancel in portal, Stripe Customer Portal for card updates, per-org Stripe Connect, weekly frequency in portal (staff manual plans still support weekly).

## Transactional email delivery (Priority 12)

Status: Implemented (June 2026)

### Goal

Reliable operational email for donations only — receipts, year-end statements, and pledge reminders. No marketing, newsletters, or campaigns.

### Provider abstraction

* `lib/email/email-provider-types.ts` — provider interface
* `lib/email/providers/resend-email-provider.ts` — Resend (preferred)
* `lib/email/providers/console-email-provider.ts` — dev fallback when Resend not configured
* `lib/email/get-email-provider.ts` — provider factory
* `lib/email/donation-email-service.ts` — public API: `sendReceiptEmail`, `sendYearEndStatementEmail`, `sendPledgeReminderEmail`
* `lib/donations/donation-email-delivery.ts` — delivery orchestration + status updates
* `lib/donations/donation-email-templates.ts` — branded HTML templates with org tokens

### Environment

* `RESEND_API_KEY`
* `TRANSACTIONAL_EMAIL_FROM`
* `TRANSACTIONAL_EMAIL_REPLY_TO` (optional)

### Schema (migration `094_transactional_email.sql`)

* `transactional_email_log` — recipient, template, status, provider, `provider_message_id`, `sent_at`
* `donation_receipts.status` — adds `failed`
* `donation_settings.year_end_statement_email_template`

### Email flows

| Flow | Trigger | Status tracking |
|------|---------|-----------------|
| Receipt | Auto after Stripe payment when `email_receipts_automatically`; manual from payments UI | `donation_receipts.status` → `sent` / `resent` / `failed` |
| Year-end statement | Individual or bulk from Reports → Tax Receipts | Same receipt row (`annual_statement`) |
| Pledge reminder | Staff send from pledges/collection UI | `pledge_reminders.status` + `delivered_externally` |

PDF attachments included for receipt and statement emails (server-generated via `jspdf`).

### Templates (editable per org)

* Receipt — `donation_settings.receipt_email_template`
* Year-end statement — `donation_settings.year_end_statement_email_template`
* Pledge reminder — `pledge_reminder_subject` + `pledge_reminder_message`

### Validation

```bash
npx supabase db query --linked -f scripts/094_transactional_email.sql
npm run validate:transactional-email
```

**Validated (June 2026):** 8/8 — schema, receipt/statement/reminder send, failed delivery logging, email log entries.

### Out of scope (P12)

Marketing emails, newsletters, donor segmentation, scheduled pledge reminder cron (manual send only).

## Beta launch hardening (Priority 13)

Status: Audit complete (June 2026)

### Validation suite (automated)

| Script | Result | Notes |
|--------|--------|-------|
| `validate:donations-seed` | 20/21 | `dashboard_totals` fails due to Stripe test payment pollution (+$67) |
| `validate:payment-attribution` | 9/10 | Same raised-total drift from test runs |
| `validate:campaign-analytics` | 6/9 | Expected values stale after Stripe validation inserts |
| `validate:recurring-donations` | 9/9 | Pass |
| `validate:stripe-one-time` | 14/14 | Pass |
| `validate:stripe-recurring` | 19/19 | Pass |
| `validate:transactional-email` | 8/8 | Pass |
| `validate:donation-receipts` | — | Fails when multiple orgs share seed campaign code (`maybeSingle` ambiguity) |
| `validate:pledge-reminders` | — | Same org-scoping issue |
| `beta:donations-stress` (quick: 1k payments) | Pass | All queries &lt; 300ms |

### Stress test (quick scale)

`npm run beta:donations-stress` — 100 donors, 1,000 payments, 100 pledges:

* `fetch_all_payments`: ~257ms
* `pledge_status_view`: ~151ms
* `campaign_analytics_bundle`: ~293ms
* `donor_search_ilike`: ~116ms

Full 10k scale not run in CI (requires explicit approval); extrapolated ~2–3s per full-org fetch at current indexes.

### Launch blockers to fix before paid customers

1. ~~Add RLS policies on `payments`, `pledges`, `donors`~~ — **Fixed (Priority 14, migration `095`)**
2. ~~Enforce `donations.view` / `donations.manage` on server actions and `/donations/*` routes~~ — **Fixed (Priority 14)**
3. ~~Add pagination to staff payments/donors lists~~ — **Fixed (Priority 15–15.5)** — payments, pledges, donors, and reports use server pagination or SQL RPCs
4. Isolate validation test data (cleanup Stripe test payments or use dedicated test org)

## Security & multi-tenant hardening (Priority 14)

Status: Implemented (June 2026)

### RLS (migration `scripts/095_donations_rls_hardening.sql`)

Permission-aware `SECURITY DEFINER` helpers: `auth_user_can_view_donations`, `auth_user_can_manage_donations`, `auth_user_contact_ids`, `auth_user_donor_ids`.

| Table | Staff SELECT | Staff INSERT/UPDATE/DELETE | Customer self-access |
|-------|--------------|----------------------------|----------------------|
| `payments` | `donations.view` or `donations.manage` | `donations.manage` | SELECT/INSERT own (`contact_id`, `source_type = portal`) |
| `pledges` | same | same | SELECT/INSERT own (`donor_id`) |
| `donors` | same | same | SELECT/INSERT own (`contact_id`) |
| `recurring_donation_plans` | same | same | — |
| `donation_receipts` | same | same | — |
| `pledge_reminders` | same | same | — |
| `donation_checkout_sessions` | staff view; staff update manage | — | SELECT own sessions |
| `payment_processor_events` | staff view (org or null org) | service role only | — |

Service role (Stripe webhooks, checkout session creation) bypasses RLS unchanged.

### Server-side permission enforcement

* `app/(dashboard)/donations/layout.tsx` — `donations.view` **or** `donations.manage`
* `app/(dashboard)/donations/import/layout.tsx` — `donations.manage`
* `app/(dashboard)/donations/reconcile/layout.tsx` — `donations.manage`
* `app/(dashboard)/donations/settings/layout.tsx` — `donations.manage`
* `lib/donations/donation-action-auth.ts` — `requireDonationStaffAccess("view" | "manage")` for receipt, pledge-reminder, and recurring server actions

Customer portal (`/customer/donation/*`, `stripe-donation-actions.ts`) uses contact-scoped JWT + RLS; no staff permissions required.

### Validation

```bash
npx supabase db query --linked -f scripts/095_donations_rls_hardening.sql
npm run validate:donations-security
```

**Validated (June 2026):** 38/38 security checks — anon blocked, customer cross-donor isolation, staff cross-org isolation, layout/action guards, Stripe webhook integration 14/14.

### Remaining security notes (post-P14)

* `pledge_status_view` / `donor_summary_view` — view RLS not committed in repo; staff/customer queries rely on underlying table policies + app filters
* Staff list pages still fetch via client Supabase (protected by layout + RLS, not server-action wrappers)
* `transactional_email_log` still uses org-membership SELECT (not permission-key aware)
* Pagination still recommended before large-org production load

## Production readiness & scalability (Priority 15)

Status: Implemented (June 2026)

### Database performance (migrations `096`–`098`)

* `096_donations_performance_indexes.sql` — org-scoped indexes on `payments`, `pledges`, `donors`, receipts, checkout sessions
* `097_donations_views.sql` — committed `pledge_status_view` + `donor_summary_view` with `security_invoker = true`
* `098_donations_dashboard_rpcs.sql` — SQL summaries for dashboard KPIs, monthly chart, source breakdown

Run after `095`:

```bash
npx supabase db query --linked -f scripts/096_donations_performance_indexes.sql
npx supabase db query --linked -f scripts/097_donations_views.sql
npx supabase db query --linked -f scripts/098_donations_dashboard_rpcs.sql
npm run validate:donations-production
```

### Pagination & server-side lists

* `lib/donations/donation-list-actions.ts` — paginated payments, pledges, donor summary queries (50/page)
* `/donations/payments` — server-paginated table + search/status filters
* `/donations/pledges` — server-paginated table; summary cards via `donation_org_pledge_summary` RPC
* `/donations/donors` — `DonorsPaginatedList` on `donor_summary_view` (replaces full contact scan)
* `/donations` dashboard — KPI/chart data via RPCs; recent payments limited to 5 rows

### Operational visibility

* `lib/donations/donation-ops-actions.ts` + `DonationOpsPanel` on settings → General tab
* Surfaces failed emails, failed receipts, reconcile queue depth, Stripe processor failures

### Email scalability

* `sendBulkAnnualStatementsAction` — parallel batches of 10 (no external queue)

### Remaining scale work

* Recurring plans list not paginated (typically smaller dataset)
* Customer portal payment history unbounded per contact
* Dedicated test org for validation scripts still recommended

### Donations navigation (sidebar consolidation)

Status: Implemented (June 2026)

* Sidebar: **Overview**, **Donors**, **Records**, **Donation Manager**, **Reports**, **Settings** (`components/layout/sidebar.tsx`)
* **Records** — horizontal tab bar for Payments, Pledges, Recurring, Campaigns (`components/donations/donation-payments-nav.tsx`, `app/(dashboard)/donations/(operations)/layout.tsx`)
* **Donation Manager** — Collect and Import & Match tabs (`components/donations/donation-manager-nav.tsx`, `app/(dashboard)/donations/(donation-manager)/layout.tsx`)
* URLs unchanged; **Import & Match** tab hidden unless user has `donations.manage`; `/donations/reconcile` redirects to match queue

## Campaign goals & fundraising analytics (Priority 3)

Status: Implemented (June 2026)

### Campaign fields

`campaigns` supports `goal_amount`, `description`, `start_date`, `end_date`, `status` (migration `scripts/089_campaign_goals.sql` adds goal/description if missing).

### Analytics module

`lib/donations/campaign-analytics.ts` — metrics from canonical `payments`, `pledges` (via `pledge_status_view`), `campaigns`, `donors`:

* **Raised** — `SUM(payments)` linked by `payments.campaign_id` or `payments.pledge_id → pledges.campaign_id`
* **Pledged / Outstanding / Collected** — from `pledge_status_view` per campaign
* **Progress %** — `raised / goal_amount` (null-safe when no goal)

### Routes

| Route | Purpose |
|-------|---------|
| `/donations/campaigns` | Campaign list with metrics |
| `/donations/campaigns/[id]` | Campaign detail (summary, donor metrics, recent activity) |
| `/donations` | Dashboard widgets: Top Campaigns, Campaign Progress, Goal Achievement |
| `/donations/reports` | Campaigns tab — donations/pledges/outstanding/donors by campaign |
| `/donations/settings` | Campaign CRUD persists goal + description; live raised totals; Categories and Payment Methods support add/edit/delete (June 2026) |

### Validation

```bash
npm run validate:campaign-analytics
# Re-seed with goals: node scripts/seed-donations-dev.mjs --clean --confirm-dev
```

Seed campaign `DEV-RAMADAN-2026`: goal $5,000; raised $750; pledged $1,800; outstanding $1,050; 15% progress.

**Validated (June 2026):** donations seed 21/21; campaign analytics 9/9; UI metrics consistency 6/6 (`scripts/smoke-campaign-ui-metrics.mjs`).

## Receipts & year-end giving statements (Priority 4)

Status: Implemented (June 2026)

### Schema

Migration `scripts/090_donation_receipts.sql`:

* `donation_settings` — org legal name, address, EIN, receipt footer, signer, email template, receipt numbering, year-end options
* `donation_receipts` — generated receipts from canonical `payments` only; status `not_sent` / `sent` / `resent`; `sent_at`, `sent_by`

### Libraries

| File | Purpose |
|------|---------|
| `lib/donations/receipt-types.ts` | Types, defaults, receipt number formatting |
| `lib/donations/receipt-settings.ts` | Load/save org receipt config |
| `lib/donations/receipt-data.ts` | Build payment receipt + annual statement payloads; donor giving totals |
| `lib/donations/receipt-actions.ts` | Server actions: generate, mark sent, reporting summary |
| `lib/donations/receipt-pdf.ts` | HTML templates + jsPDF download + print fallback |

### Routes / screens

| Route | Receipt features |
|-------|------------------|
| `/donations/settings` | General tab — org legal/address/EIN; Receipts tab — full receipt config |
| `/donations/payments` | Generate, view, download PDF, re-send per payment |
| `/donations/donors/individuals/[id]` | Lifetime/current/previous year giving; giving statement download |
| `/donations/donors/organizations/[id]` | Same as individual donor profile |
| `/donations/reports` | Receipts tab (generated/sent/missing); Tax Receipts tab (year-end statements) |

### Rules

* Receipts generated only from actual `payments` rows (not pledge creation)
* Voided payments excluded
* Annual statements sum payments for donor + tax year only

### Validation

```bash
npx supabase db query --linked -f scripts/090_donation_receipts.sql
npm run validate:donation-receipts
```

**Validated (June 2026):** donation receipts 12/12 (`scripts/validate-donation-receipts.mjs`).

**Apply migration:** `scripts/090_donation_receipts.sql`

## Pledge reminders & collection workflows (Priority 5)

Status: Implemented (June 2026)

### Schema

Migration `scripts/091_pledge_reminders.sql`:

* Extends `donation_settings` with pledge reminder config (enable, message, subject, schedule, footer, payment instructions)
* `pledge_reminders` — reminder activity log per pledge (`draft` / `sent` / `failed` / `skipped`); `delivered_externally` tracks real email delivery

### Libraries

| File | Purpose |
|------|---------|
| `lib/donations/pledge-reminder-types.ts` | Types, defaults, eligibility helpers |
| `lib/donations/pledge-reminder-data.ts` | Outstanding pledges, message builder, collection report |
| `lib/donations/pledge-reminder-actions.ts` | Preview, record reminder, mark contacted, reporting |

### Routes / screens

| Route | Features |
|-------|----------|
| `/donations/settings` → Pledge Reminders | Enable reminders, message templates, schedule options |
| `/donations/collect` | Outstanding pledge queue with balances from `pledge_status_view` |
| `/donations/pledges` | Pledge detail — preview/record reminder, mark contacted |
| `/donations/donors/*/[id]` | Active pledges, outstanding balance, reminder history |
| `/donations/reports` → Collection | Outstanding/partial/no-payment stats, reminder history summary |

### Workflow

1. Staff opens outstanding pledge (Collect page or pledge detail).
2. Preview builds message from org settings + canonical pledge balances.
3. **Record Reminder** inserts `pledge_reminders` row with `delivered_externally=false` and alerts staff that no external email was sent.
4. **Mark Contacted** logs manual outreach with optional notes (`reminder_type=contacted`).
5. Fulfilled pledges are excluded from the collection queue automatically.

### Limitations

* Outbound email provider not wired — reminders are recorded only until mail integration is added.
* `delivered_externally` remains `false` for all current sends.
* Overdue detection uses `pledge_date` as proxy (no separate due-date column on pledges).

### Validation

```bash
npx supabase db query --linked -f scripts/091_pledge_reminders.sql
npm run validate:pledge-reminders
```

**Validated (June 2026):** pledge reminders 11/11 (`scripts/validate-pledge-reminders.mjs`).

**Apply migration:** `scripts/091_pledge_reminders.sql`

## Recurring donations (Priority 6)

Status: Implemented (June 2026)

### Schema

Migration `scripts/092_recurring_donations.sql`:

* `recurring_donation_plans` — donor, amount, frequency, start/next dates, status (`active` / `paused` / `cancelled` / `completed`)
* `payments.recurring_donation_plan_id` — links canonical payments to plans (nullable FK)

Recurring donations are **not** pledges and do **not** auto-create receipts.

### Libraries

| File | Purpose |
|------|---------|
| `lib/donations/recurring-donation-types.ts` | Types, MRR helpers |
| `lib/donations/recurring-donation-schedule.ts` | Next payment date calculation |
| `lib/donations/recurring-donation-data.ts` | Dashboard metrics, reporting |
| `lib/donations/recurring-donation-actions.ts` | CRUD plans, record payments, status updates |

### Routes / screens

| Route | Features |
|-------|----------|
| `/donations/recurring` | Dashboard (MRR/ARR, active/paused/cancelled), plan list, create plan, record payment |
| `/donations/donors/*/[id]` | Active plans, recurring payment history, lifetime recurring giving |
| `/donations/reports` → Recurring | Donor count, revenue by campaign/donor from linked payments |

### Payment flow

1. Staff creates `recurring_donation_plans` record.
2. On scheduled gift, staff uses **Record Payment** → inserts canonical `payments` row with `recurring_donation_plan_id`, `pledge_id=null`.
3. Plan `next_payment_date` advances by frequency.
4. Status changes: pause, resume, cancel — no processor integration yet.

### Future processor integration

* Implemented in Priority 16 — Stripe subscriptions populate `external_processor` / `external_processor_id` / `stripe_customer_id`; invoice webhooks insert canonical `payments` with `source_type=processor`.

### Validation

```bash
npx supabase db query --linked -f scripts/092_recurring_donations.sql
npm run validate:recurring-donations
```

**Validated (June 2026):** recurring donations 9/9 (`scripts/validate-recurring-donations.mjs`).

**Apply migration:** `scripts/092_recurring_donations.sql`

## Contacts identity & affiliation sync (Phase 1) — Closeout

**Status:** Complete (June 2026) — tickets **S-01 through S-13** delivered and validated.

**North star:** One Contact · Many Roles · Many Activities · No Duplicate Identities

**Validation gate (run before release or after affiliation changes):**

```bash
npm run validate:contacts-phase1
npm run validate:contacts-phase1:report   # optional JSON → scripts/reports/contacts-phase1-validation.json
```

**Required migration:**

```bash
npx supabase db query --linked -f scripts/101_contact_participation_roles.sql
```

(Run after `100_stripe_recurring_donations.sql`.)

### Goal

Stabilize canonical contact identity across donations, programs, ticketing, and volunteers without merge UI or segmentation. Activity-derived roles sync through approved helpers only — never manual `contact_roles` inserts on write paths, never profile-refresh dependency for new activity.

### Architecture (approved — do not redesign)

```
Activity write (donation, enrollment, ticket order, volunteer roster)
        │
        ├─ Donations (portal / staff UI) ──► handleDonationAffiliationSync
        ├─ Donations (Stripe webhooks) ──────► syncDonationAffiliationFromWebhook
        └─ Programs / ticketing / volunteers ► syncContactAffiliations(orgId explicit)
                    │
                    ▼
           computeDerivedAffiliations (validation / diagnostics)
                    │
                    ▼
           sync_contact_affiliations RPC (authoritative reconcile)
                    │
                    ▼
           contact_roles upsert (idempotent)
```

`refreshContactAffiliations` on contact profile open (`app/(dashboard)/contacts/[id]/page.tsx`) reconciles stale rows for staff viewing — Phase 1 write paths do **not** depend on it.

### Ticket delivery (S-01 – S-13)

| Ticket | Scope |
|--------|-------|
| **S-01** | `handleDonationAffiliationSync` accepts optional `organizationId` + `supabaseClient` for webhook/service-role callers |
| **S-02/S-03** | Stripe webhook donation affiliation sync via `syncDonationAffiliationFromWebhook` |
| **S-04A/B** | Participation roles `program_participant`, `event_attendee` (+ schema slot `venue_rental_customer`); derivation in `computeDerivedAffiliations` |
| **S-05/S-06** | Portal/staff pledge **payment** → `handleDonationAffiliationSync`; pledge create does not sync donor |
| **S-07** | `createTicketOrder` → `findOrCreateContact` + `ticket_orders.contact_id` |
| **S-08** | Ticketing completion → `syncContactAffiliations` on completed orders |
| **S-09/S-10** | Program `participant_contact_id` via `ensureContactForPerson`; enrollment → `syncContactAffiliations` for `program_participant` |
| **S-11** | `ensureVolunteerForContact` fixed — roster + `syncContactAffiliations` only |
| **S-12** | Unified validation runner + shared lib + cross-module role accumulation |
| **S-13** | Documentation closeout — `Features.md`, `Project_Context.md`, `Database_Overview.md`, `Module_Inventory.md` |

### Affiliation derivation (Phase 1)

| Role | Activity trigger | Auto-remove | Sync entry |
|------|------------------|-------------|------------|
| `donor` | Linked `payments` for contact (direct or via `donor_id`) | Never (sticky) | `handleDonationAffiliationSync` / webhook helper |
| `volunteer` | `volunteers` row for contact | Never (sticky) | `syncContactAffiliations` |
| `program_participant` | `program_enrollments.participant_contact_id`, status ∉ `cancelled`, `withdrawn`, `transferred` | Never (sticky) | `syncContactAffiliations` |
| `event_attendee` | `ticket_orders.contact_id` with `status = completed` | Never (sticky) | `syncContactAffiliations` |
| `member` | Active `memberships` row | Yes when membership lapses | `syncContactAffiliations` |

`venue_rental_customer` is in the CHECK constraint only; derivation deferred until venue rental linkage lands.

### Module write paths

| Module | Identity helper | Affiliation trigger | Key files |
|--------|-----------------|---------------------|-----------|
| Stripe donations | Payment/donor metadata | After payment/plan insert (webhook) | `lib/donations/stripe/processor-payment.ts`, `processor-subscription.ts` |
| Portal/staff donations | Existing donor/contact | After payment insert (not pledge-only) | `app/(customer)/customer/donation/page.tsx`, `app/(dashboard)/donations/(operations)/pledges/page.tsx` |
| Ticketing | `findOrCreateContact` | Order reaches `completed` | `lib/tickets/ticket-order-actions.ts` |
| Programs | `ensureContactForPerson` / `resolveParticipantContactIdForRegistration` | Enrollment created (not waitlist-only); `promote_waitlist` | `lib/programs/program-registration-actions.ts`, `program-enrollment-actions.ts`, `program-lifecycle-actions.ts` |
| Volunteers | Reuse canonical `contact_id` | Volunteer roster row created | `lib/volunteers/volunteer-actions.ts` |

### Key files

| File | Purpose |
|------|---------|
| `lib/contacts/contact-affiliation-sync.ts` | `computeDerivedAffiliations` (diagnostics), `syncContactAffiliations` → RPC, webhook helpers |
| `lib/contacts/contact-affiliation-rules.ts` | Terminal enrollment statuses, sticky/removable role policy |
| `lib/contacts/contact-actions.ts` | `findOrCreateContact`, `ensureContactForPerson` → gated RPCs |
| `lib/tickets/ticket-order-actions.ts` | FOC + `contact_id`; completion sync |
| `lib/programs/person-actions.ts` | `ensureParticipantContactForPerson`, `resolveParticipantContactIdForRegistration` |
| `lib/programs/program-enrollment-actions.ts` | `syncAffiliationAfterEnrollmentCreation` |
| `lib/programs/program-registration-actions.ts` | Customer registration identity + sync |
| `lib/programs/program-lifecycle-actions.ts` | Waitlist promotion sync |
| `lib/volunteers/volunteer-actions.ts` | `createVolunteer`, `ensureVolunteerForContact` |
| `scripts/lib/contacts-phase1-validation.mjs` | Shared validation utilities (S-12) |
| `scripts/validate-contacts-phase1.mjs` | Unified runner (S-12) |

### Validation (S-12)

Unified runner executes policy checks, six module suites, and cross-module role accumulation.

| Suite | Command | Ticket |
|-------|---------|--------|
| **Unified** | `validate:contacts-phase1` | S-12 |
| Stripe one-time | `validate:stripe-one-time` | S-02 |
| Stripe recurring | `validate:stripe-recurring` | S-03 |
| Portal + pledge | `validate:portal-pledge-donation-sync` | S-05/S-06 |
| Ticketing completion | `validate:ticketing-completion-sync` | S-08 |
| Program participant | `validate:program-participant-sync` | S-09/S-10 |
| Volunteer identity | `validate:volunteer-identity-sync` | S-11 |

**Matrix covered:** donations (one-time, recurring, pledge create/pay), ticketing (complete, pending→complete, contact reuse), programs (enroll, contact create/reuse, sticky terminal), volunteers (create, reuse, dedupe), cross-module accumulation (donor + volunteer + program_participant + event_attendee on one contact), policy (sticky roles, member auto-removable, sync primary path, no profile-refresh dependency).

**Last validated:** June 2026 — policy 8/8, suites 7/7, checks 75/75 (`validate:contacts-phase1:report`).

### Deferred (Phase 2+)

* Historical enrollment/ticket `contact_id` backfill
* Participant merge UI and dedupe tooling
* `venue_rental_customer` activity linkage
* Contact segmentation / advanced CRM panels
* Volunteer application approval → automatic roster (approval UX unchanged in Phase 1)
* Staff enrollment paths outside `register_for_program` / `promote_waitlist`

---

## Contacts security remediation (RLS wave 1) — G6 complete, M4 authorized

**Status:** M1–M6b + CR-8 implemented in repo (June 2026). **M4** script `111` is **authorized** for staging after `109`–`110` applied.

**Rollout:** Hybrid C→B — additive policies (102–106) → M6/M6b RPC gates → G6 validation → M4 drop open policies (`111`).

### SQL migrations (run in order after `101_contact_participation_roles.sql`)

```bash
npx supabase db query --linked -f scripts/102_contacts_rls_helpers.sql
npx supabase db query --linked -f scripts/103_contacts_rls_support_helpers.sql
npx supabase db query --linked -f scripts/104_contacts_rls_policies.sql
npx supabase db query --linked -f scripts/105_contact_roles_rls_policies.sql
npx supabase db query --linked -f scripts/106_contact_notes_rls_policies.sql
npx supabase db query --linked -f scripts/107_contacts_permission_seeds.sql
npx supabase db query --linked -f scripts/108_contacts_affiliation_sync_rpcs.sql
npx supabase db query --linked -f scripts/109_contacts_rls_gate_alignment.sql
npx supabase db query --linked -f scripts/110_contacts_membership_permission_seeds.sql
# After staging smoke + npm run validate:contacts-security --post-m4:
npx supabase db query --linked -f scripts/111_contacts_m4_drop_open_policies.sql
```

| Script | Scope |
|--------|-------|
| `102`–`108` | M1–M6 (helpers, policies, seeds, affiliation RPCs) |
| `109` | **M6b:** events/ticketing/membership in create + sync RPC gates |
| `110` | **M6b:** `membership.view` / `membership.manage` seeds; `events.*` → `contacts.view` cross-grant |
| `111` | **M4:** Drop legacy `USING(true)` contacts / contact_roles policies |

### App changes (M6 + M6b + CR-7)

* RPC routing: `syncContactAffiliations`, `findOrCreateContact`, `ensureContactForPerson`
* Permissions: `contacts.*`, `membership.*`, `ticketing.*` in `permission-keys.ts` + Roles UI
* `assertTicketingManagePermission` — includes `ticketing.manage`
* `assertMembershipManagePermission` on membership write paths
* Sidebar: membership module gated by `membership.view` (fallback `contacts.view`)

### Validation (CR-8 / G6)

```bash
npm run validate:contacts-g6              # CR-8 + Phase 1 (report written)
npm run validate:contacts-security        # CR-8 repo + DB helpers/RPCs
npm run validate:contacts-security:report # + JSON → scripts/reports/
npm run validate:contacts-security -- --post-m4   # after 111 applied
```

**G6 result (June 2026):** `54/54` checks passed (`validate:contacts-g6`). Report: `scripts/reports/contacts-security-validation.json`.

### M4 authorization

**Authorized** for staging deployment of `111` when:

1. `102`–`110` applied on target database
2. `npm run validate:contacts-g6` GREEN
3. Manual smoke: ticketing order complete, membership add-member, CRM notes (staff with `contacts.manage`)
4. `npm run validate:contacts-security -- --post-m4` GREEN after `111`

**Not authorized for production** until staging post-M4 soak completes without P0 regressions.
