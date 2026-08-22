# PROJECT_CONTEXT.md

## Project Overview

Manaratee is a multi-tenant SaaS platform built with Next.js and Supabase.

The platform supports organizations that manage programs, registrations, customers, permissions, financial assistance applications, and future community engagement workflows.

The system is designed so that each organization only sees its own data.

---

## Tech Stack

* Next.js App Router
* TypeScript
* Supabase
* Tailwind CSS
* shadcn/ui
* Vercel

---

## Multi-Tenant Architecture

Core tables:

* organizations
* organization_members
* organization_roles
* role_permissions

Important rule:

All organization data must remain isolated by organization_id.

---

## User Types

### Platform Owner

Reserved system role:

owner

Responsibilities:

* Manage platform
* Access all organizations
* Platform administration

The owner role is never used as an organization role.

---

### Organization Members

System role stored in:

organization_members.role

Organization role stored in:

organization_members.role_id

Organization roles come from:

organization_roles

Examples:

* Super Admin
* Admin
* Teacher
* Volunteer Coordinator
* Accountant

---

## Permission System

Permissions are stored in:

role_permissions

Examples:

* settings.users.view
* settings.users.manage
* settings.roles.view
* settings.roles.manage
* programs.view
* programs.manage
* donations.view
* donations.manage
* applications.view
* applications.manage
* reports.view

Server-side permission protection is required.

Sidebar visibility must respect permissions.

---

## Subscription System

Sidebar visibility uses two filters:

1. Subscription access from my_sidebar_modules
2. Permission access from role_permissions

Both conditions must pass before showing a module.

Pinned footer items (below module list): Billing (super admin) → Settings.

---

## Customer Portal

Customers can:

* Login
* Switch organizations
* Browse programs
* Register for programs
* Submit financial assistance applications (planned)

Organization switching uses:

active_organization_id

All customer pages must respect the active organization.

---

## Development Rules

1. Do not remove tenant isolation.
2. Do not bypass permission checks.
3. Do not use mock data unless specifically requested.
4. Always inspect existing schema before changing database structures.
5. Prefer extending existing architecture over creating duplicate systems.
6. Provide complete code replacements when possible.
7. Provide exact SQL when database changes are needed.

---

## Current Focus

People Management module
Unified Applications engine
Programs Module
Staff UI labels: Program (`programs`) → Offering (`program_offerings`); see `lib/programs/program-display-labels.ts`.
**Deferred naming (parked — high blast radius):** (1) DB rename `programs`→`seasons`, `program_offerings`→`programs` (fits years, seasons, camps); (2) align HR sidebar vs `/workforce/*` routes/folders; (3) Donations module → Fund Development in DB/routes (UI label already Fund Development). Do not start without a dedicated migration plan. Details in `docs/Features.md`.
Registrations
Financial Assistance
**Programs flexibility contract** — **F1–F7** (`180`–`181`). Academic vs Seasonal modes + org `program_kinds` entitlement (SQL **`246`**); packaging UI on Platform Admin + Billing (Phase 6). Report Type filters + URL `?kind=` presets (Phases 3–4); kind-aware staff terminology (Phase 5). See [`docs/programs-flexibility-contract.md`](./programs-flexibility-contract.md).
**Stripe Connect Express** for org donation payouts (implemented June 2026)
**Platform subscription billing via Stripe** (orgs paying Manaratee — pending)
Customer Experience
User Invitations
**Contacts Phase 1 — identity linkage + affiliation sync** — **Complete** (S-01–S-13, June 2026). Validation gate: `npm run validate:contacts-phase1`. Deferred: merge UI, historical backfill, venue rental derivation, segmentation.

**Directory module (August 2026)** — User-facing Contacts sidebar is now **Directory**. Canonical table remains `contacts`. Overview, People, Families, Organizations, Reports, and Settings are always visible. Giving groups are not a Directory section — they live under Fund Development (Group Giving). Most role views (Employees, Volunteers, Members, Donors, Sponsors, Parents, Vendors, Childcare Providers, Rental Customers) appear only when the current tenant has records. **Service Providers** is always listed (contractors such as plumbers and pest control, distinct from Vendor Hub). Role views show lightweight lookup columns; operational work stays in Workforce / Fund Development / Membership / Vendor Hub / Venue Rentals. Membership add searches Directory first. Sponsor is a manual role on the same contact (`269`). Routes: `/directory/*` with redirects from `/contacts/*` and `/resources/service-providers`.

**Contacts security remediation (RLS wave 1)** — **G6 complete** (June 2026). M6b gate alignment + CR-8 harness shipped. M4 (`111`) **authorized for staging** after `109`–`110` applied. Validation: `npm run validate:contacts-g6`.

**Contact profile homepage Phase 2** — Overview right rail (Quick Actions, Financial Summary, Activity) in place (July 2026). **Financial** tab redesigned to homepage-style KPIs, chart, sub-tabs, and right rail (July 2026).

**Organization Master Calendar (planning only, July 2026)** — Org-wide collaboration calendar (visibility across departments; external/online/manual items). **Not** the Facilities room calendar. Vision: `docs/organization-master-calendar-vision.md`. Do not implement until explicitly requested.

**Community Calendar (August 2026)** — Shared top-level `/community-calendar` for public/community-visible bazaars + Event Management events. Enabled when Vendor Hub and/or Event Management is on. Distinct from Facilities Calendar and Events Master Calendar.

**Public Program Catalog (August 2026)** — No-login browse at `/o/[orgSlug]/programs` (programs with `visibility = public` only). Same offering cards/filters as staff/customer catalog; register via `/join/[orgSlug]?next=…`.

**Public Community Calendar (August 2026)** — No-login browse at `/o/[orgSlug]/community-calendar` (events/bazaars with calendar status `published` only). Featured upcoming event, event-type category circles, All/Today/This weekend tabs, 4-up cards; ticketed events open `/o/[orgSlug]/events/[id]`.

**Event Workspace redesign (August 2026)** — Progressive event tabs (registration / staff / youth / vendors / finance / reports) driven by `workspace_features` + attendance mode. Expenses ledger (`event_expenses`). Public event checkout (Stripe Connect when ready) + customer **My Tickets** + event documents + staff Stripe ticket refunds (including partials) + youth forms/waivers + `events.checkin` door-staff permission. Run SQL **`252_event_workspace_redesign.sql`**, **`253_event_youth_checkin_waitlist.sql`**, **`254_event_documents.sql`**, **`255_ticket_order_stripe.sql`**, **`256_customer_ticket_order_rls.sql`**, **`257_events_checkin_permission.sql`**, **`258_ticket_order_refunded_amount.sql`**, **`259_youth_waiver_forms.sql`**.

**Fund Development campaign workspace Phase A (August 2026)** — Campaign detail is a tabbed workspace (Overview / Strategy / Prospects / Pledges / Donations / Groups). One campaign goal (`goal_amount`); Goal Breakdown phases retired (`scripts/270_disable_campaign_goal_phases.sql`). Committed/Collected/Outstanding overview. Migration **`260_campaign_phases.sql`** is historical.

**Fund Development strategy ask levels Phase B (August 2026)** — Campaign → Strategy gift chart (`campaign_ask_levels`). Migration **`261_campaign_ask_levels.sql`**. Prospects tab still pending.

**Fund Development prospects Phase C (August 2026)** — Campaign → Prospects pipeline/assignments (`campaign_prospects`). Staff stage options: Identified (default), Contacted, Pledged, Declined, No Response. Migration **`262_campaign_prospects.sql`**. Prospect→pledge conversion linking is Phase D.

**Fund Development prospect conversion Phase D (August 2026)** — Record Pledge from prospect fully creates one ledger pledge (including wishlist item) on the Prospects tab; links `converted_pledge_id` / `campaign_prospect_id`; suggested ask preserved.

**Fund Development campaign groups Phase E (August 2026)** — Campaign → Groups with donation tokens (`/donate/g/{token}`), copy-link and copy-QR icons. Group goals are not set in the UI. Migration **`263_campaign_groups.sql`**.

**Fund Development public group checkout Phase F (August 2026)** — Guest Stripe Checkout on group links; webhook writes payment with `campaign_id` + `campaign_group_id`. Migration **`264_campaign_group_checkout.sql`**.

**Fund Development overview insights Phase G (August 2026)** — Campaign Overview Action Required + team summary + groups rollup; Contact Financial Fund Development history (`donations.view`). No new migration.

**Fund Development follow-ups (August 2026)** — Granular permissions (`265_donations_granular_permissions.sql`); Campaign Performance includes campaign groups reporting; public group pledge modes with `pledge_id` on checkout/payment.

**Fund Development group recurring + FD emails (August 2026)** — Recurring gifts on `/donate/g/{token}`; group pledge confirmation emails; daily prospect follow-up assignee digests. Migration **`266_group_recurring_and_fd_emails.sql`**. Cron: `/api/cron/prospect-follow-up-reminders`.

**Fund Development IA redesign (August 2026)** — Sidebar: Overview / Campaigns / Pledges / **Donations** / Reports / Settings. Operations under `/donations/payments/*`; analytics landing at `/donations/reports`. Transactions/Giving Summary date range + export; receipts Missing queue; year-end KPIs from annual statements. No schema change.

**Fund Development campaign wishlist (August 2026)** — Campaign → Wishlist tab. Sub-goals linked to existing pledges/payments via nullable `wishlist_item_id`. Public donate `/donate/w/{token}`. Carry-forward without duplicating money. Migration **`267_campaign_wishlist.sql`**.

---

## People Management Module

Display name: **People Management** (database module slug remains `hr`).

Label constant: `lib/hr/hr-module-label.ts` → `PEOPLE_MANAGEMENT_MODULE_LABEL`

Routes remain under `/hr/*` / `/workforce/*` for now. Application submissions live on each category’s Applications view (not a Settings hub):

* Employment → `/workforce?tab=employees&view=applications`
* Volunteer → `/workforce?tab=volunteers&view=applications` (customer apply: `/customer/apply/volunteer`)
* Childcare → `/workforce?tab=childcare&view=applications` (customer apply: `/customer/apply/childcare`)
* Committee → `/membership/applications`

Sidebar (HR):

* Overview → `/workforce` (drawer + in-page tabs: Employees, Volunteers, Childcare Providers). Path sections: `/workforce/departments`, `/workforce/employees`, `/workforce/volunteers`, `/workforce/childcare`. Employees includes Positions (`?view=positions`). Org payroll queue is **Programs/ Events → Reports → Payroll** (`/finance/payroll`); legacy `/workforce?tab=payroll` redirects there. Sidebar: **Programs/ Events** merges Workforce, Programs, Financial Assistance, Event Management, and Reports. Legacy `/workforce?tab=…` redirects to the matching path. Legacy `/reports` redirects to **Reports → Transactions**.
* Discount Policies → `/hr/settings` (Membership Benefits redirect path may apply). Department **list** is Overview → Departments (`/workforce?tab=departments`); department **workspace** remains `/workforce/departments/[id]` (**department-level:** Overview, Programs, Schedule [Class times / Activity planner; CTAs to Facilities + Master Calendar], Financial [Employees / Payroll / Expenses / Financial Summary — open years], **Reports** [year/season filter], Group giving when linked, Events `?tab=activity`, Settings; **year-level** `?year=`: Overview, Offerings, Registrations [Applications / Approved / Registrations]). **Department Heads** open the workspace from Staff Tools (**My department**) or a sidebar **My department** link when they lack org-wide HR (`staff.view`). SaaS **Billing** stays in the footer.

**Finance** sidebar module (`finance`): Transactions (`/finance/transactions`), Payroll (`/finance/payroll`), Financial Assistance (`/finance/financial-assistance`). Enable with `scripts/192_finance_module_sidebar_restore.sql`.

Membership sidebar includes **Groups** (`/membership/groups` — member groups / former HR Teams). Giving collectives are under Donations (`/donations/groups/[id]`, Group Giving report) — badge can link a collective to a Membership Group or Department, otherwise **Group Donation**.

Employees, Volunteers, and Childcare Providers use a shared directory UI (`HrDirectoryShell`): roster | Applications (Positions on Employees), KPI cards, Active/Inactive status filter (default Active), export, and pagination. Adding employees/volunteers is contact-first (search Contacts; create contact first if missing).

Other modules link to Applications with filters:

* Vendor Hub → `/applications/all?application_type=vendor`
* Finance → Financial Assistance
* Employment applications → `/workforce?tab=employees&view=applications`
* Committee applications → `/membership/applications`
