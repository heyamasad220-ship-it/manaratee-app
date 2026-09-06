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

* Super Admin (created automatically for each new organization; invites Admins)
* Admin (created automatically; invited by Super Admin)
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
**Programs Home (August 2026)** — Sidebar **Programs** is a single item (no Academic/Seasonal flyout). Home `/programs` is titled **Overview** (breadcrumb `Dashboard > Programs > Overview`) with colored whole-card links and no module tabs. Nested pages keep **Programs** in the breadcrumb pointing at `/programs`. Reports and Finance keep their own secondary tab bars. The Programs list (`/programs/list`) lists years/seasons with an Academic or Seasonal tag; each card stacks department, dates, offering count, and total enrolled. Filters: search, department, type, status (default Active; Closed and Archived via Status). **New Program** opens Quick Create (`/programs/create`). Clicking a program opens `/programs/[id]` in the Programs module. That workspace Overview is a compact health dashboard (KPIs, needs attention, offerings preview, financial summary, recent activity). Department workspaces stay about the department; their Programs tab is a filtered doorway. Offering overview can **Move** a student to another offering in the same year/season without cancelling the enrollment.
**QIL historical years (August 2026)** — Payment export loaded into closed **QIL 2022-2023 / 2023-2024 / 2024-2025**. **QIL 2025-2026** unchanged. **QIL 2026-2027** received only new Stripe payments matched to existing offerings. Script: `scripts/import-qil-historical-payments.mjs`. **QIL 2024-2025** later gained missing students from `QIL24-25.csv` (`scripts/import-qil-2024-2025-gap.mjs`).
**Deferred naming (parked — high blast radius):** (1) DB rename `programs`→`seasons`, `program_offerings`→`programs` (fits years, seasons, camps); (2) align HR sidebar vs `/workforce/*` routes/folders; (3) Donations module → Fund Development in DB/routes (UI label already Fund Development). Do not start without a dedicated migration plan. Details in `docs/Features.md`.
Registrations
Financial Assistance
**Programs flexibility contract** — **F1–F7** (`180`–`181`). Academic vs Seasonal modes + org `program_kinds` entitlement (SQL **`246`**); packaging UI on Platform Admin (toggles under Programs) + Billing dropdown (Phase 6). Report Type filters + URL `?kind=` presets (Phases 3–4); kind-aware staff terminology (Phase 5). See [`docs/programs-flexibility-contract.md`](./programs-flexibility-contract.md).
**Stripe Connect Express** for org donation payouts (implemented June 2026)
**Platform subscription billing via Stripe** (orgs paying Manaratee — pending). Module prices and billed cents are stored now (`274`); do not create Stripe subscriptions until that work is scheduled. Super Admin `/admin/modules` and organization sheets scroll in the main column / sheet body so prices, discounts, and the SQL 274 reminder stay reachable.
Customer Experience
User Invitations
**Contacts Phase 1 — identity linkage + affiliation sync** — **Complete** (S-01–S-13, June 2026). Validation gate: `npm run validate:contacts-phase1`. Deferred: merge UI, historical backfill, venue rental derivation, segmentation.

**Directory module (August 2026)** — User-facing Contacts sidebar is **Directory**. Canonical table remains `contacts`. Overview, People, Families, Organizations, Reports, and Settings are always visible. Giving groups are not a Directory section — they live under Fund Development (Group Giving). Directory role flyouts keep CRM lookups (Members, Sponsors, Parents, Vendors, Rental Customers) when the tenant has records. **Donors** and Administration-owned roles (Employees, Volunteers, Childcare Providers, Service Providers) are omitted from Directory nav; operational work stays in Administration / Fund Development. Membership add searches Directory first. Sponsor is a manual role on the same contact (`269`). Routes: `/directory/*` with redirects from `/contacts/*` and `/resources/service-providers`.

**Contacts security remediation (RLS wave 1)** — **G6 complete** (June 2026). M6b gate alignment + CR-8 harness shipped. M4 (`111`) **authorized for staging** after `109`–`110` applied. Validation: `npm run validate:contacts-g6`.

**Contact profile homepage Phase 2** — Overview right rail (Quick Actions, Financial Summary, Activity) in place (July 2026). **Financial** tab redesigned to homepage-style KPIs, chart, sub-tabs, and right rail (July 2026).

**Organization Master Calendar (planning only, July 2026)** — Org-wide collaboration calendar (visibility across departments; external/online/manual items). **Not** the Facilities room calendar. Vision: `docs/organization-master-calendar-vision.md`. Do not implement until explicitly requested.

**Community Calendar (August 2026)** — Shared top-level `/community-calendar` for public/community-visible bazaars + Event Management events. Included automatically with **Vendor Hub** or **Event Management** (not a separate SKU). Distinct from Facilities Calendar and Events Master Calendar.

**Vendor Hub Overview (August 2026)** — Sidebar **Overview** at `/vendor-hub` combines org health KPIs with the former Reports Overview snapshot. Reports tabs are Vendor Sales, Booth Performance, and Participation History (`/vendor-hub/reports?tab=history`). `/vendor-hub/network/history` redirects.

**Public Program Catalog (August 2026)** — No-login browse at `/o/[orgSlug]/programs` (programs with `visibility = public` only). Offering cards/filters match the customer catalog; staff Programs → Offerings is a separate admin table over the same records. Register via `/join/[orgSlug]?next=…`.

**Public Community Calendar (August 2026)** — No-login browse at `/o/[orgSlug]/community-calendar` (events/bazaars with calendar status `published` only). Featured upcoming event, event-type category circles, All/Today/This weekend tabs, 4-up cards; ticketed events open `/o/[orgSlug]/events/[id]`.

**Education historical enrollments import (August 2026)** — `EducationPrograms.xlsx` + `EduPrograms2.csv` loaded as year programs under Education (Sunday School, QLH, Saturday Arabic, Kids Saturday Arabic, QIJ, Companion of the Quran) plus a new **Istiqamah Institute** department. People and enrollments only; skipped existing QLH 2024–26 / Sunday School 2026–27. Script: `scripts/import-edu-historical-enrollments.mjs`.

**Historical camp enrollments import (September 2026)** — `Camp_Enrollment_Growth.xlsx` loaded as closed seasonal Recreational Camps programs (2022–2026). People and enrollments only; 2026 Camp One/Two skipped because they already live on Summer Camp 2026. Script: `scripts/import-camp-enrollments-historical.mjs`. Camp household history: Programs → Reports → **Camp enrollment**.

**Programs year comparison report (August 2026)** — Programs → Reports → **Year comparison**: enrollment growth by program series and department (unique participants/families, new vs returning, participant line chart). Year/program names open the program workspace (a shared year opens the largest program). Same report on Program Workspace → Reports → **Year comparison**. Department Overview reuses the latest-year family counts and the enrollment line chart only. Route `/programs/reports/year-comparison`.

**TicketOrders.csv Event Management import (August 2026)** — Eventbrite `TicketOrders.csv` loaded into Event Management for MAS Dallas (6,457 orders / 11,989 tickets / $516,377.91). Vendors, QLH/QIL/Sunday School, and donation/fee lines skipped. Crystal Banquet tickets attached to the existing Annual Fundraising Dinner. Script: `scripts/import-ticket-orders-csv.mjs`.

**Ticketing Events categories (August 2026)** — Event Management → **Events** includes Overview sales columns on ticketed rows, a row Category dropdown, and a category filter (`ticketing_event_categories`). Overview includes ticket sales KPI cards. Manage categories under Event Management → Settings → Categories. Run **`scripts/287_ticketing_event_categories.sql`**.

**Event Workspace redesign (August 2026 / September 2026)** — Progressive event tabs (orders / staff / youth / vendors / finance / reports / settings) driven by `workspace_features` + attendance mode (`paid` / `free`). Ticket setup is **Settings → Tickets**. Flyer, description, event details, and Community Calendar are **Settings → General**. Workspace tabs and Overview KPIs stay pinned. Expenses ledger (`event_expenses`). Public event checkout (Stripe Connect when ready) + customer **My Tickets** + event documents + staff Stripe ticket refunds (including partials) + youth forms/waivers + `events.checkin` door-staff permission. Run SQL **`252_event_workspace_redesign.sql`**, **`253_event_youth_checkin_waitlist.sql`**, **`254_event_documents.sql`**, **`255_ticket_order_stripe.sql`**, **`256_customer_ticket_order_rls.sql`**, **`257_events_checkin_permission.sql`**, **`258_ticket_order_refunded_amount.sql`**, **`259_youth_waiver_forms.sql`**.

**Fund Development campaign workspace Phase A (August 2026)** — Campaign detail is a tabbed workspace (Overview / **Event** / Fundraising Plan / Pledges / Donations / Sponsorship / Groups / Wishlist). Event tab added September 2026 for the same `internal_events` record used by Event Management. Fundraising Plan contains Strategy | Prospects. One campaign goal (`goal_amount`); Goal Breakdown phases retired (`scripts/270_disable_campaign_goal_phases.sql`). Committed/Collected/Outstanding overview. Migration **`260_campaign_phases.sql`** is historical.

**Fund Development strategy ask levels Phase B (August 2026)** — Campaign → Fundraising Plan → Ask Strategy gift chart (`campaign_ask_levels`). Migration **`261_campaign_ask_levels.sql`**.

**Fund Development prospects Phase C (August 2026)** — Campaign → Fundraising Plan → Prospects pipeline/assignments (`campaign_prospects`). Staff stage options: Identified (default), Contacted, Pledged, Declined, No Response. Migration **`262_campaign_prospects.sql`**. Prospect→pledge conversion linking is Phase D.

**Fund Development prospect conversion Phase D (August 2026)** — Record Pledge from a donation prospect fully creates one ledger pledge (including wishlist item) on the Prospects tab; links `converted_pledge_id` / `campaign_prospect_id`; suggested ask preserved.

**Fund Development unified prospects + sponsorships (August 2026)** — Prospects tracks donation and sponsorship outreach (`ask_type`, activity history, event/package for sponsorship asks). Committed sponsorships are first-class `campaign_sponsorships` records (not donations). Campaign **Sponsorship** tab includes **Sponsors | Packages**. Packages are campaign-owned (`scripts/285_campaign_sponsorship_packages.sql`). Migrations **`284_campaign_sponsorship_prospects.sql`**, **`285_campaign_sponsorship_packages.sql`**.

**Fund Development Fundraising Plan nav (August 2026 / September 2026)** — Campaign workspace combines Strategy and Prospects under **Fundraising Plan** (`?tab=plan` with **Strategy | Prospects**; `section=prospects` for Prospects). Workspace tabs stay pinned on every campaign tab. Ask strategy KPIs stay pinned with those tabs. Overview Campaign Goal cards stay pinned the same way. Ask Strategy remains donation gift levels only; sponsorship packages stay under Sponsorship → Packages. Clicking a Prospects/Asked count on an ask-level row opens Prospects filtered to that donation ask level. Legacy `?tab=strategy` and `?tab=prospects` redirect to the new URLs.

**Campaign Event + Ticketing Check-in (September 2026)** — Campaign workspace **Event** tab lists the linked Event Management record (`ticketing_config.linkedCampaignId`); the row opens the event workspace. Pinned KPIs show that event’s ticket sales by type, remaining seats, check-ins, and ticket revenue. Create/attach stay on that tab when none is linked. Orgs subscribed to Fund Development but not Event Management see a professional subscribe message (Contact Manaratee). Event Management **Check-in** (`/event-management/check-in`) is the org-wide door desk for every ticketed event (campaign, department, or Event Management): phone camera QR, computer type-a-code. No second ticket system. Ticketing is not a separate sidebar item.

**Event create + optional approval (September 2026)** — Create event no longer navigates to Facilities. On-site events link out to the facility calendar to check space, then staff come back to finish. **Approval required** is an Event Management Settings toggle (off by default) and applies only to on-site events. Status menu is Draft / Pending / Live / Completed / Cancelled (no Approved tag). SQL **`291_event_management_settings.sql`**.

**Fund Development campaign groups Phase E (August 2026)** — Campaign → Groups with donation tokens (`/donate/g/{token}`), copy-link and copy-QR icons. Group goals are not set in the UI. Migration **`263_campaign_groups.sql`**.

**Fund Development public group checkout Phase F (August 2026)** — Guest Stripe Checkout on group links; webhook writes payment with `campaign_id` + `campaign_group_id`. Migration **`264_campaign_group_checkout.sql`**.

**Fund Development overview insights Phase G (August 2026)** — Campaign Overview Action Required + team summary + groups rollup; Contact Financial Fund Development history (`donations.view`). No new migration.

**Fund Development follow-ups (August 2026)** — Granular permissions (`265_donations_granular_permissions.sql`); Campaign Performance includes campaign groups reporting; public group pledge modes with `pledge_id` on checkout/payment.

**Fund Development group recurring + FD emails (August 2026)** — Recurring gifts on `/donate/g/{token}`; group pledge confirmation emails; daily prospect follow-up assignee digests. Migration **`266_group_recurring_and_fd_emails.sql`**. Cron: `/api/cron/prospect-follow-up-reminders`.

**Fund Development IA redesign (August 2026)** — Sidebar: Overview / Campaigns / Pledges / **Donations** / Reports / Settings. Operations under `/donations/payments/*`; analytics landing at `/donations/reports`. Transactions/Giving Summary date range + export; receipts Missing queue; year-end KPIs from annual statements. No schema change.

**Org Super Admin / Admin + Settings Users (August 2026)** — Each org auto-creates Super Admin and Admin (`scripts/271_org_system_roles_and_platform_admin.sql`). Platform admin is not an org Super Admin; support rows are flagged `platform_support_access` (`scripts/272_hide_platform_admin_org_memberships.sql`). Invite/magic-link prefers the invited org when a person belongs to more than one tenant. Settings → Users / Roles load on the server. Public join URLs live on Settings → Links.

**Work emails (August 2026 / September 2026)** — Staff Users logins can be assigned to a Directory person (`organization_members.assigned_contact_id`, SQL **`288`**). Personal email on the contact is never transferred. Employee drawer has a typed work email field (assign existing login or invite + assign); check **Department Head (Director)** there. Leaving a department or marking inactive unassigns the mailbox. Work logins have Staff Tools / admin without a personal portal; personal logins keep My Account and lose employee-role Staff Tools while a work email is assigned to that person.

**Program Lead (September 2026)** — `programs.lead_contact_id` (SQL **`290`**). One person per year/season opens that program workspace and all of its offerings without org-wide `programs.view`. Set on Settings → General. Sidebar **My program** / Staff Tools cards follow the same pattern as Department Head. Camp multi-offering group leads stay Coordinator (or Primary instructor) on each offering.

**Fund Development campaign wishlist (August 2026)** — Campaign → Wishlist tab. Sub-goals linked to existing pledges/payments via nullable `wishlist_item_id`. Public donate `/donate/w/{token}`. Carry-forward without duplicating money. Migration **`267_campaign_wishlist.sql`**.

**Campaign same-organization FKs (September 2026)** — Composite `(campaign_id, organization_id)` FKs on campaign children plus same-org triggers on ledger campaign/wishlist links. Service role bypasses RLS; these constraints keep tenants from sharing a campaign UUID. SQL **`292_campaign_same_organization_fks.sql`**.

**Canonical Pledge Details window (August 2026)** — Staff add/edit/collect/remind/delete pledges from one dialog (`components/donations/pledge-details-dialog.tsx`) on Pledges, campaign workspace, prospects, and contact Financial. Customer portal unchanged.

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

* Overview → `/workforce` (drawer + in-page tabs: Employees, Volunteers, Childcare Providers). Path sections: `/workforce/departments`, `/workforce/employees`, `/workforce/volunteers`, `/workforce/childcare`. Employees includes Positions (`?view=positions`). Org payroll queue is **Programs → Reports → Payroll** (`/finance/payroll`); legacy `/workforce?tab=payroll` redirects there. Sidebar: **Administration** owns Departments / Employees / Volunteers / Childcare / Service Providers. **Programs** and **Event Management** are separate rail items. Legacy `/workforce?tab=…` redirects to the matching path. Legacy `/reports` redirects to **Reports → Transactions**.
* Discount Policies → `/hr/settings` (Membership Benefits redirect path may apply). Department **list** is Overview → Departments (`/workforce?tab=departments`); department **workspace** remains `/workforce/departments/[id]` (**department-level:** Overview [KPI row including families returning/new + enrollment chart; active programs list; **View all programs** includes closed], Programs [summary doorway], Events `?tab=activity`, Group giving when linked, Financial [sticky combined KPIs, then Employees / Payroll / Expenses / Financial Summary], Settings). **Schedule** (Class times Week Board / List / Activity planner; CTAs to Facilities + Master Calendar) is on Program Workspace `/programs/[id]?tab=schedule`. **Finance** (`?tab=finance`: Transactions | Payment Summary | Add-ons) and **Reports** (`?tab=reports`: Overview | Trends | Year comparison | Attendance) on that workspace are already filtered to the open program. Program management is `/programs/[id]` in the Programs module. **Department Heads** open the workspace from Staff Tools (**My department**) or a sidebar **My department** link when they lack org-wide HR (`staff.view`). They log in with a work email when one is assigned (Settings → Users → Assign person); do not send invitations from this setup. They can edit everything for that department only (same department tools, plus that department’s programs/offerings/registrations/payments/events). They do not get org-wide Programs, Finance, or the Departments list. **Program Leads** open one year/season from Staff Tools (**My program**) or a sidebar **My program** link when they lack `programs.view` and are not already using **My department**. SaaS **Billing** stays in the footer.

**Finance** is not a sellable module. Billing, payroll, and financial assistance ride with **Programs** (`finance` slug stays in the database as a capability). Transactions (`/finance/transactions`), Payroll (`/finance/payroll`), and Financial Assistance (`/finance/financial-assistance`) still use those routes. **Facilities** (`spaces`) is also not a SKU — it is included with Programs, Event Management, Venue Rentals, and Vendor Hub, not Membership or Fund Development. **Community Calendar** is included with Vendor Hub or Event Management. SQL **`273_subscription_modules_match_staff_nav.sql`** (after `192`).

Membership sidebar includes **Groups** (`/membership/groups` — member groups / former HR Teams). Giving collectives are under Donations (`/donations/groups/[id]`, Group Giving report) — badge can link a collective to a Membership Group or Department, otherwise **Group Donation**.

Employees, Volunteers, and Childcare Providers use a shared directory UI (`HrDirectoryShell`): roster | Applications (Positions on Employees), KPI cards, Active/Inactive status filter (default Active), export, and pagination. Adding employees/volunteers is contact-first (search Directory; **Add employee** can create a person from the dialog if they are missing).

Other modules link to Applications with filters:

* Vendor Hub → `/applications/all?application_type=vendor`
* Finance → Financial Assistance
* Employment applications → `/workforce?tab=employees&view=applications`
* Committee applications → `/membership/applications`
