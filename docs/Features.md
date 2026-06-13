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
# reset: node scripts/seed-donations-dev.mjs --clean --confirm-dev
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
| Staff one-time payment | `app/(dashboard)/donations/payments/page.tsx` | Attribution pickers on insert; pledge allocate copies FKs from pledge |
| Staff pledge create/edit | `app/(dashboard)/donations/pledges/page.tsx` | Full FK pickers; **fixed** edit pledge writing campaign UUID (was display name) |
| Staff pledge payment | `app/(dashboard)/donations/pledges/page.tsx` | Copies pledge FKs onto payment |
| Portal one-time / pledge / pledge pay | `app/(customer)/customer/donation/page.tsx` | FKs on insert; optional campaign picker |
| Portal data | `lib/customer/customer-portal-data-actions.ts` | Payments select includes attribution columns; loads campaigns |
| Recurring plan create | `app/(dashboard)/donations/recurring/page.tsx` | Category + fund + campaign on plan (`recurring-donation-actions` already copies to manual payments) |
| CSV import | `app/(dashboard)/donations/import/page.tsx` | Optional CSV columns + default attribution UI; resolves names via `raw_row` |
| Reconcile allocate | `app/(dashboard)/donations/reconcile/page.tsx` | Copies pledge FKs when matching donor/pledge |

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

Stripe subscriptions, refunds, pledge-via-Stripe, per-org Stripe Connect onboarding.

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

1. Add RLS policies on `payments`, `pledges`, `donors` (currently app-layer `organization_id` filtering only)
2. Enforce `donations.view` / `donations.manage` on server actions and `/donations/*` routes
3. Add pagination to staff payments/donors lists
4. Isolate validation test data (cleanup Stripe test payments or use dedicated test org)

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
| `/donations/settings` | Campaign CRUD persists goal + description; live raised totals |

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

* `external_processor` + `external_processor_id` columns reserved on plans.
* Payment recording action can be swapped for webhook-driven inserts without schema changes.
* Stripe billing subscriptions would populate processor fields and set `source_type=processor`.

### Validation

```bash
npx supabase db query --linked -f scripts/092_recurring_donations.sql
npm run validate:recurring-donations
```

**Validated (June 2026):** recurring donations 9/9 (`scripts/validate-recurring-donations.mjs`).

**Apply migration:** `scripts/092_recurring_donations.sql`
