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
Registrations
Financial Assistance
**Programs flexibility contract** — **F1–F7** (`180`–`181`). See [`docs/programs-flexibility-contract.md`](./programs-flexibility-contract.md).
**Stripe Connect Express** for org donation payouts (implemented June 2026)
**Platform subscription billing via Stripe** (orgs paying Manaratee — pending)
Customer Experience
User Invitations
**Contacts Phase 1 — identity linkage + affiliation sync** — **Complete** (S-01–S-13, June 2026). Validation gate: `npm run validate:contacts-phase1`. Deferred: merge UI, historical backfill, venue rental derivation, segmentation.

**Contacts security remediation (RLS wave 1)** — **G6 complete** (June 2026). M6b gate alignment + CR-8 harness shipped. M4 (`111`) **authorized for staging** after `109`–`110` applied. Validation: `npm run validate:contacts-g6`.

**Contact profile homepage Phase 2** — Overview right rail (Quick Actions, Financial Summary, Activity) in place (July 2026). **Financial** tab redesigned to homepage-style KPIs, chart, sub-tabs, and right rail (July 2026).

---

## People Management Module

Display name: **People Management** (database module slug remains `hr`).

Label constant: `lib/hr/hr-module-label.ts` → `PEOPLE_MANAGEMENT_MODULE_LABEL`

Routes remain under `/hr/*` / `/workforce/*` for now. Application submissions live on each category’s Applications view (not a Settings hub):

* Employment → `/workforce/employees?tab=applications`
* Volunteer → `/workforce/volunteers?tab=applications`
* Childcare → `/workforce/childcare?tab=applications`
* Committee → `/membership/applications`

Sidebar (People Management / HR):

* Overview → `/workforce`
* Employees
* Volunteers
* Child Care
* Reports
* Settings → `/hr/settings` (Discount Policies only); HR org settings at `/workforce/settings` (Positions, Application Templates). **Departments** lives under **Programs** in the sidebar (`/workforce/departments`: Overview, Employees, Rosters, Offerings, Schedule, Payroll, Financial Summary, Reports for archived years; Group giving when a donations group is linked; Activity = department events not individual gifts).

Membership sidebar includes **Groups** (`/membership/groups` — member groups / former HR Teams). Giving collectives are under Donations (`/donations/groups/[id]`, Group Giving report) — badge can link a collective to a Membership Group or Department, otherwise **Group Donation**.

Employees, Volunteers, and Childcare Providers use a shared directory UI (`HrDirectoryShell`): roster | Applications | Archived, KPI cards, export, and pagination. Adding employees/volunteers is contact-first (search Contacts; create contact first if missing).

Other modules link to Applications with filters:

* Vendor Hub → `/applications/all?application_type=vendor`
* Programs → Financial Assistance filter
* Employment applications → `/workforce/employees?tab=applications`
* Committee applications → `/membership/applications`
