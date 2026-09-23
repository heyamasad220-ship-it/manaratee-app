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

Profile → **Applications** (Vendor / Volunteer / Childcare) follows org modules: Volunteer and Childcare need Programs or Event Management; Vendor needs Vendor Hub. Fund Development–only orgs do not see this submenu. Profile → **Family** closes Add Family Member after the first Add Member click and blocks a duplicate with the same name, gender, birth date, and relationship.

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

**Sign Ups (September 2026)** — Top-level **Sign Ups** menu (Overview, Notifications, Reports, Settings) when Vendor Hub or Event Management is on. Overview lists events that need volunteers. Reports lists every signup. Each event and bazaar has a **Volunteers** tab (times, slots, and that event’s signups). Bazaar Volunteers is always available; the bazaar is listed on Overview after slots are saved. Notifications and Settings are next.

**Ticketing under Event Management (September 2026)** — Flyout item **Ticketing** with tabs Overview, Events (ticketed only), Orders, Check-in, Settings. Categories and checkout defaults live on Ticketing Settings. Event workspace has no Orders tab. Check-in is only under Ticketing.
**Event workspace Overview (September 2026)** — Event name is a blue link that opens the create/edit booking form on the same page. Overview KPIs: Type, Schedule, Location, Childcare, Volunteers, Vendors (Needed / Not needed).
**Facilities Calendar list view (September 2026)** — `/facilities/calendar` has Day, Grid, and List. List is an agenda grouped by date with time, space, holder, title, and PoC. Click the start date and end date separately to choose a custom range (`?endDate=`). **Create event** on this calendar goes to today’s Day view; click an empty slot to open the form.
**Event Management source of truth (September 2026)** — Event Management, campaigns, and department Events share one UUID on `internal_events`. SQL **`300_event_management_source_of_truth.sql`**.
**Bazaars live in Vendor Hub (September 2026)** — Bazaars are not Event Management workspaces. On-site bazaars hold a facility space; published bazaars can list on Community Calendar. SQL **`305_bazaar_owned_internal_events.sql`**.
**Events list (September 2026)** — One-time and Recurring tabs. Recurring shows one row per series (name, department, schedule, next meeting). Create/edit can be One-time, a repeating Recurring rule, or Custom dates (still Recurring). Edit switching one-time ↔ recurring opens the matching tab. Requester Contact / Phone / Email columns (toggle with Columns); Actions three-dot menu for Copy and Delete. Upcoming list is soonest-first; searching a Recurring series shows KPI cards (remaining recurrences, schedule, time).
**Internal Events Google Form import (September 2026)** — 31 one-time MAS Dallas requests from `InternalEvents.xlsx` loaded into Event Management (departments CYP / Scouts / Dawah Outreach and six new rooms created; requesters as Directory coordinators). Recurring programs and Other skipped. Script: `scripts/import-internal-events-xlsx.mjs`.
**Public recurring gatherings (September 2026)** — Learn Love Live Quran, Thursday Halaqa for Ladies, Tuesday Night Live, Crochet Clique, and Men Talk imported as Event Management meeting dates (walk-in, no signup). Public series listed on Community Calendar. Her Space still needs dates. Script: `scripts/import-internal-events-recurring-public.mjs`.
**MUHSEN / Sabiqoon / Men in the Making (September 2026)** — MUHSEN Sunday School 2026-2027 added as an Education program with registration and payments. Sabiqoon and Men in the Making added as public walk-in Event Management series (Community Calendar). Script: `scripts/import-muhsen-sabiqoon-men-in-the-making.mjs`.

People Management module
Unified Applications engine
Programs Module
**Programs Home (August 2026 / September 2026)** — Sidebar **Programs** opens a flyout: **Overview**, **All programs**, **Registrations**, **Finance**, **Financial Assistance**, **Reports**, **Settings**. Home `/programs` is titled **Overview** (breadcrumb `Dashboard > Programs > Overview`) with Programs and Offerings KPI cards only. Nested pages keep **Programs** in the breadcrumb pointing at `/programs`. Reports and Finance keep their own secondary tab bars. The Programs list (`/programs/list`) is **All programs** with an Academic or Seasonal tag; each card stacks department, dates, offering count, and total enrolled. Filters: search, department, type, status (default Active; Closed and Archived via Status). **New Program** opens Quick Create (`/programs/create`). Clicking a program opens `/programs/[id]` in the Programs module. That workspace Overview is a compact health dashboard (KPIs, needs attention, financial summary, recent activity). Offerings are listed on the Offerings tab. Department workspaces stay about the department; their Programs tab is a filtered doorway. Offering overview can **Move** a student to another offering in the same year/season without cancelling the enrollment.
**QIL 2026–2027 final roster (September 2026)** — `QI-FinalList.xlsx` + `QI-Payments0915.csv` imported onto year **`QIL 2026-2027`**. Canonical enrolled roster; names not on the list cancelled. Script: `scripts/import-qil-final-2026-2027.mjs`.
**QIL historical years (August 2026)** — Payment export loaded into closed **QIL 2022-2023 / 2023-2024 / 2024-2025**. **QIL 2025-2026** unchanged. **QIL 2026-2027** received only new Stripe payments matched to existing offerings. Script: `scripts/import-qil-historical-payments.mjs`. **QIL 2024-2025** later gained missing students from `QIL24-25.csv` (`scripts/import-qil-2024-2025-gap.mjs`).
**Deferred naming (parked — high blast radius):** (1) DB rename `programs`→`seasons`, `program_offerings`→`programs` (fits years, seasons, camps); (2) align HR sidebar vs `/workforce/*` routes/folders; (3) Donations module → Fund Development in DB/routes (UI label already Fund Development). Do not start without a dedicated migration plan. Details in `docs/Features.md`.
Registrations
Financial Assistance
**Programs flexibility contract** — **F1–F7** (`180`–`181`). Academic vs Seasonal modes + org `program_kinds` entitlement (SQL **`246`**); packaging UI on Platform Admin (toggles under Programs). Report Type filters + URL `?kind=` presets (Phases 3–4); kind-aware staff terminology (Phase 5). See [`docs/programs-flexibility-contract.md`](./programs-flexibility-contract.md).
**Stripe Connect Express** for org donation payouts (implemented June 2026)
**Platform subscription billing via Stripe** (orgs paying Manaratee — pending). Module prices and billed cents are stored now (`274`); do not create Stripe subscriptions until that work is scheduled. Super Admin `/admin/modules` and organization sheets scroll in the main column / sheet body so prices, discounts, and the SQL 274 reminder stay reachable.
Customer Experience
**Customer portal home and Donations (September 2026)** — `/customer/dashboard` is the modular customer home (welcome header + module-aware previews). Fund Development currently contributes giving summary, pledge attention, up to 2 featured campaigns, and recent activity from existing payments/pledges. `/customer/donation` Giving Opportunities shows Donation Options only (campaign cards stay on the Dashboard). Campaigns have no featured-flag column yet.
User Invitations
**Contacts Phase 1 — identity linkage + affiliation sync** — **Complete** (S-01–S-13, June 2026). Validation gate: `npm run validate:contacts-phase1`. Deferred: merge UI, historical backfill, venue rental derivation, segmentation.

**Directory module (August 2026)** — User-facing Contacts sidebar is **Directory**. Canonical table remains `contacts`. Overview, People, Families, Organizations, Reports, and Settings are always visible. Giving groups are not a Directory section — they live under Fund Development (Group Giving). Directory role flyouts keep CRM lookups (Members, Sponsors, Parents, Vendors, Rental Customers) when the tenant has records. **Donors** and Administration-owned roles (Employees, Volunteers, Childcare Providers, Service Providers) are omitted from Directory nav; operational work stays in Administration / Fund Development. Membership add searches Directory first. Sponsor is a manual role on the same contact (`269`). Routes: `/directory/*` with redirects from `/contacts/*` and `/resources/service-providers`.

**Contacts security remediation (RLS wave 1)** — **G6 complete** (June 2026). M6b gate alignment + CR-8 harness shipped. M4 (`111`) **authorized for staging** after `109`–`110` applied. Validation: `npm run validate:contacts-g6`.

**Contact profile homepage Phase 2** — Overview right rail (Quick Actions, Financial Summary, Activity) in place (July 2026). **Financial** tab redesigned to homepage-style KPIs, chart, sub-tabs, and right rail (July 2026).

**Organization Master Calendar (planning only, July 2026)** — Org-wide collaboration calendar (visibility across departments; external/online/manual items). **Not** the Facilities room calendar. Vision: `docs/organization-master-calendar-vision.md`. Do not implement until explicitly requested.

**Community Calendar (August 2026 / September 2026)** — Shared top-level `/community-calendar` lists **Public** `internal_events` (`community_calendar_status`). Published bazaars appear from their Vendor Hub date/place hold; staff bazaar cards open Vendor Hub. Included automatically with **Vendor Hub** or **Event Management** (not a separate SKU). Distinct from Facilities Calendar and Events Master Calendar. SQL **`300`** + **`305`**.

**Vendor Hub Overview (August 2026 / September 2026)** — `/vendor-hub` uses the Fund Development layout: colored KPI cards, **Action Required**, **Active events**, and blue Quick Actions. The logo header and breadcrumbs stay fixed on every Vendor Hub page. On Vendor Network, the section title and tabs stay fixed while the list scrolls, and a vendor row opens the profile in a dialog. Lifetime sales stay on Reports. Reports tabs are **Orders** (`?tab=vendor-sales`; Type vs Booth type, column picker, CSV), Booth Performance, and Participation History (`/vendor-hub/reports?tab=history`). The bazaar **Orders** tab is the same report for that event. `/vendor-hub/network/history` redirects.

**Public Program Catalog (August 2026)** — No-login browse at `/o/[orgSlug]/programs` (programs with `visibility = public` only). Offering cards/filters match the customer catalog; staff Programs → Offerings is a separate admin table over the same records. Register via `/join/[orgSlug]?next=…`.

**Public Community Calendar (August 2026 / September 2026)** — No-login browse at `/o/[orgSlug]/community-calendar` (Event Management events with `community_calendar_status = published` only). Featured upcoming event, event-type category circles, All/Today/This weekend tabs, 4-up cards; ticketed events open `/o/[orgSlug]/events/[id]`.

**Education historical enrollments import (August 2026)** — `EducationPrograms.xlsx` + `EduPrograms2.csv` loaded as year programs under Education (Sunday School, QLH, Saturday Arabic, Kids Saturday Arabic, QIJ, Companion of the Quran) plus a new **Istiqamah Institute** department. People and enrollments only; skipped existing QLH 2024–26 / Sunday School 2026–27. Script: `scripts/import-edu-historical-enrollments.mjs`.

**Historical camp enrollments import (September 2026)** — `Camp_Enrollment_Growth.xlsx` loaded as closed seasonal Recreational Camps programs (2022–2026). People and enrollments only; 2026 Camp One/Two skipped because they already live on Summer Camp 2026. Script: `scripts/import-camp-enrollments-historical.mjs`. Camp household history: Programs → Reports → **Camp enrollment**.

**Programs year comparison report (August 2026)** — Programs → Reports → **Year comparison**: enrollment growth by program series and department (unique participants/families, new vs returning, participant line chart). Year/program names open the program workspace (a shared year opens the largest program). Same report on Program Workspace → Reports → **Year comparison**. Department Overview reuses the latest-year family counts and the enrollment line chart only. Route `/programs/reports/year-comparison`.

**TicketOrders.csv Event Management import (August 2026)** — Eventbrite `TicketOrders.csv` loaded into Event Management for MAS Dallas (6,457 orders / 11,989 tickets / $516,377.91). Vendors, QLH/QIL/Sunday School, and donation/fee lines skipped. Crystal Banquet tickets attached to the existing Annual Fundraising Dinner. Script: `scripts/import-ticket-orders-csv.mjs`.

**MAS Fall Bazaar Oct 10 2026 booth orders (September 2026)** — `FallBazaar101026.csv` Eventbrite booth purchases loaded as a new Vendor Hub bazaar. 25 vendors, 25 paid booths, $4,525. Not Ticketing. Script: `scripts/import-fall-bazaar-101026.mjs`. Table-selection fees: SQL **`301`**. Org default booth types + **Default bazaar layout** template: SQL **`302`**. Event inventory remapped onto those Settings types: SQL **`303`**. **Mocktail / smoothie (truck or cart)** $175: SQL **`304`**. Bazaar date/place holds marked `source_module = vendor_hub`: SQL **`305`**.

**Fundraising Dinner Sep 12 2026 door report (September 2026)** — Itemized Eventbrite report (`September122026Fundraiser.csv`) loaded onto Annual Fundraising Dinner: remaining orders, check-in, child names, and $970 checkout donations. Event Overview shows **Ticket donations** separately from Ticket revenue. Script: `scripts/import-fundraiser-dinner-report.mjs`.

**Fundraising Dinner Sep 12 2026 Square donations (September 2026)** — `September12Donations.csv` loaded onto campaign Annual Fundraiser - September 2026 ($32,191, group + general Square reasons). Monthly Square gifts and remark-only monthly commitments are `recurring_donation_plans` on that campaign. Campaign → Donations lists Type + Recurring. Script: `scripts/import-fundraiser-dinner-donations.mjs`. Group totals: Campaign → Groups and **Campaigns → Campaign Groups** (CSV export).

**Ticketing Events categories (August 2026 / September 2026)** — Event Management → **Events** includes sales columns on ticketed rows, a row Category dropdown, and a category filter (`ticketing_event_categories`). Ticketing → Events defaults to active events and shows Draft / Active / Past (Past after the date). Ticketing → Overview has ticket sales KPI cards. Manage categories under Ticketing → Settings. Run **`scripts/287_ticketing_event_categories.sql`**.

**Event Workspace redesign (August 2026 / September 2026)** — Progressive event tabs (orders / staff / youth / vendors / finance / reports / settings) driven by `workspace_features` + attendance mode (`paid` / `free`). Ticket setup is **Settings → Tickets**. Flyer, description, event details, and Community Calendar are **Settings → General**. Workspace tabs and Overview KPIs stay pinned. Expenses ledger (`event_expenses`). Public event checkout (Stripe Connect when ready) + customer **My Tickets** + event documents + staff Stripe ticket refunds (including partials) + youth forms/waivers + `events.checkin` door-staff permission. Run SQL **`252_event_workspace_redesign.sql`**, **`253_event_youth_checkin_waitlist.sql`**, **`254_event_documents.sql`**, **`255_ticket_order_stripe.sql`**, **`256_customer_ticket_order_rls.sql`**, **`257_events_checkin_permission.sql`**, **`258_ticket_order_refunded_amount.sql`**, **`259_youth_waiver_forms.sql`**.

**Fund Development campaign workspace Phase A (August 2026)** — Campaign detail is a tabbed workspace (Overview / **Event** / Prospects / Pledges / Donations / Sponsorship / Groups / Wishlist). Event tab added September 2026 for the same `internal_events` record used by Event Management (`internal_events.campaign_id`, SQL **`300`**). Prospects is one donation prospect table (no Strategy sub-nav). Donations tab pins one-time / recurring / donor KPI cards and can receive a donation or create a recurring plan in place (installments or end date required). One campaign goal (`goal_amount`); Goal Breakdown phases retired (`scripts/270_disable_campaign_goal_phases.sql`). Committed/Collected/Outstanding overview (outstanding = committed minus collected; unpaid pledge rows stay on the Outstanding Pledges table). Migration **`260_campaign_phases.sql`** is historical. Campaign detail loads that campaign’s ledger only (`fetchCampaignWorkspaceLedger`), not all org pledges/payments.

**Staff load performance (September 2026)** — Sidebar Directory role counts use the service-role client and a 60-second cache (`fetchCachedDirectoryNavSummary`, `/api/organizations/sidebar-modules`). Donation staff permission flags load in one query.

**Donation categories/funds still present (September 2026)** — Settings → Categories looked empty because leftover `profiles.role` RLS hid `donation_categories` / `donation_subcategories`. MAS Development still has General Donation, Zakat, Operations, Family Emergency and 13 funds from the Square import. SQL **`294_donation_categories_funds_rls.sql`**.

**Household Giving multi-adult filter (September 2026)** — **Donors → Household Giving** lists only families with two or more adult Directory contacts who each donated in the period (`scripts/295_household_giving_multi_adult.sql`). One-parent program households remain on Directory → Families.

**Fund Development strategy ask levels Phase B (August 2026; retired September 2026)** — Gift-chart `campaign_ask_levels` (target counts) is no longer shown. Table/columns remain. Ask amount is typed on each Prospects row (`suggested_ask_amount`).

**Fund Development prospects Phase C (August 2026; simplified September 2026)** — Campaign → Prospects is a donation-only working list (`campaign_prospects`). Add prospect / row click opens a popup for prospect, ask level, assigned to, optional dates/notes. Table is read-only after save. Record/View pledge and Remove live in that window. Migration **`262_campaign_prospects.sql`**.

**Fund Development prospect conversion Phase D (August 2026)** — Record Pledge from the Prospects window creates one ledger pledge and links `converted_pledge_id` / `campaign_prospect_id`; typed ask amount is preserved on the prospect.

**Fund Development unified prospects + sponsorships (August 2026; split September 2026)** — Donation outreach lives on Prospects. Sponsorship commitments are first-class `campaign_sponsorships` on Campaign **Sponsorship** (**Sponsors | Packages**). Packages are campaign-owned (`scripts/285_campaign_sponsorship_packages.sql`). Migrations **`284_campaign_sponsorship_prospects.sql`**, **`285_campaign_sponsorship_packages.sql`**. `ask_type=sponsorship` prospect rows may still exist in the database but are not edited on Prospects.

**Fund Development Prospects nav (September 2026)** — **Prospects** (`?tab=prospects`) has no Strategy sub-nav. **Assigned to** is a typed employee name (`assigned_to_name`), not a Directory person/organization search. Pinned KPIs: prospects, total ask, overdue follow-ups, pledged. Legacy `?tab=plan`, `?tab=strategy`, and `section=prospects` redirect to `?tab=prospects`. Key files: `campaign-fundraising-plan-tab.tsx`, `campaign-fundraising-plan-table.tsx`, `campaign-fundraising-plan-dialog.tsx`. SQL **`299`**.

**Campaign Event + Ticketing Check-in (September 2026)** — Campaign workspace **Event** tab lists the linked Event Management record (`internal_events.campaign_id`; JSON `ticketing_config.linkedCampaignId` kept in sync); the row opens the event workspace. Pinned KPIs show tickets sold, remaining, and checked in with a per-type breakdown on each card, plus ticket revenue. Create/attach stay on that tab when none is linked. Orgs subscribed to Fund Development but not Event Management see a professional subscribe message (Contact Manaratee). Event Management → Ticketing → **Check-in** (`/event-management/ticketing/check-in`) is the org-wide door desk for every ticketed event (campaign, department, or Event Management): phone camera QR, computer type-a-code. No second ticket system.

**Event create + optional approval (September 2026)** — Create event no longer navigates to Facilities. On-site events link out to the facility calendar to check space, then staff come back to finish. **Approval required** is an Event Management Settings toggle (off by default) and applies only to on-site events. Status menu is Draft / Pending / Live / Completed / Cancelled (no Approved tag). SQL **`291_event_management_settings.sql`**.

**Fund Development campaign groups Phase E (August 2026)** — Campaign → Groups with donation tokens (`/donate/g/{token}`), copy-link and copy-QR icons. Group goals are not set in the UI. Migration **`263_campaign_groups.sql`**.

**Fund Development public group checkout Phase F (August 2026)** — Guest Stripe Checkout on group links; webhook writes payment with `campaign_id` + `campaign_group_id`. Migration **`264_campaign_group_checkout.sql`**.

**Fund Development overview insights Phase G (August 2026)** — Campaign Overview Action Required + team summary + groups rollup; Contact Financial Fund Development history (`donations.view`). No new migration.

**Fund Development follow-ups (August 2026)** — Granular permissions (`265_donations_granular_permissions.sql`); Campaign Performance includes campaign groups reporting; public group pledge modes with `pledge_id` on checkout/payment.

**Fund Development group recurring + FD emails (August 2026)** — Recurring gifts on `/donate/g/{token}`; group pledge confirmation emails; daily prospect follow-up assignee digests. Migration **`266_group_recurring_and_fd_emails.sql`**. Cron: `/api/cron/prospect-follow-up-reminders`.

**Fund Development IA redesign (August 2026)** — Sidebar: Overview / Campaigns / Pledges / **Donations** / Reports / Settings. Operations under `/donations/payments/*`. Transactions date range + export; receipts Missing queue; year-end KPIs from annual statements. No schema change. **Superseded September 2026** by one home per object.

**Fund Development one home per object (September 2026)** — Sidebar: Overview / Campaigns / **Donors** / Pledges / Donations / Settings. Charts on Transactions; overdue/collection % on Pledges; campaign comparison and groups/wishlist on Campaigns; people rollup as Donors. Legacy `/donations/reports/*` redirects except `/donations/reports/donors`. No schema change.

**Org Super Admin / Admin + Settings Users (August 2026)** — Each org auto-creates Super Admin and Admin (`scripts/271_org_system_roles_and_platform_admin.sql`). Platform admin is not an org Super Admin; support rows are flagged `platform_support_access` (`scripts/272_hide_platform_admin_org_memberships.sql`). Invite/magic-link prefers the invited org when a person belongs to more than one tenant. Settings → Users / Roles load on the server. Public join URLs live on Settings → Links.

**Work emails (August 2026 / September 2026)** — Staff Users logins can be assigned to a Directory person (`organization_members.assigned_contact_id`, SQL **`288`**). Personal email on the contact is never transferred. Employee drawer has a typed work email field (assign existing login or invite + assign); check **Department Head (Director)** there. Leaving a department or marking inactive unassigns the mailbox. Work logins have Staff Tools / admin without a personal portal; personal logins keep My Account and lose employee-role Staff Tools while a work email is assigned to that person.

**Program Lead (September 2026)** — `programs.lead_contact_id` (SQL **`290`**). One person per year/season opens that program workspace and all of its offerings without org-wide `programs.view`. Set on Settings → General. Sidebar **My program** / Staff Tools cards follow the same pattern as Department Head. Camp multi-offering group leads stay Coordinator (or Primary instructor) on each offering.

**Fund Development campaign wishlist (August 2026)** — Campaign → Wishlist tab. Sub-goals linked to existing pledges/payments via nullable `wishlist_item_id`. Public donate `/donate/w/{token}`. Carry-forward without duplicating money. Migration **`267_campaign_wishlist.sql`**.

**Campaign same-organization FKs (September 2026)** — Composite `(campaign_id, organization_id)` FKs on campaign children plus same-org triggers on ledger campaign/wishlist links. Service role bypasses RLS; these constraints keep tenants from sharing a campaign UUID. SQL **`292_campaign_same_organization_fks.sql`**.

**Canonical Pledge Details window (August 2026 / September 2026)** — Staff add/edit/collect/remind/delete pledges from one dialog (`components/donations/pledge-details-dialog.tsx`) on Pledges, campaign workspace, prospects, and contact Financial. Monthly, quarterly, and yearly pledges need a first payment date plus installments or an end date. Status is automatic from payments (Open / Fulfilled). Missing contacts can be created from Contact search (person or organization). Customer portal unchanged.

**Contact Financial module sections (September 2026)** — Directory contact Financial stays one tab. Inner nav follows subscribed billing modules: flatten when only Programs (or only Fund Development) is on; mixed tenants get All + Fund Development / Programs / etc. Programs-only contacts in a mixed org open Programs, not empty Recurring/Pledges. Key: `lib/contacts/contact-financial-nav.ts`.

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

* Overview → `/workforce` (drawer + in-page tabs: Employees, Volunteers, Childcare Providers). Path sections: `/workforce/departments`, `/workforce/employees`, `/workforce/volunteers`, `/workforce/childcare`. Employees includes Positions (`?view=positions`). Org payroll queue is **Programs → Reports → Payroll** (`/finance/payroll`); legacy `/workforce?tab=payroll` redirects there. Sidebar: **Administration** owns Departments / Employees / Volunteers / Childcare / Service Providers when **Programs** or **Event Management** is on. Fund Development–only tenants do not see Administration. **Programs** and **Event Management** are separate rail items. Legacy `/workforce?tab=…` redirects to the matching path. Legacy `/reports` redirects to **Reports → Transactions**.
* Discount Policies → `/hr/settings` (Membership Benefits redirect path may apply). Department **list** is Overview → Departments (`/workforce?tab=departments`); department **workspace** remains `/workforce/departments/[id]` (**department-level:** Overview [KPI row including families returning/new + enrollment chart; active programs list; **View all programs** includes closed], Programs [summary doorway], Events `?tab=activity`, Group giving when linked, Financial [sticky combined KPIs, then Employees / Payroll / Expenses / Financial Summary], Settings). **Schedule** (Class times Week Board / List / Activity planner; CTAs to Facilities + Master Calendar) is on Program Workspace `/programs/[id]?tab=schedule`. **Finance** (`?tab=finance`: Transactions | Payment Summary | Add-ons) and **Reports** (`?tab=reports`: Overview | Trends | Year comparison | Attendance) on that workspace are already filtered to the open program. Program management is `/programs/[id]` in the Programs module. **Department Heads** open the workspace from Staff Tools (**My department**) or a sidebar **My department** link when they lack org-wide HR (`staff.view`). They log in with a work email when one is assigned (Settings → Users → Assign person); do not send invitations from this setup. They can edit everything for that department only (same department tools, plus that department’s programs/offerings/registrations/payments/events). They do not get org-wide Programs, Finance, or the Departments list. **Program Leads** open one year/season from Staff Tools (**My program**) or a sidebar **My program** link when they lack `programs.view` and are not already using **My department**. SaaS **Billing** stays in the footer.

**Finance** is not a sellable module. Billing, payroll, and financial assistance ride with **Programs** (`finance` slug stays in the database as a capability). Transactions (`/finance/transactions`), Payroll (`/finance/payroll`), and Financial Assistance (`/finance/financial-assistance`) still use those routes. **Administration** (`workforce`) is also not a SKU — it is included with Programs or Event Management, not Membership or Fund Development. **Facilities** (`spaces`) is included with Programs, Event Management, Venue Rentals, and Vendor Hub, not Membership or Fund Development. **Community Calendar** is included with Vendor Hub or Event Management. SQL **`273_subscription_modules_match_staff_nav.sql`** (after `192`) and **`298_administration_programs_events_capability.sql`**.

Membership sidebar includes **Groups** (`/membership/groups` — member groups / former HR Teams). Giving collectives are under Donations (`/donations/groups/[id]`, Group Giving report) — badge can link a collective to a Membership Group or Department, otherwise **Group Donation**.

Employees, Volunteers, and Childcare Providers use a shared directory UI (`HrDirectoryShell`): roster | Applications (Positions on Employees), KPI cards, Active/Inactive status filter (default Active), export, and pagination. Adding employees/volunteers is contact-first (search Directory; **Add employee** can create a person from the dialog if they are missing).

Other modules link to Applications with filters:

* Vendor Hub → `/applications/all?application_type=vendor`
* Finance → Financial Assistance
* Employment applications → `/workforce?tab=employees&view=applications`
* Committee applications → `/membership/applications`
