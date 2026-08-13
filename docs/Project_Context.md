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

**Contacts security remediation (RLS wave 1)** — **G6 complete** (June 2026). M6b gate alignment + CR-8 harness shipped. M4 (`111`) **authorized for staging** after `109`–`110` applied. Validation: `npm run validate:contacts-g6`.

**Contact profile homepage Phase 2** — Overview right rail (Quick Actions, Financial Summary, Activity) in place (July 2026). **Financial** tab redesigned to homepage-style KPIs, chart, sub-tabs, and right rail (July 2026).

**Organization Master Calendar (planning only, July 2026)** — Org-wide collaboration calendar (visibility across departments; external/online/manual items). **Not** the Facilities room calendar. Vision: `docs/organization-master-calendar-vision.md`. Do not implement until explicitly requested.

**Community Calendar (August 2026)** — Shared top-level `/community-calendar` for public/community-visible bazaars + Event Management events. Enabled when Vendor Hub and/or Event Management is on. Distinct from Facilities Calendar and Events Master Calendar.

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
