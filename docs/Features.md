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
* **Tiered staff navigation (July 2026):** Primary sidebar (`180px`, icon + label). **Manaratee logo** sits at the top of the sidebar (upper left, large). Organization logo on the far right of the header bar. Sidebar nav starts below the logo band + breadcrumb spacer so **Dashboard** aligns with the breadcrumb row (`Dashboard > …`). Breadcrumb path sits on the row below the header. **Department workspace (July 2026):** `/workforce/departments/[id]` appends the department name on the **header** trail (`Dashboard > HR > Departments > Education`) via `Header` `breadcrumbExtras` — no second in-page breadcrumb. **Page breadcrumbs (July 2026):** In-page trails (above page titles) use the same chevron style as the header (`Education > Program Name`) via shared `PageBreadcrumbs` (`components/navigation/page-breadcrumbs.tsx`). Parent segments are clickable so staff can step back to department, list, or module roots. Applied on offering manage, Vendor Hub / Event Management shells, employee/group detail pages, and similar detail surfaces (department workspace uses the header trail only). Clicking a module opens a slide-out drawer with expandable groups; choosing a destination navigates and closes the drawer. **Module order (July 2026):** Dashboard → Contacts → HR → Membership → Donations → Programs → Event Management → Venue Rentals → Vendor Hub → **Facilities** (module slug `spaces`; formerly Bookings / Facility Manager) → Billing → Settings. **Facilities submenu:** Overview, Reservation Center, Calendar, Inventory, **Settings** (tabs: Spaces, Setup Styles at `/facilities/settings/*`). **Spaces cards (July 2026):** metric cards and filters removed; venues show in a 3-column card grid with color, flyer upload, description, capacity/location, and rentals badge (status removed from UI). Run **`scripts/204_venue_color_flyer.sql`**. **Per-day hours & rates (July 2026):** Edit Venue uses a Sunday–Saturday table (open toggle, start/end, flat, hourly) stored in `rental_space_pricing`; toggle label **Available for rental**. Optional seed from legacy peak/non-peak: **`scripts/205_seed_venue_day_pricing.sql`**. Membership is already implemented (`/membership`); if missing from the rail, enable it for the org (repair SQL `scripts/165_ensure_membership_sidebar.sql`, or Platform Admin → Organizations → modules). Flat list (no People/Operations regrouping). Shared chrome heights: `lib/layout/staff-dashboard-chrome.ts`. **Event Management visibility (July 2026):** Org-enabled modules always appear in the staff rail (sub-nav still permission-gated). Loader recovers missing `modules` embeds, normalizes slugs, and keeps product modules even if `is_active` was flipped off. Org **Super Admin** gets full sidebar permissions. Enabling a product module seeds Admin/Super Admin permissions. Repair script: `scripts/138_ensure_event_management_sidebar.sql`. Key files: `components/layout/sidebar.tsx`, `lib/organizations/load-organization-sidebar-modules.ts`, `lib/organizations/sidebar-nav-context.ts`, `lib/modules/organization-module-access.ts`.
* Subscription-aware modules
* **Roles & Permissions subscription filter (June 2026):** Settings → Roles & Permissions only lists permission rows for modules enabled on the org (`lib/permissions/permission-definitions.ts`, filtered via `loadOrganizationEnabledModuleSlugs`). Core modules (Settings, Contacts) always appear; product modules (e.g. Donations only for MAS Dallas) gate their permission groups. **Facility Manager** and **Facility Coordinator** roles are hidden unless the org has **Facilities** (`spaces`) or **Venue Rentals** (`bookings`) enabled (`filterOrganizationRolesForOrganization` in `lib/permissions/facilities-access.ts`).

* **Bookings Calendar merge (July 2026):** Under **Facilities** (module slug `spaces`; sidebar label **Facilities**), **Space Availability** and **Schedule** are a single sidebar item **Calendar** → `/facilities/calendar` (ops master calendar: full titles, blocks, event planning). **Shared scheduling foundation (July 2026):** Venue Rentals, internal Events, and Program sessions all feed one schedule — stored rows in `resource_reservations` (rentals/events/holds/closures/maintenance) plus **per-session expand** of `program_schedule_items` (not one long program block). Module calendars are filtered views of the same data via `?sources=` (`venue_rental`, `internal_event`, `program_facility`); Facilities Calendar (no filter) shows everything. Redirects: `/bookings/calendar` → `?sources=venue_rental`, `/event-management/calendar` → `?sources=internal_event`. Programs sidebar **Calendar** → `?sources=program_facility`. **Setup/cleanup:** `setup_minutes` / `cleanup_minutes` on `rental_reservations` and `internal_events` expand the occupied window written to `resource_reservations` (migration **`209_shared_scheduling_foundation.sql`**). **Programs ↔ venues:** optional `program_schedule_items.venue_id`; conflict checks on save use the shared facility schedule. **Basic vs advanced Facilities:** enabling Venue Rentals, Events, or Programs implies `spaces` (calendar + space settings + conflict checking); Overview / Reservation Center / Inventory stay advanced (shown when Venue Rentals is enabled). Shared venue picker: `components/reservations/facility-venue-select.tsx`. Separate rental / event / program forms preserved — no combined generic form. **Overview:** `/facilities/overview` is a **read-only** facilities landing for facility staff — **Confirmed rentals** + **Setup briefs needing review**. Approvals/payments stay in Venue Rentals. **Double-booking prevention:** rental submits, event creates, and program schedule saves check `resource_reservations` plus program sessions (prefer `venue_id`, fallback location name match). **Inventory:** `/facilities/inventory` — run **`207`** then **`208`**. **Setup Styles:** Facilities → Settings → Setup Styles. **Event Types:** Venue Rentals → Settings → Event Types. **Organization Master Calendar (planning only):** separate org-wide collaboration calendar (not Facilities). Vision doc: `docs/organization-master-calendar-vision.md` — do not implement until requested.

* **Ticketing reports (July 2026):** Real ticket analytics under **Event Management → Ticketing → Reports** (`/event-management/ticketing/reports`) — always-on KPIs plus a **View** filter (**Days** / **Events** / **Customers**) and date range; CSV export matches the active view. Data from `ticket_orders` + `tickets` (no mock data). **Event Management → Reports** uses in-page tabs **Operations** | **Childcare Registrations** (no sidebar submenu). Key files: `lib/tickets/ticketing-reports-queries.ts`, `components/tickets/ticketing-reports-client.tsx`.
* **Internal event delete guards (July 2026):** Delete lives on Event Management catalog and event workspace (not Ticketing Overview). Server blocks delete when the event has ticket orders, active volunteer/vendor/childcare-provider sign-ups, or non-cancelled childcare registrations. Key files: `getInternalEventDeleteBlockers` in `lib/events/internal-event-actions.ts`, `components/events/internal-event-card-actions.tsx`.
* **Department workspace Events (July 2026):** HR → Departments → **Events** (`?tab=activity`) lists that department’s `internal_events` with open/edit/delete (manage permission). One **Create event** button opens Facilities calendar filtered to events with `?department=` so slot clicks and **Request Event** prefill/lock the department. Panel: `components/departments/department-events-panel.tsx`.

* **Venue rental Google Form import (July 2026):** Dry-run/execute script `scripts/import-venue-rental-form-responses.mjs` loads Form Responses CSV into `venue_rentals` + `rental_reservations` (calendar via sync trigger). **Scope:** Banquet Hall and/or Youth Lounge only; both → two slots. End time missing/`Option 1`/invalid → start+4h (America/Chicago). Dedupe email+date+venues (keep latest). Contacts via `find_or_create_contact_for_org` + membership in contact group **Venue Rental**. Status map: Approved→`approved_pending_payment`, Deposit Received→`confirmed`, Complete→`completed`, Cancelled→`cancelled_before_payment`, blank→`completed` if past else `submitted`. **Type of Event** maps to `venue_rental_event_type_id` (match/create in `venue_rental_event_types`). Payments not imported (separate later). Report: `scripts/reports/venue-rental-form-import-*.json`. Backfill for rentals imported before FK was set: `scripts/backfill-venue-rental-event-types.mjs` (parses `Event type:` from notes). **Keep-from-month cleanup (July 2026):** `scripts/cleanup-imported-venue-rentals-keep-month.mjs` deletes Google Form imports (`VENUE_RENTAL_GOOGLE_FORM_V1`) whose event start is **before** the cutoff month (default July 2026 America/Chicago) and keeps that month plus all later; **contacts are never deleted**.

* **Venue Rentals Settings (July 2026):** Settings tabs: **Notifications** | **Event Types** (`/bookings/settings/notifications`, `/bookings/settings/event-types`). Facilities and EM event-types routes redirect to Venue Rentals Event Types for now; Event Management will get a separate catalog later.

* **Venue Rentals Dashboard vs Requests (July 2026):** `/bookings/overview` shows **confirmed upcoming** rentals only (KPI cards: upcoming / this week / next 30 days / balance due) plus **View all requests**. `/bookings/requests` loads the full queue (default status filter All) with KPI cards and search/status filters. **Add booking (July 2026):** staff with manage permission get an **Add** button that opens a dialog to create a `submitted` rental for any contact (one or more spaces via checkboxes, shared date/time, setup style from Facilities → Settings → Setup Styles, optional event type/notes); uses `createStaffVenueRentalRequest`. **Queue conflict checks (July 2026):** list/dashboard conflict flags use one batched `resource_reservations` range query (`loadRentalConflictFlags`) instead of per-reservation round-trips — needed after bulk Google Form import (~150 rentals).

* **Venue Rentals Payments (July 2026):** Sidebar **Payments** → `/bookings/payments` — report of rentals with total fee, deposit received, remaining due, balance filter (unpaid / partial / paid / no payments), and row actions: **Receive payment**, **Edit payment**, **Delete payment** (updates/deletes `rental_payments`, then resyncs rental status). No rental workflow Status column on this page. Nav: Dashboard | Requests | Payments | Settings.

* **Venue rental payments import (July 2026):** `scripts/import-venue-rental-payments.mjs` matches `Venue Rental Payments.csv` to existing `venue_rentals` by billing-contact email/phone (or email in Google Form notes). Unmatched payments skipped. Writes `rental_payments` (`deposit` / `remaining_balance` / `refund`; `paid_manually` or `refunded`). Idempotent via notes tag `VENUE_RENTAL_PAYMENTS_V1`. Reports: `scripts/reports/venue-rental-payments-import-*.json`. **Cleanup (July 2026):** `scripts/cleanup-imported-venue-rental-payments.mjs` deletes rows tagged `VENUE_RENTAL_PAYMENTS_V1`, sets past non-cancelled rentals to `completed`, and resets future rentals that were bumped to `deposit_paid` by the import back to `approved_pending_payment`.

* **Organization audit log (June 2026):** Settings → **Audit Log** (`/settings/audit-log`) — append-only history of donation ledger edits (payment update/void/refund/allocate, pledge update/payment/cancel) and permission changes (member role assignment, role permission toggles). Table: `organization_audit_logs` (migration `142_organization_audit_logs.sql`). Writes via service role in `lib/audit/organization-audit-log.ts`; reads via RLS for staff with `settings.users.view`, `settings.roles.view`, `donations.view`, or `donations.manage`. Permission toggles route through `setOrganizationRolePermissionAction` so changes are logged server-side.
* **Org billing view (June 2026):** `/billing` (sidebar **Billing**, pinned to the bottom of the icon rail; `/settings/billing` and `/settings/subscription` redirect here) — plan price, persona bundle, plan limits, enabled modules, payment methods on file, and billing history (`lib/organizations/organization-billing-actions.ts`, `organization-subscription-summary.ts`). Visible to platform support sessions, `organization_members.role` of `super_admin`/`owner`, or org role name **Super Admin**. Apply migration `121_organization_billing.sql` for payment methods and invoice history tables.
* **Subscription terms (June 2026):** Platform admin → Organizations → **Billing** tab sets `subscription_start_date`, optional **3 months free** (`complimentary_months`), and optional **first year special rate** (`first_year_special_monthly_rate`). Org `/billing` shows start date, complimentary period, effective rate, and first-year pricing notice (standard rate after year one; owner may adjust pricing). Migration `123_organization_subscription_terms.sql`. API: `PATCH /api/platform/organizations/[id]/billing-terms`.

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

Key files: `lib/customer/customer-portal-modules.ts` (client-safe), `lib/customer/customer-portal-modules-server.ts` (server loaders/guards), `components/customer/customer-nav.tsx`, `app/(customer)/layout.tsx`. Disabled module routes redirect to `/customer/dashboard`. **Dashboard** (`/customer/dashboard`): KPI cards; two-column giving section — **Active Campaigns** (left, one campaign per row) and **Donation Options** (right, two categories per row each with a **Donate** button that opens the **Make a Donation** dialog in place via `components/customer/customer-donation-dialog.tsx`). Customer sidebar branding uses the active org `logo_url` with **organization name** in bold below the logo (falls back to name-only or Manaratee logo). **Profile** submenu (Family, Notification Preferences, Applications) appears only after the donor opens Profile. **Notification Preferences** (`/customer/profile/notifications`) shows toggles only for org-enabled modules (`lib/customer/customer-notification-preferences.ts`); Donations module includes payment completed, payment charges, failed transactions, pledge reminders, and SMS payment reminders, plus org-wide newsletter.

For a donations-only org (e.g. MAS Dallas on the **Nonprofit** bundle), ensure only `donations` is enabled in platform admin → organization modules (or assign bundle `nonprofit`).

**Portal switcher (July 2026):** User menu **Switch portal** appears only when the same login has a **personal (customer) portal** and at least one staff-side portal (Admin Dashboard, Staff Tools, or Teaching). Staff-only accounts (e.g. `admin@org` with admin + staff-tools permissions but no personal/customer account) do not see the switcher. Key: `shouldShowPortalSwitcher` in `lib/auth/resolve-portal-permissions.ts`, `components/portal/portal-switcher.tsx`.

**Donor join deep-link (June 2026):** Settings → Users exposes two links: general customer join and **Donor signup and give**. The donor link is `/join/{org-slug}?next=/customer/donation?give=one-time` (encoded in the URL). After signup or sign-in, the user is routed to `/customer/donation` and the **Donate** dialog opens (one-time by default). Requires donations module + org Stripe Connect (Donations → Settings → Online Payments). Key files: `lib/organizations/join-organization-url.ts`, `lib/auth/sanitize-customer-redirect-path.ts`, `components/customer/organization-join-client.tsx`, `components/settings/organization-join-link-card.tsx`.

## Customer Venue Rentals (pilot — Phase 1 UX)

Status: Pilot preparation (June 2026)

**Intended staff process (July 2026):**
1. Customer submits → **Submitted**
2. Admin reviews → **Approve** (request deposit), **Decline**, or **Pending** (waiting for more info)
3. Approved → **Awaiting Payment** with hold deadline; customer notified to pay deposit (admin can extend/override hold)
4. Deposit received → **Confirmed** (Payments page shows deposit paid; security deposit not required — card on file for damage)
5. Two weeks before event → remaining-balance reminder; if unpaid, admin acts manually (cancel / payment plan / extension)

Statuses updated to match: submit lands on `submitted`; new `pending`; `deposit_paid` / `security_deposit_paid` treated as confirmed (legacy labels map to Confirmed). Run **`scripts/206_venue_rental_status_process.sql`**. Key files: `lib/bookings/venue-rental-status.ts`, `venue-rental-actions.ts`, `venue-rental-detail-client.tsx`.

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

**Contacts list UI (June 2026):** Removed **All Contacts** (`/contacts` redirects to `/contacts/people`). Sidebar lists **People**, **Organizations**, **Reports**, and **Settings** (**Families** removed from the sidebar July 2026 — household directory lives under **Reports → Families**). User-facing **Affiliation** terminology replaced with **Roles** in Contacts → Settings automatic-role rules (contact profiles no longer show an editable Roles card — roles sync from activity only). Discount tags: **Employee / Staff / Member / Volunteer / Full-Time Employee** are system-managed (auto from Workforce or Membership; not pickable on profile). **Donor** and custom tags remain manually assignable on **individual and organization** Overview → Edit. Sync preserves system tags when staff change a manual tag. Key: `lib/discount-tags/discount-tag-assignment.ts`. People/Organizations/Groups lists: search + add only (role/status dropdown filters removed); table columns **Contact** (name styled as link), **Email**, **Phone**, **Created by** (not stored yet — shows —), **Last modified**, **Status** (Active/Inactive only). No **Actions** column — edit, merge, delete, and **View Details** live on the contact profile sticky header actions menu. Removed intro banners and stat cards on type-specific list pages. Removed Teams column and team filter from `ContactsCrmList`. Team assignment remains on individual contact profiles where HR teams are enabled. **Organizations list (July 2026):** first column renamed **Organization** with column **sort** + **filter** (name); **Primary Contact** moved between organization name and Email; top search bar removed (use column filter); server-side sort via `fetchContactsList` (`sortBy`, `nameFilter`). **Groups list (July 2026):** same pattern — **Group** column with sort/filter, Primary Contact after name, no top search bar. **Individual name casing (July 2026):** ALL CAPS / all-lowercase individual contact names can be rewritten to proper case (`ABEER ZOUBI` → `Abeer Zoubi`) via `node scripts/proper-case-individual-contact-names.mjs` (dry-run; add `--execute` to apply). Organizations and groups are skipped. Create/update of individual contacts also applies the same rule. Helper: `lib/contacts/proper-case-name.ts`.

**List pagination (July 2026):** Shared `ListPagination` (`components/ui/list-pagination.tsx`) — “Showing 1 to 20 of N entries”, first/prev/page numbers/next/last, and page-size selector (10/20/50/100). Applied on Contacts People/Organizations, Contact Directory + Families, Program Registrations, Members, Employees, Volunteers, and Donors report. Helpers: `lib/ui/list-pagination.ts`.

**Contacts Reports — Phase 1 (June 2026):** Sidebar **Reports** (above Settings). Hub at `/contacts/reports`; **Contact Directory** at `/contacts/reports/directory`. **Directory tabs (July 2026):** under summary cards — **Individuals**, **Organizations**, **Families**. Contact tables show **Contact**, **Email**, **Phone**, **Roles**, **Last activity** (Type / Status / Teams columns removed). Roles are CRM affiliations (Donor, Volunteer, Employee, Member, Customer, Programs, Vendor, etc.) synced from activity — not household family roles. Families tab reuses the household directory (`components/contacts/contacts-families-directory-panel.tsx`); `/contacts/families` redirects to `?tab=families`. Summary cards: total contacts, individuals, organizations, families. Column-header filters on Contact search + Roles; CSV export for Individuals/Organizations tabs. Requires `contacts.view`. Donor giving totals remain under **Donations → Reports → Donors** (hub links there). Key files: `lib/contacts/contact-report-actions.ts`, `lib/contacts/contact-report-csv.ts`, `components/contacts/contacts-directory-report-panel.tsx`.

**Group giving attribution (June 2026 / July 2026):** When recording a payment (Donations → Payments, contact **Receive Payment**, or pledge payment), staff can optionally pick a **Group**. The gift stays on the individual contact; `payments.attributed_group_contact_id` counts it toward the group total. The picker lists **only groups the contact already belongs to** — add membership from **`/donations/groups/[id]`** first (no auto-add on payment). **UI (July 2026):** Group giving / Campaign gifts shows a single **Amount** per campaign (no Group / Attributed / Combined split) — going forward gifts are individual contributions toward the group, not pooled gifts from the group as a whole. Click Amount to see donors for that campaign. Apply **`scripts/136_payment_attributed_group.sql`** (after `135`). Key files: `lib/contacts/group-giving-actions.ts`, `components/donations/donation-group-picker.tsx`, `components/donations/donation-group-financial-panel.tsx`.

**Contacts Groups record type (June 2026 / July 2026):** CRM `contact_type = group` remains for giving attribution but **is not a contact profile**. Detail UI is **`/donations/groups/[id]`** for Group Donation / Membership Group collectives. When the collective is a **Department** (linked via `linked_department_id`, or unique same-name match — auto-linked on open), Group Giving redirects to the shared **Department workspace** at **`/workforce/departments/[id]`**. Department tabs: **Overview** (years/seasons + flyer; Super Admin archive; legacy `?tab=offerings` → Overview), **Programs** (`?tab=programs` — year/season offerings list with Add Program; `?year=` prefill; legacy `/programs/[id]?tab=offerings` redirects here when the year has a department), **Participants** (UI label; URL `?tab=students` — merges former Enrollments + Applications; stages Needs review / Approved — not registered / Roster; program filter on roster, no year/season filter; legacy `?tab=rosters|enrollments|applications` → Students; `&section=review|approved`; `/programs/[id]?tab=reports` → Students roster), **Schedule**, **Financial** (sub-tabs: Payroll, Expenses, Financial Summary; legacy `?tab=payroll|expenses|budget` map here; **Employees** live under Financial → Payroll — merged columns, no email/phone; legacy `?tab=employees` → Payroll), **Group giving** when linked, **Events** (UI label; URL `?tab=activity` — department events only), and **Settings**. Layout: tabs sit under the department name; each tab shows its own summary KPI cards (not a global strip). Financial assistance stays at org/committee level (not under departments). Legacy `?tab=payments` / `participants` → Students; `babysitting` → Payroll; **`?tab=reports` (former Archive) → Overview**. Apply **`scripts/167_giving_group_category.sql`**. Opening `/contacts/[id]` for a group redirects appropriately. Key files: `components/departments/department-group-workspace-client.tsx`, `components/departments/department-students-panel.tsx`, `components/departments/department-programs-panel.tsx`, `components/departments/department-student-payments-panel.tsx`, `components/departments/department-group-giving-panel.tsx`, `lib/departments/department-giving-link.ts`, `lib/departments/department-programs.ts`, `lib/donations/donation-group-path.ts`.

**Programs Catalog offerings (July 2026):** `/programs/catalog` shows **active** `program_offerings` (not year/season rows). Cards are read-only; flyer (`flyer_url`) or placeholder color (`background_color`) + program name; year/season under the title; enrollment footer. Branding edited on offering Overview in the department/program workspace. Apply **`scripts/191_offering_catalog_branding.sql`**. Key files: `offering-catalog-view.tsx`, `offering-catalog-queries.ts`, `OfferingOverviewFields`.

**Department Head portal access (July 2026):** Department Heads (`staff.is_department_head` + `department_id`, set on CRM Employment) get **Staff Tools** even without org-wide `staff.view`. Staff Tools shows **My department** → department workspace. Admin sidebar injects **My department** when the user is a head but lacks `staff.view` (full HR list stays admin-only). Application evaluation requires `canManageDepartment` (or `programs.manage` for orphan years). Key files: `lib/departments/department-headship.ts`, `lib/auth/staff-tools-eligibility.ts`, `app/(customer)/customer/staff/page.tsx`, `components/layout/sidebar.tsx`.

**Department Participants tab (July 2026):** Enrollments + Applications merged into **Participants** (`?tab=students`). Stages: **Needs review** (`submitted` applications), **Approved — not registered** (`approved` with null `enrollment_id`), **Roster** (enrollments). No year/season filter (typically one open year). Program filter remains on roster. Legacy URLs `?tab=rosters|enrollments|applications` map to Participants. Key files: `department-students-panel.tsx`, `department-applications-panel.tsx`, `department-participants-panel.tsx`.

**Department Years/Seasons = Programs Catalog (July 2026):** Year/season setup for a department lives on **Overview** (list, add year, **Configure** year basics dialog, flyer, archive; `?year=` highlights the card). The old standalone **Years/Seasons** tab (`?tab=offerings` / `department-offerings-panel.tsx` catalog UI) is removed from the workspace nav; legacy URLs open Overview. Sellable **Programs** (offerings) for open years live on the department **Programs** tab (`?tab=programs`). Programs **Catalog** (`/programs/catalog`) is an **active-offerings** org-wide browse (read-only cards; search + department filters; flyer or background color). Create/edit offerings from the department **Programs** tab. `/programs/[id]` with a `department_id` redirects to the department workspace (Overview, or Settings → Year defaults when `?tab=settings`). Orphan years (no department) keep standalone detail. Staff UI: Year/Season = `programs` row; Program = `program_offerings` row (`lib/programs/program-display-labels.ts`).

**Program single-session registration column (July 2026):** Saving program Overview failed with missing `programs.single_session_registration_enabled`. Run **`scripts/189_program_single_session_registration.sql`** in Supabase. App updates retry without the column if still missing so identity edits can save; run the SQL to enable the flag fully.

**Department year programs / Overview (July 2026):** Department workspace default tab is **Overview** (year setup for that department): list open year programs, add next year (optional copy of courses + teachers, empty roster), **Configure** (name, dates, enrollment window, gender/ages, visibility, status, description/flyer via `ProgramBasicsSection` + `updateProgramBasics`), upload/change year flyer; **Super Admin** can **Close year** (confirm name) → program `closed`, offerings closed — year **stays** in department operating tabs for comparison. Legacy **archived** status remains filtered out of operating tabs. The workspace **Archive** tab was removed (July 2026); `?tab=reports` redirects to Overview. Operating tabs (**Programs**, **Participants**, **Schedule**, **Financial**) include workspace years: `draft` / `active` / `paused` / `closed` via `DEPARTMENT_WORKSPACE_PROGRAM_STATUSES`. Catalog still uses open-only (`draft`/`active`/`paused`). Run **`scripts/199_program_status_closed.sql`** so `programs.status` allows `closed`. Key files: `department-overview-panel.tsx`, `department-year-configure-dialog.tsx`, `department-year-actions.ts` (`closeDepartmentYearProgramAction`), `department-active-programs.ts`.

**QIL year import (July 2026):** Historical QIL 2025–26 roster + Stripe payment CSV → department / **one year program** `Quran Institute for Ladies 2025-2026` / **course offerings** / enrollments / `program_charges`. Requires **`scripts/174_enrollment_unique_per_offering.sql`** (unique active enrollment is per offering so students can take multiple courses). If courses were wrongly created as `QIL — {course}` programs, consolidate with `node scripts/migrate-qil-courses-to-offerings.mjs --execute` after running 174. Import: `node scripts/import-qil-year.mjs` / `--execute`. Display fix for imported rows: `node scripts/fix-qil-enrollment-display.mjs --execute` sets adult contact fields; `node scripts/fix-qil-registered-date.mjs --execute` sets `enrollment_date` to **2025-09-01** (Enrollments Registered). Contact profiles + **Programs** affiliation (`program_participant`): run **`scripts/175_split_customer_programs_affiliation.sql`**, then `node scripts/sync-qil-participant-contacts.mjs --execute`. Report: `scripts/reports/qilts/qil-import-YYYY-MM-DD.json`. Department **Participants** roster = names/courses/teachers only; payments under **Programs → Reports → Registrations**; **Financial Summary** uses billing totals.

**QLH (Education) registrations import (July 2026):** Excel `QLH_Registrations.xlsx` (sheet `QLH2526`; Year column has both years) → department **Education** / existing year programs **`QLH 2024-2025`** and **`QLH 2025-2026`** / default offering **`QLH Registration`** each / youth enrollments. Parents matched by email then phone (emergency-contact blob when Parent columns are empty); minors as `people` under the parent (`child_person_id`, no child contact). Bad DOB text falls back to Excel serial. Idempotent via import-key notes + child+offering unique. Script: `node scripts/import-qlh-registrations.mjs` / `--execute` (`--xlsx` optional). Reports: `scripts/reports/import-qlh-registrations-*.json`. Optional household fold: `node scripts/sync-summer-camp-households.mjs --all-parents --execute`.

**Household Families = adults + minors (July 2026):** Contacts → Reports → **Families** is a household **directory** (not a second profile; removed from Contacts sidebar). Contact is canonical; family is an extension on the contact (spouse/kids, household name/head). List shows primary email/phone/address + member count and opens the primary contact. Legacy `/contacts/families` redirects to the Reports Families tab; `/contacts/families/[id]` redirects to that contact. Adults keep CRM contacts; minors are `people` under the parent with **no** contact profile via `family_members.person_id` (SQL **`196`**). Default household name uses the kids’ last name (e.g. **Suleiman**), without a “Family” suffix. First adult added is head/primary (changeable on the contact Family card). One household even when kids are linked under both parents. Linking a spouse/partner imports that contact’s children into the shared household and mirrors them on both Family panels (`importContactDependentsIntoHousehold`; repair: `node scripts/repair-household-spouse-dependents.mjs --anchor <id> --member <id> --execute`). Strip existing suffixes: `node scripts/strip-household-family-suffix.mjs --execute`. Camp backfill: `node scripts/sync-summer-camp-households.mjs --execute` after 196. Key: `family-name.ts`, `family-sync.ts`, `contact-family-panel.tsx`, `family-settings-panel.tsx`, `fetchFamilyListSummaries`.

**Minors = people under parent Contact (July 2026):** Same model as QIL **Contact + Participant**. CRM **contacts** are adults (parent/guardian / adult participants). Minors are `people` linked via `person_relationships` under the parent contact — **no contact profile**, no Programs affiliation on the child. Youth registration uses `p_participant_person_id` (SQL **`195`**); enrollments store `child_person_id` and leave `participant_contact_id` null for minors. Do not auto-create contacts after enrollment. Summer Camp cleanup: `node scripts/cleanup-summer-camp-minor-contacts.mjs --execute`. Link kids on parent Family panels: `node scripts/link-summer-camp-participants-under-parents.mjs --execute` (repair sibling parent-person dupes with `repair-summer-camp-parent-people.mjs` if needed). **Roster enrichment (kids DOB / gender / grade):** run **`198_people_grade.sql`**, then `node scripts/enrich-summer-camp-kids-from-roster.mjs --csv "C:/Users/danan/Downloads/Summer Camp 2026.csv" --execute` (fills empty fields only). **Parents (phone/address/emergency notes + spouse email links):** `node scripts/enrich-summer-camp-parents-from-roster.mjs --execute`, then `node scripts/sync-summer-camp-households.mjs --execute`. Roster / family UI: participant names are plain text; parent links to the Contact. Key: `program-registration-actions.ts`, `program-enrollment-actions.ts`, `customer-family-actions.ts`, `contact-profile-admin-actions.ts`.

**Program kinds (July 2026):** Same Programs menu, two create types — **`academic`** (year + offerings, QIL-style) and **`seasonal`** (single camp/season product). Column `programs.program_kind` (SQL **`193`**). Seasonal create makes one leaf offering (same name) for fees/sessions; staff manage it as the season. Summer Camp 2026 migrated to `seasonal`. **Inherit toggles removed (July 2026):** programs no longer use “Use program dates / enrollment / eligibility” — each offering stores its own registration settings (`inherit_*=false` on save). Key: `lib/programs/program-kind.ts`, `program-form.tsx`, `offering-manage-client.tsx`, `offering-registration-panel.tsx`.

**Department-home program navigation (July 2026):** Department-linked years/seasons open manage under **`/workforce/departments/[id]/programs/[programId]/offerings/[offeringId]`** so the sidebar stays on **HR → Departments**. Legacy `/programs/.../offerings/...` redirects when `department_id` is set. Helper: `programOfferingManageHref(..., { departmentId })`. Department Programs / Schedule / Students / Payments links use the department-scoped URL. Breadcrumbs: Department → Programs tab → offering. Department **Add program** includes Academic vs Seasonal type; Seasonal skips inherit defaults and creates a new camp product (no Tajweed placeholder).

**Summer Camps 2026 import — Phase 1 payments (July 2026):** Stripe-style CSV `SummerCampsPayments2026.csv` → department **Recreational Camps** / year **Summer Camps 2026**. Originally two offerings (Camp One / Camp Two); **merged (July 2026)** into one **Summer Camp** offering (Jun 1–Jul 23, eight Mon–Thu week sessions). Parses **Payment Remarks** for Registered Members, fees, add-ons (childcare → separate `addon` charge), and Coupon Code (`FA*` → FA awards; week/day-pass coupons → selected sessions weeks 1…N; `STAFF*` / credits → staff discount tagged for a later payroll phase). Full refunds → cancelled enrollments. Script: `node scripts/import-summer-camps-2026.mjs` (dry-run) / `--execute`. Merge: `node scripts/merge-summer-camps-2026.mjs` / `--execute`. Report: `scripts/reports/summer-camps-2026-*.json`. Archived Camp Two shell removed after merge: `node scripts/delete-summer-camp-two-merged.mjs --execute` (cancelled leftover enrollments cleared; payment charges retained on Summer Camp). **Pricing (merged camp):** week-count tuition tiers (1→\$135 … 8→\$900) via fee plan `metadata.session_count_tiers`; registration fee \$0; sibling discount **5% on tuition only**. Quote engine support: SQL **`190`**. **Later phases:** master workbook (kids ages, staff, volunteers, payroll, expenses) and staff payroll deductions.

**Programs vs Customer affiliations (July 2026):** Split the unified Customer tag. **Programs** (`program_participant`) = program enrollments as participant, registrant (parents), or **payer**, or a paid `program_charges` row. **Customer** = events/ticketing + venue rentals only. Apply **`scripts/175_split_customer_programs_affiliation.sql`**, then **`scripts/197_fix_sync_affiliations_programs_payer.sql`** (fixes broken `vendors.contact_id` in sync RPC + payer rule). Backfill without RPC: `node scripts/backfill-programs-affiliation.mjs --execute`. Settings toggles under Contacts → Affiliations. Key files: `contact-affiliation-rules.ts`, `contact-affiliation-sync.ts`, `contact-constants.ts`.

**Programs → Reports tabs (July 2026):** Shared report tab bar (`ProgramsReportsNav`): Overview, Registrations (`/programs/registrations`), Attendance, Waitlist. Overview shows KPI cards only (Active Programs / Total Enrolled / Revenue / Outstanding) — no duplicate quick-link cards; use the tabs. Finance lives under **Finance**. Legacy `?tab=transactions` redirects to Finance Transactions. `/programs` redirects to Catalog. **Registrations** (and Overview KPIs) use **open** years only (`draft`/`active`/`paused`) via `getOpenPrograms()` — after archive, live totals reset; closed years remain on the department operating tabs.

**Full-time employee benefit (July 2026):** Active `staff` with `staff_type = full_time` automatically get the **Full-Time Employee** discount tag and a default **50%** org benefit on **Programs** (quote + registration charge) and **Venue rentals** (approval pricing suggestions). Ticketing is excluded. Policy table: `organization_employee_benefits`. Run **`scripts/184_fte_employee_benefit_discount.sql`**. Key files: `lib/benefits/employee-benefit.ts`, `lib/bookings/venue-rental-employee-pricing.ts`, quote wrapper in 184.

**Discount tags — custom + auto-apply (July 2026):** Contacts → Settings → Discount Tags uses an **Add Tag** dialog (name, description, discount %, auto-apply toggle, module checkboxes for Programs / Venue rentals / Ticketing). Custom tags are assigned manually on individual **and organization** profiles. System tags (Member / Staff / Employee / Volunteer / FTE) still sync from activity. When auto-apply is on, programs quotes and venue rental pricing use the best matching tag percent (alongside FTE benefit; highest wins). SQL: **`scripts/202_discount_tag_auto_apply.sql`**. Key files: `components/hr/discount-policies-panel.tsx`, `lib/discount-tags/discount-tag-actions.ts`, `lib/discount-tags/discount-tag-benefits.ts`.

**Programs → Payments list (July 2026):** `/programs/registrations` tracks registration balances (Fee / Received / Balance). Status is **Paid**, **Open**, or **Refunded** (from fee vs received; not a stale `payment_status` flag). Row actions: Receive payment, **Edit registration** (change program and/or fee), **Mark financial assistance** (Total fee: 25%/50%/75%/full scholarship; **Custom monthly**: e.g. $30/mo × remaining months → new fee + rewritten installments), Custom payment plan, Add notes, **Withdraw & settle**. Payment voids/corrections belong on payment transaction reports, not this list. Program column shows program name only. KPI **Open Balances** counts active enrollments still owing and links to `?status=open` (clears search). Filter bar shows result count + Clear filters when narrowed.

**Finance module restored (July 2026):** Main sidebar **Finance** with children **Transactions** (`/finance/transactions`), **Payroll** (`/finance/payroll`), **Financial Assistance** (`/finance/financial-assistance`). Footer org **Reports** removed — payment hub lives under Transactions. Legacy `/reports` → Transactions; `/programs/financial-assistance` → Finance FA; `/workforce?tab=payroll` → Finance Payroll. Run **`scripts/192_finance_module_sidebar_restore.sql`** (after `187`). Key files: `lib/finance/finance-paths.ts`, `app/(dashboard)/finance/*`, `components/reports/org-reports-client.tsx`.

**Organization Reports (July 2026):** Formerly pinned footer `/reports`; now **Finance → Transactions** (same tabs: Payment transactions, Failed transactions, More reports). Legacy `/reports` and `/settings/reports` redirect to Transactions. Key files: `components/reports/org-reports-client.tsx`, `lib/reports/org-payment-transactions.ts`.

**Program → Offering attributes migration (July 2026):** Program = identity/defaults; Offering = operational attributes. **S1–S6 in repo:** run **`176`–`179`**. Audience is **adult/youth only**. Catalog capacity = sum of limited offerings (Unlimited when none limited). Obsolete program capacity/eligibility columns retained for dual-read (drop later). Plan: [`docs/programs-offering-attributes-migration.md`](./programs-offering-attributes-migration.md).

**Program registration pipeline (July 2026):** Implementation started. Run **`scripts/182_program_registration_applications.sql`**. Customer **Apply** (`/customer/programs/[id]/apply`) with Returning vs New — **everyone** stays pending until department evaluation (no auto-approve) when `application_required` is true. Offerings can opt into **open enrollment** (`application_required = false`): Register & pay with no Apply/Approve — set on Add program or Registration settings. SQL **`194`**. Seasonal camps default to open enrollment. Department workspace **Applications** tab: New/Returning column, per-row and **batch approve**. Reports: **Registrations** + **Payment transactions**. Still pending: approve-other-offering UI, waitlist-on-full + offer deadline, gate Register on approval when required, FA-after-approval. Design: [`docs/programs-registration-pipeline-design.md`](./programs-registration-pipeline-design.md).

**My Classes roster (July 2026):** Personal-portal teachers (assigned staff who are not org members) need **`scripts/183_assigned_staff_offering_roster_rls.sql`** so `/my-classes/[offeringId]` can load the offering roster. Page hardened to avoid server crashes when attendance/roster RLS or columns are missing.

**Staff labels Year/Season vs Program (July 2026):** UI copy only — DB unchanged (`programs` = year container, `program_offerings` = sellable class). Staff see **Year/Season** / **Years/Seasons** for catalog rows and **Program** / **Programs** where the UI used to say Offering. Shared helpers: `lib/programs/program-display-labels.ts`. Sidebar module name remains **Programs**.

**Deferred — consistent naming (do not start without a dedicated migration plan):**  
1. **Programs schema:** Rename DB to match the mental model that also fits camps — container `seasons`, sellable class `programs` (today’s `programs` → `seasons`, `program_offerings` → `programs`; FKs `season_id` / `program_id`). Routes/code follow in the same effort. Deferred to avoid breaking enrollments, billing, RLS, and imports.  
2. **HR vs Workforce:** Sidebar shows **HR** but many routes/paths still use `/workforce/*`. Align module slug, routes, and folder names when safe (same class of rename as above — high blast radius).  
3. **Donations → Fund Development:** Sidebar/chrome label is **Fund Development** (`lib/donations/fund-development-module-label.ts`); module slug and routes remain `donations` / `/donations/*` until a dedicated DB + path rename.

**Programs → Financial Assistance tabs (July 2026):** Canonical hub is **Finance → Financial Assistance** (`/finance/financial-assistance`): Overview, Submissions, Templates, **Reports** (staff FA awards: participant, year/season, program, original fee, assisted fee, plan; **Remove** restores original fee and supersedes the award), **Payment Plans**. Legacy `/programs/financial-assistance` and `?tab=financial-assistance` redirect appropriately. Awards stored in `program_enrollment_fa_awards` when staff use Mark financial assistance — run **`scripts/185_program_enrollment_fa_awards.sql`** (includes note backfill). Opening Reports imports past FA from notes/charge lines only for enrollments with **no** award row yet (so Remove is not re-imported). Contact profile Program enrollments + Financial show original fee and FA plan. Key files: `fa-awards.ts`, `programs-fa-report-panels.tsx`.

**Offering manage Settings (July 2026):** Cards on top, then tabs — **General** (flyer + color, description, name/department/dates/format/status, **Staff**, **Schedule**), **Registration** (enrollment, participants, **Questions** custom optional/required prompts, capacity, sessions), **Pricing** (billing, fees, discounts, billing schedule). Sticky **Save Changes**. Apply SQL `scripts/200_program_pricing_billing_scope.sql` and `scripts/201_program_offering_registration_questions.sql`. Deep link `?tab=general|registration|pricing`.

**Programs list row actions (July 2026):** Department **Programs** table (`ProgramOfferingsListPanel`) has a ⋯ menu per row: **Edit** (opens manage), **Delete** (only when enrollment count is 0; empty default shells allowed after clearing `is_default`), **Archive** (when registrations exist, or optionally for empty rows). Confirm via alert dialog. Key files: `program-offerings-list-panel.tsx`, `deleteProgramOffering` / `archiveProgramOffering` in `program-offering-actions.ts`.

**Enrollment Window & Eligibility layout (July 2026):** Offering Settings (merged former Enrollment tab) uses horizontal card rows — **Enrollment Window & Type** (multi-select checkboxes for Entire Program / Selected Sessions / Single Session; opens/closes dates; live Open/Closed status badge; waitlist switch) and **Eligibility** (audience, min/max age, gender). Drop-in is not offered in this UI (saving clears it). Waitlist toggle lives in the enrollment card; optional waitlist capacity stays under Capacity when waitlist is on. Key files: `offering-enrollment-window-card.tsx`, `offering-eligibility-card.tsx`, `offering-registration-panel.tsx`.

**Programs flexibility contract (July 2026):** F1–F6 complete + **F7 polish** (dept inherit create, customer effective dates, `?tab=` deep links, admin class attendance view). Run **`180`–`181`**. Contract: [`docs/programs-flexibility-contract.md`](./programs-flexibility-contract.md).

**Department Expenses tab (July 2026):** Programs → Reports **Expenses** moved to department workspace as **Expenses** (`?tab=expenses`), next to Payroll. Filters `program_expenses` by department. Key file: `department-expenses-panel.tsx`.

**Contact Financial transactions (July 2026):** All Transactions drops the Module column (Type remains). Status values are **Succeeded** / **Failed** / **Refunded** (program payments use Succeeded). Enrollment activity is excluded — only payment rows appear. Program payment dates come from `program_charge_schedule`. Every transaction row has actions: **Refund**, **Download Receipt**, **Email Receipt**; donations also get **Link to Pledge**. Key files: `contact-financial-panel.tsx`, `contact-transaction-row-actions.tsx`, `program-payment-refund-actions.ts`.

**Department operating payments / Financial Summary (July 2026):** Replaces Google Sheets trackers for departments like Qur’an Institute for Ladies. **Tabs:** Programs, Enrollments, Schedule, **Financial** (sub-tabs Payroll, Expenses, Financial Summary — separate from Group giving). **Enrollments:** enrollment list (student, year/season, course, teacher, parent/guardian) with filters, cancelled/withdrawn toggle, Export CSV — no payment columns. **Schedule:** weekly class times + session/term list with links to edit. **Payroll:** teachers and childcare providers; log hours; create pay period for all; approve; department heads can **Edit** hours/amount and **Delete** pay lines (including approved). **Expenses:** program expense rows for the department (moved from Programs → Reports). **Financial Summary:** custom start/end periods plus a simple **By month** table (student payments, payroll, profit per calendar month); revenue from Programs billing (no student payment detail UI); approved payroll expenses. URLs: `?tab=financial` (default Payroll), `?tab=financial&section=expenses|budget`; legacy `?tab=payroll|expenses|budget` still resolve. SQLm Programs billing (no student payment detail UI); approved payroll expenses. SQL: `169`–`173`. Key files: `department-group-workspace-client.tsx`, `department-expenses-panel.tsx`, `department-programs-panel.tsx`, `program-catalog-view.tsx`.

**Finance / Payroll (July 2026):** Org payroll queue is **Finance → Payroll** (`/finance/payroll`). Department heads still approve pay on department Financial → Payroll; approved lines appear as **Ready to pay**. Staff with `finance.manage` can **Mark paid** (status `paid` + `paid_at`). Childcare providers show a Childcare badge. Run **`scripts/187_finance_module_and_payroll_paid.sql`** and **`scripts/192_finance_module_sidebar_restore.sql`**. Event childcare hours: (1) Event Management → event → Childcare → **Log provider hours** (department from the event), or (2) Reports → Childcare Registrations → **Log hours** on a session card (standalone sessions require a department picker). Writes `department_staff_hour_logs.childcare_event_id`; run **`scripts/188_hour_logs_childcare_event.sql`**. Queue shows event names. Legacy `/workforce?tab=payroll` redirects to Finance Payroll. Key files: `lib/finance/org-payroll-queue.ts`, `lib/child-care/childcare-event-hours.ts`, `components/finance/finance-payroll-queue-panel.tsx`, `components/child-care/childcare-registrations-client.tsx`.

**Late program payments / academic year (July 2026):** One-time QIL fix: `node scripts/fix-qil-late-payment-dates.mjs --execute` moves schedule `paid_at`/`due_date` after **2026-04-30** to **2026-04-15**. Going forward, Financial Summary attributes installment months with `due_date` **clamped into the year/season** (`lib/programs/program-year-attribution.ts`); Receive payment keeps cash `paid_at` as now but clamps `due_date` into the program window so late receipts still count.

**QIL teacher payroll import (July 2026):** CSV `QIL-Teacher_Payments_2526.csv` (Sept 2025–April 2026) → `department_staff_pay_entries` as **approved** for Quran Institute for Ladies. Updates staff `pay_basis` / rates (Fadia monthly; others hourly $20). Script: `node scripts/import-qil-teacher-payroll.mjs` (dry-run) / `--execute`. Name aliases for spelling variants. Reports under `scripts/reports/qil-teacher-payroll-*.json`.

**Department Head / Director (July 2026):** Mark an employee **Department Head (Director)** on their Employment details (requires a department). Run **`scripts/186_staff_department_head.sql`**. Their contact profile shows a **Department workspace** card (like teacher **Program assignments** → Manage) with **Open workspace** → `/workforce/departments/[id]` (all tabs). Access is scoped via `canViewDepartment` / `canManageDepartment` (`lib/departments/department-access.ts`). Key UI: `contact-department-workspace-panel.tsx`, `contact-employee-panel.tsx`.

**Department-scoped access (July 2026):** Department workspace mutations/views with a known `departmentId` use `canViewDepartment` / `canManageDepartment` from `lib/departments/department-access.ts` (org `staff.view`/`staff.manage` **or** active Department Head for that department). Applies to payroll, budget periods, babysitting, year programs (`canManageDepartment` **or** `programs.manage`), department staff assign/update, and giving-group link helpers. Creating/deleting departments on the org list remains org-wide `staff.view`/`staff.manage`. SQL for head flag: `186`.

**Settings → Users list fix (June 2026):** `/settings/users` now loads members via `fetchOrganizationUsersForSettings()` (service role + `settings.users.view`) instead of browser Supabase queries limited by RLS — admins see all org members (e.g. invited Super Admins), not only their own row. Row menu supports **Change Role**, **Edit Profile** (name + login email), **Send Reset Email** (Supabase recovery link to `/auth/confirm`), and **Delete** (removes org membership; blocks self-delete and last Super Admin). Actions require org system admin or `settings.users.manage`; audit log entries: `member.profile_updated`, `member.password_reset_sent`, `member.removed`. Key file: `lib/organizations/organization-users-actions.ts`.

**Contacts add form (June 2026):** Add Contact no longer requires affiliations at create time; donor and other tags sync from activity or can be set on the contact profile.

**Merge duplicate donor contacts (June 2026):** When the same entity was imported twice (e.g. `MSAADA` and `MSAADA Educational Foundation`), merge into one canonical contact. **Individuals only** in the UI — groups and organizations cannot be merged (UI hidden; server rejects). **CLI** supports organizations and groups (moves `contact_group_members` before deleting the source group). **UI:** contact profile **Merge duplicate** (keep this record, search for the duplicate) or list row **⋯ → Merge into another contact** (remove this row, search for the record to keep). Preview shows payments/pledges moved before confirm. Requires `contacts.manage`; merge actions use the service-role client after that gate so payment/pledge counts and relinks work without separate `donations.view`. **CLI:** `node scripts/merge-donor-contacts.mjs` (`--search`, `--target-id`, `--source-id`, `--rename`, `--execute`). Logic: `lib/contacts/contact-merge.ts`, `lib/contacts/contact-merge-actions.ts`, `components/contacts/contact-merge-dialog.tsx`. Keeps the **target** contact’s name unless `--rename` is set; reassigns pledges/payments/donor rows, notes, roles; syncs all linked payment `sender_name` values to the canonical contact name; deletes source; syncs affiliations. **All Payments** list displays the linked contact/donor name (not stale import `sender_name`).

**Donor affiliation after first payment (June 2026):** … **People → Donor filter** lists contacts with at least one non-voided payment (`search_donor_giving_contact_ids`, migrations `129` + **`130` grants**), not only stored affiliation tags. **Orphan donors** (missing or stale `contact_id`) are excluded from People until linked — repair: `node scripts/link-orphan-donors-to-contacts.mjs --execute` (creates/matches contacts, merges duplicate donor rows, backfills payment `contact_id`), then `node scripts/sync-donor-affiliations.mjs --execute`. Key files: `lib/contacts/contact-list-actions.ts`, `scripts/link-orphan-donors-to-contacts.mjs`.

**Contacts search fix (June 2026):** Contact list search no longer references `primary_contact_name` when that column is absent in the database — fixes production search errors after bulk import.

**Contact profile homepage (July 2026):** Redesigned toward header + tabs + Overview right rail: sticky header (avatar initials, name, status, role badges, phone/email/location, Edit / More / + New), tabs **Overview** | **Financial** | **Activity** only (no Participation, Workforce, or Notes tabs). Overview uses a main column of cards (Contact Information with bio/notes, Family, **Activity** feed (last 5 timeline items → View all), Related Activity with lifetime/last-gift/enrollment snapshots by enabled modules) plus a right rail: **Quick Actions** (Add Donation/Pledge/Note/Register when modules allow) and **Financial Summary** (lifetime giving, gifts, pledges, rentals when enabled → View financial details). **Programs** Related Activity / enrollments / Financial program payments count enrollments where the contact is **participant, registrant, or payer** (not participant-only). Quick Action / + New **Add Note** opens Overview in edit mode. **Financial** uses a homepage-style layout: KPI cards, Financial by Module chart + Recent Transactions, detail sub-tabs, and a right rail (see Contact Financial below). **Activity** = timeline (+ applications when enabled) and, when the contact has relevant activity, participation panels (membership groups, program enrollments/assignments) and workforce panels (employee/volunteer/vendor/etc.). Footer shows created date. Legacy `?tab=home|details|overview|notes` and `?section=activity` map to the new tabs (`notes` → Overview); `?tab=participation|workforce` map to Activity. Staff employee profile links that used the workforce tab now land on Activity. Key files: `components/contacts/contact-profile-client.tsx`, `components/contacts/contact-profile-header.tsx`, `components/contacts/contact-profile-overview-rail.tsx`, `lib/contacts/contact-profile-path.ts`, `lib/contacts/contact-profile-module-access.ts`.

**Contact profile module gating (June 2026):** Contact detail panels respect org-enabled modules from `/api/organizations/sidebar-modules` — e.g. MAS Dallas (donations-only) omits venue rentals and participation/workforce/applications surfaces under Activity (those panels appear under Activity only when the contact has relevant activity and the module is enabled). Key files: `lib/contacts/contact-profile-module-access.ts`, `components/contacts/contact-profile-client.tsx`.

**Contact profile admin parity (June 2026):** Staff contact profile **Overview** mirrors the customer portal profile: editable address, bio/notes, date of birth, gender, and family members (add/remove). Creating a new family member on staff Overview creates a **person** only (no contact profile / no People list row). Profile name links appear only for members who already have a real contact profile (linked existing contact, or contact with email/phone/roles/payments/donor record); auto-created shell contacts are not linked in the UI. **Payment methods** (stored credit/debit cards on the contact profile) are on the **Financial** tab with **Add Card** (full card number and security code at entry; only last 4, expiration, and cardholder name persist). Customer portal **Profile → Payment Methods** uses the same `ContactPaymentMethodsPanel` and persists via `lib/customer/customer-payment-method-actions.ts` (loaded in `loadCustomerProfilePortalData`). Apply migration `138_contact_payment_methods.sql`. **Date of birth** is optional on staff contact edit and when staff add a family member (email and phone optional too); it remains required on customer signup and customer family-member add. Key files: `components/contacts/contact-basics-panel.tsx`, `components/contacts/contact-family-panel.tsx`, `components/contacts/contact-payment-methods-panel.tsx`, `lib/contacts/contact-payment-method-actions.ts`, `lib/contacts/contact-profile-admin-actions.ts`.

**Family giving / households (July 2026):** Donations remain on **individual contacts** only — no `family_id` on `payments`. New tables `families` + `family_members` (migration **`148`**) backfill from `person_relationships`; removing a member sets `end_date` (gifts stay on the contact). **Contacts → Families** list is a simple household directory (family name, primary contact name/email/phone/address, member count) — not donation-tied; click a **family** or **primary contact** to open the **primary contact** profile (canonical record). Legacy `/contacts/families/[id]` redirects there. Household name / head edit lives on the contact **Family** card. **Donations → Reports → Donors** toggles **Individual Giving**, **Household Giving**, and **Group Giving** (household RPC `donation_household_giving_report` / **`149`**; group RPC `donation_group_giving_report` / **`166`** — only groups with gifts or attributions in the selected period). Tax receipts stay on the donating contact. Adding/removing family on a contact profile syncs `family_members` via `lib/contacts/family-sync.ts`. **Household management (July 2026):** Contact profile **Family** tab — **Link existing contact** joins a real contact into the household for giving rollups; create new member adds a **person** only (no contact profile / People row). Name links only when the member already has a real contact profile (not an auto-created shell). Banner links to household giving page. **Remove member** ends household membership only — the contact and all donations stay on their individual record (divorce / separation). **Household settings** on `/contacts/families/[id]` — edit household name, change primary contact / head, and remove members from the Members table (`lib/contacts/family-management-actions.ts`, `components/contacts/family-settings-panel.tsx`, `components/contacts/family-members-panel.tsx`). Linking ends the member's prior solo household when they were the only active member. Key files: `lib/contacts/family-giving-data.ts`, `lib/contacts/family-actions.ts`, `components/contacts/family-giving-detail.tsx`, `components/contacts/contact-family-panel.tsx`.

**Configurable automatic affiliations (June 2026):** Contacts → Settings → **Affiliations** lets each org turn activity-based affiliations on/off. Defaults follow subscribed modules (e.g. venue-only orgs have Donor off when Donations is not enabled). Stored in `organization_affiliation_settings`; enforced by `sync_contact_affiliations` (migration `115`). Manual affiliations on contact profiles are unchanged. Files: `lib/contacts/contact-affiliation-settings.ts`, `components/contacts/affiliation-rules-panel.tsx`, `scripts/115_organization_affiliation_settings.sql`.

**Contacts profile edit (June 2026):** Contacts list **View & edit profile** (and row click) opens `/contacts/[id]?edit=1` with the Contact information form in edit mode. Profile header includes **Edit contact**; record type and primary contact are editable on save. Files: `components/contacts/contact-profile-client.tsx`, `components/contacts/contact-basics-panel.tsx`, `lib/contacts/contact-profile-path.ts`.

**Donation contact picker (June 2026):** Add Pledge and Record Payment search **org contacts** (name, email, phone), not only existing `donors` rows. On save, `ensureDonorExtensionForContact` creates the donor extension when needed. Add Pledge shows an **Add contact** button when search returns no matches; quick-add dialog supports **Person / Organization**, primary contact name for organizations, and auto-suggests Organization when the name looks like a company (LLC, Inc, etc.). Donor affiliation syncs on **first payment**, not pledge creation. Key files: `lib/donations/donation-list-actions.ts`, `components/contacts/quick-add-contact-dialog.tsx`.

**Pledge reassignment (June 2026):** **Edit Pledge** on **Campaigns → Pledges** (`/donations/pledges`) and contact profile **Financial → Pledges** includes an **Assigned to** picker (person, organization, or group). Saving reassigns the pledge to the selected contact’s donor record and moves linked **payments** and **pledge reminders** with it; affiliation sync runs on both old and new contacts. Use this to move historical pledges from an individual to a group (e.g. Quran Institute). Key files: `lib/donations/pledge-admin-actions.ts` (`updatePledgeAction`, `reassignPledgeContact`), `components/donations/pledge-contact-picker.tsx`, `components/donations/donor-pledges-tab.tsx`, `app/(dashboard)/donations/(operations)/pledges/page.tsx`.

**Contact Financial → cross-module summary (June 2026 / layout July 2026):** Contact profile **Financial** tab is a read-only summary hub (not a second ledger). **Layout (July 2026):** KPI cards — **Lifetime Giving**, **Total Paid**, **Outstanding Balance**, **Last Payment** (each with subtitles) — plus an **All Time** period selector (All Time only for now). Two-column middle: **Financial by Module** doughnut chart and **Recent Transactions** (**View all** opens a full-list sheet). Detail sub-tabs: **Recurring** | **Pledges** | **Invoices** (placeholder) | **Refunds** | **Payment Methods** (module-gated). Right rail: **Financial Summary**, **Payment Methods**, **Statements** (and a **Membership** placeholder when the membership module is on). Footer: “All financial information is associated with {contact}.” **Open Balances** still opens from the Outstanding Balance KPI (or rail link) as a sheet; it lists unpaid pledges, venue rental payment lines, and program fee balances from existing tables. **Transactions** show actual payments only (no pledges) with the same row actions as One-Time Reports (**Refund**, **Link to Pledge**, **Download/Email Receipt**; click date still opens Edit). **Payment Plans** use donor-scoped **Reports → Recurring** actions: Edit, Change Card, Receive Payment, Pause/Resume, Cancel, New Plan; **Completed** plans are view-only — create a new plan instead of reactivating. **Pledges** use `DonorPledgesTab` (Edit, Payment Plan, Receive Payment, Mark as Paid, Cancel, reminders). **Payment Methods**: staff add cards on the Financial tab (and rail); contacts can also add cards from **Profile → Payment Methods** in the customer portal (same saved list). **Statements**: generate, preview, download, or email annual giving statements when donations apply. Profile ⋮ **Receive Payment** shows the contact name under the title (no Contact field); **Apply to** is a one-time donation, an open pledge, or an open payment plan (program/failed-payment targets to follow). The separate **Donations** filter tab was removed — gifts appear under transactions. Table columns: **Type** = activity kind (Donation, Pledge, Programs, Venue Rental, …); **Description** = campaign name for pledges, One-Time/Recurring Donation for gifts, program name for programs; **Status** = for donations: **Succeeded**, **Failed**, **Refunded**, or **Partially Refunded** (imported/unallocated gifts show **Succeeded**); for pledges: **Open**, **Partial**, **Fulfilled**, or **Cancelled**. **Date** is clickable: donation **payments** open an inline **Edit Payment** dialog; **pledges** open an inline **Edit Pledge** dialog on the same contact profile; venue rentals and other modules follow their linked record. Pledge commitments appear under the **Pledges** sub-tab; gift payments appear under transactions even when later linked to a pledge. Key files: `components/contacts/contact-financial-panel.tsx`, `components/donations/donor-recurring-panel.tsx`, `lib/contacts/contact-financial-actions.ts`. **Contact profile navigation (July 2026):** Breadcrumbs handle return paths (e.g. **Dashboard > Contacts > People**); the redundant profile back button was removed. `returnTo` query param and session-tracked paths still apply for **Open full profile** links and post-delete redirects. Key files: `components/contacts/contact-profile-client.tsx`, `lib/navigation/return-to.ts`.

**Contact Financial → Pledges + reminders (June 2026 / July 2026):** Contact profile **Pledges** section uses `DonorPledgesTab` (Edit, Payment Plan, Receive Payment, Mark as Paid, Cancel Pledge, reminders) so actions stay in sync with donor workflows.

**Payment import & match (June 2026 — unified flow):** Under **Payments** → **Import** (`/donations/payments/import`; Upload + History sub-tabs) and **Match Payments** (`/donations/payments/match`). Upload CSV → payments are created immediately in the match queue (`pending_review`) in **100-row server chunks**. **Auto-match after import** is on by default: high-confidence contact matches (≥85%, email/phone/exact name) link automatically; **name-only imports with no ≥85% match auto-create a new contact** from the payment sender name (no email/phone on the row). Weak partial matches (e.g. shared “Dr.”) are not shown as suggestions. Remainder with email/phone but no match stays for manual review. **Auto-allocate to best pledge** (default on with auto-match) uses `lib/donations/payment-pledge-allocation.ts`: prefers **lump-sum** (`one_time`) open pledges over **installment** schedules (`monthly`, `quarterly`, `yearly`); skips installment pledges when donor has an active `recurring_donation_plans` row and a lump-sum pledge exists; leaves payment **unallocated** when two pledges tie on top balance. Bulk auto-match and **Quick Apply** share the same picker. Migrations `116`–`118`. Key files: `components/donations/payment-import-match-workspace.tsx`, `lib/donations/payment-import-match-actions.ts`, `lib/donations/payment-contact-matching.ts`, `lib/donations/payment-pledge-allocation.ts`. Legacy `/donations/import` and `/donations/reconcile` redirect to the new Payments routes.

**Payment reconcile matching (June 2026):** Superseded by unified Import & Match flow above. Legacy `/donations/reconcile` redirects to `/donations/payments/match`.

**Campaign progress gauge (June 2026):** Speedometer-style fundraising gauge on `/donations/campaigns` (card grid for campaigns with goals) and campaign detail **Goal Progress**. Red/orange/green arc, needle, and total raised; supports exceeding 100% of goal. Component: `components/donations/campaign-progress-gauge.tsx`.

**Campaign source breakdown (June 2026):** Campaign detail (`/donations/campaigns/[id]`) shows fundraising metrics in a **colorful table** (Cash, Checks, Square, One-Time, Recurring, Ticket Sales, Donors, Largest Gift, Pledges last with highlight) plus **Goal Progress** gauge on the right. **Per-campaign metric customization:** **Customize** on the overview table toggles visible rows and order; **Automatic** mode (default) hides empty source rows such as Ticket Sales or Square until they have activity. Stored in `campaigns.overview_metric_keys` (migration `134`). Below metrics: **Outstanding Pledges** table for the campaign (donor with **Primary contact** subline for organizations/groups or colored group badges for individuals, pledged/paid/balance in red, status with orange **Open** badge, date, **Actions** menu linking to pledge view/edit/payment on `/donations/pledges`). Donor names open **Contact profile in a modal** (`ContactProfileDialog`) from outstanding pledges, campaign donors list, and largest-gift row. Logic: `computeCampaignSourceBreakdown`, `fetchCampaignOutstandingPledges` in `lib/donations/campaign-analytics.ts`; metric config: `lib/donations/campaign-overview-metrics.ts`; UI: `campaign-source-breakdown-cards.tsx`, `campaign-overview-metrics-editor.tsx` (`CampaignOverviewMetricsTable`), `campaign-outstanding-pledges-table.tsx`.

**Donations payment methods (June 2026):** Removed **Payment Methods** tab from Donations → Settings; org cards on file are managed under **Billing** (`/billing`). Existing `payment_methods` rows remain for donation source labels where referenced.

**Contact timeline reset (July 2026):** Contact profile **Timeline** tab hides import-sourced payments/pledges and events before `organizations.contact_timeline_reset_at`. Financial tab and reports are unchanged. Run migration **`154`**, then: `node scripts/clear-contact-timelines.mjs --org <uuid> --execute` (backs up and deletes `contact_activities`, sets reset timestamp). Rules: `lib/contacts/contact-timeline-rules.ts`.

**Donor contact enrichment import (July 2026):** Bulk match/create contacts from a donor directory CSV and fill missing email/phone without overwriting existing values. Tool: `node scripts/enrich-donor-contacts-from-csv.mjs --file <csv> --execute`. Matches by email → phone → exact name → fuzzy name (≥85%); creates unmatched rows; ensures `donors` extension; runs `sync_contact_affiliations` per affected contact. Report JSON under `scripts/reports/enrich-donor-contacts-*.json`.

**MAS campaign ledger import (June 2026):** Historical pledge/payment spreadsheet import via `node scripts/import-mas-campaign-ledger.mjs --file <csv> [--campaign <name>] [--execute] [--create-campaigns]`. Dry-run by default. **Payments-only import:** `--payments-only` for CSVs with **no Pledge/Balance** — one-time payments only (no pledges). With **Group Name** → group attribution + membership links (`GroupDonationsImport.csv`). Without group column → individual one-time gifts (`One-Time-Donations.csv`). Campaign alias: `Ramadan2025` → `Ramadan 2025`. **Ledger semantics:** `Pledge` = explicit commitment; `Cash`/`Checks` = direct payments; `One-time`/`CC` = one-time card payment toward a pledge; `Recurring`/`CC+` = installment payments toward a pledge. When payment columns are empty but **`Total Received`** is set (fully paid rows), that amount is used as the payment total. **Blank Pledge + payment(s)** → implicit fulfilled pledge equal to total payments on the row (no outstanding balance). Tag: `MAS_CAMPAIGN_LEDGER_V1`. Skips spreadsheet summary rows (`Total`, `Subtotal`, `Grand Total`). **Group names** (e.g. `Wednesday Halaqa`) import as `contact_type = group`, not People. **Square terminal batches:** ledger rows named `Square` import as campaign batch deposits (`source: square`, no People contact) and appear on the campaign overview **Square** line alongside Cash/Checks. **Repair existing Square donor:** `node scripts/clean-mas-ledger-square-batch.mjs --execute`. **Reclassify group mis-imports:** `node scripts/reclassify-mas-ledger-group-contacts.mjs --execute` (after migration `132`). **Repair existing imports:** `node scripts/repair-mas-ledger-implicit-pledges.mjs [--execute]` — creates missing implicit pledges and links unallocated MAS-tagged payments without re-importing. If CSV campaign spelling differs from an existing record (e.g. `Ramadan2025` vs `Ramadan 2025`), merge with `node scripts/merge-mas-ramadan2025-campaign.mjs --execute`. Erroneous summary donor cleanup: `node scripts/clean-mas-ledger-total-donor.mjs --execute`. Placeholder donor cleanup (names that are only `?`, start with `?`, or high `?` ratio without a real Latin name): `node scripts/merge-mas-anonymous-placeholder-donors.mjs [--target "Anonymous"] [--target-id <uuid>] [--execute]` — reassigns pledges/payments to the canonical Anonymous donor and deletes source donors/orphan contacts. Report: `scripts/reports/mas-anonymous-placeholder-donor-merge-<date>.json`.

**Donations pilot blockers (June 2026):** Migrations `119`–`120` — voided payments excluded from `pledge_status_view` balances and headline totals; cancelled pledges emit `calculated_status = cancelled` (excluded from Collect/allocation); portal pledge pay saves `status = allocated`. Validation: `lib/donations/pilot-blocker-validation.test.ts`. Apply: `119_donations_pilot_blocker_views.sql`, `120_donations_pilot_blocker_totals.sql`.

**Donations sidebar (July 2026):** Under Fund Development: **Overview**, **Campaigns** (campaign list + detail; no nested items), **Pledges** (standalone at `/donations/campaigns/pledges`), **Reports** (flat link — no nested sidebar items), **Settings**. Report destinations (One-Time Donations, Recurring Donations, Donors, Import, Match Payments, Receipts) are **tabs below the KPI cards** on `/donations/reports/*` via `DonationReportsNav` / `DonationReportsTabs`. Legacy `/donations/pledges` and `/donations/reports/pledges` redirect to the Pledges page. Campaign detail still includes **Add Pledge**. **New campaign → fund (July 2026):** Creating a campaign on `/donations/campaigns` also creates an open fund under category **General Donation** with the same name (`ensureCampaignDonationFund` / `ensureCampaignDonationFundAction`); creates the category if missing; skips if a matching fund already exists. Editing a campaign does not rename the fund.

**Pledge collection merged into Pledges (June 2026):** Collect tab removed; collection reminders, last-contacted dates, and inline reminder actions live on **Campaigns → Pledges** (`/donations/campaigns/pledges#collection-queue`). Legacy `/donations/collect` redirects to the same anchor.

**Donors giving report (June 2026):** Reports → **Donors** (`/donations/reports/donors`) … Donor names link to the **canonical contact profile** Financial tab (`/contacts/[contactId]?tab=financial`), not a separate donor page. Cross-module financial summary, pledge management, giving statements, and recurring gifts live on that tab via `ContactFinancialPanel`. Legacy `/donations/donors/individuals/[id]` and `/donations/donors/organizations/[id]` redirect to the contact profile when `donors.contact_id` is set. Contact basics and notes remain on the profile **Overview** tab. Apply `scripts/127_donor_giving_report.sql`, `scripts/128_donor_giving_report_contact_id.sql`, `scripts/143_donor_giving_report_type_fix.sql` (date cast + net amounts), `scripts/144_donor_giving_report_summary_gift_count_cast.sql` (summary gift_count bigint cast), `scripts/145_donor_giving_report_email_search.sql` (search by donor/contact email), and `scripts/146_donor_giving_report_min_total_given.sql` (minimum total given filter).

**Receipts tab merged (June 2026):** Reports **Receipts** (`/donations/reports/receipts`) combines receipt summary metrics + year-end giving statements table. Per-donor **⋯** menu: View statement, Download PDF, Send statement email. `/donations/reports/tax-receipts` redirects to Receipts. Per-payment receipt actions remain on Payments (`PaymentReceiptActions`).

**Tax Receipts duplicate donor rows (June 2026):** `donation_donor_tax_year_totals` now groups by `donor_id` only (not `sender_name`). App merges RPC rows defensively in `mergeDonorTaxYearTotals`. Apply: `scripts/126_donation_tax_year_totals_group_by_donor.sql` (or re-run updated `125` on fresh installs).

**Pledges summary cards (June 2026):** Pledges page stat cards match Donations Overview styling (colored left border, rounded icon badges). File: `app/(dashboard)/donations/(operations)/pledges/page.tsx`.

**Donation attribution fields (June 2026):** Add Pledge / Record Payment forms pick **Fund** first (enabled); **Category** auto-fills from the fund and is read-only when funds exist. Manage categories and funds under **Donations → Settings → Categories** (`donation_categories`, `donation_subcategories`). **Fund close (July 2026):** `donation_subcategories.is_active` (migration `161`); closed funds show **Closed** in settings, are omitted from customer/staff fund pickers for new gifts, and remain on historical pledges/payments. Toggle **Accept new gifts** in the Edit Fund dialog. Settings **Funds** table defaults to **open** funds with **View all** for closed. **Customer dashboard Donation Options (July 2026):** lists every donation category (`buildCustomerOpenDonationCategories` in `lib/customer/customer-open-donation-categories.ts`); the **Specific Fund** picker appears only when that category has open funds. Categories with no open funds (or only closed funds) accept category-level gifts without picking a fund. Customer donations validate open funds in `validateCustomerDonationAttribution` (portal UI, Stripe checkout, offline server action); migration `162` blocks portal payment inserts to closed funds at the database layer. Files: `components/donations/donation-attribution-fields.tsx`, `app/(dashboard)/donations/settings/page.tsx`, `lib/donations/donation-fund-status.ts`, `lib/customer/customer-open-donation-categories.ts`, `lib/customer/customer-donation-actions.ts`.

**The Asad Realty org removed (June 2026):** Deleted dev/stress org `95c4eb7d-b151-4aa1-a489-a3c1e1289c7e` and org-scoped data (~7.5k payments, 1k donors, campaigns, contacts, etc.). **MAS Dallas pilot org preserved.** Backup: `scripts/backups/organization-delete/organization-delete-95c4eb7d-...json`. Tools: `node scripts/delete-organization.mjs` (dry run / `--execute --confirm-name=...`), `node scripts/cleanup-organization-orphans.mjs` for leftover rows. Auth users with **only** Asad membership were removed; `heyamasad220@gmail.com` kept (MAS membership).

**MAS Dallas program registrations cleared (June 2026):** Removed 4 experimental enrollments (Youth Seasonal Camps), 3 charges, 9 charge lines, and related status/lifecycle rows. Preserved programs catalog (2 programs), sessions, offerings, and registration options. Reset program `enrolled`/`waitlist` counters. Backup: `scripts/backups/program-registrations/`. Report: `scripts/reports/mas-program-registrations-cleanup-2026-06-16.json`. Tool: `node scripts/clean-mas-program-registrations.mjs --execute`.

**MAS Dallas donations seed config cleared (June 2026):** Removed `DONATIONS_DEV_SEED_V1` categories, subcategories, payment methods, campaign, seed contacts/donors, pledges, payments, and **orphaned `donation_receipts`** (2 rows left after ledger delete). Reports overview/collection/receipts should read $0 / 0 pledges after tab refresh. Tool: `node scripts/clean-mas-donations-seed.mjs --execute`. Report sub-pages refetch on navigation (`app/(dashboard)/donations/reports/**/page.tsx`).

**MAS Dallas pilot full reset (July 2026):** Pre-launch wipe of **all contacts + donations data** for org `e057e00a-e4e3-4adf-9af5-f465db1894be` (~2,510 contacts, 895 donors, 1,149 payments, 1,256 pledges, 8 campaigns) while preserving org, auth users, roles, `donation_settings`, programs catalog, and modules. Backups: `scripts/backups/mas-pilot-full-reset/`. Report: `scripts/reports/mas-pilot-full-reset-2026-07-01.json`. Tool: `node scripts/clean-mas-pilot-full-reset.mjs` (dry run) / `node scripts/clean-mas-pilot-full-reset.mjs --execute --confirm-name="MAS Dallas"`. Re-import campaigns after CSV cleanup via `import-mas-campaign-ledger.mjs`. **July 2026 re-import progress:** Organizations ledger (84 rows → 7 campaigns, 84 pledges, 41 payments); group donations (452 rows → 452 one-time payments, 37 groups, 0 pledges); one-time donations (437 rows → 434 payments, 0 pledges); **individual pledges** (`All CampaignsPledges.csv`, 373 rows → 370 pledges, 316 payments, 129 new contacts, 54 unpaid/partial). **Ramadan2025 → Ramadan 2025** duplicate campaign merged (`merge-mas-ramadan2025-campaign.mjs --execute`: 2 pledges + 1 payment reassigned, duplicate deleted). Reports: `mas-campaign-ledger-import-group-donations-2026-07-01.json`, `mas-campaign-ledger-import-one-time-donations-2026-07-01.json`, `mas-campaign-ledger-import-all-2026-07-01.json`, `mas-ramadan2025-campaign-merge-2026-07-01.json`.

**MAS Dallas Square donations import (July 2026):** `MadinaDonationsActive07032026.csv` (9,921 rows) imported via `scripts/import-madina-square-donations.mjs --execute`. Created **4 donation categories** (General Donation, Zakat, Operations, Family Emergency Takaful Fund) and **13 funds** (subcategories). **9,099 payments** inserted as unallocated import rows (`MADINA_SQUARE_DONATIONS_V1` memo tag); skipped 100 zero-amount rows, 231 within-file duplicates, 491 campaign-ledger overlaps (donor + amount vs `MAS_CAMPAIGN_LEDGER_V1`). **648 new donors/contacts** matched or created; donor affiliations synced. Report: `scripts/reports/madina-square-donations-import-2026-07-03.json`. Re-run safe (hash idempotency skips already-imported rows). **Rollback (July 2026):** `scripts/remove-madina-square-donations-import.mjs --execute` removed all **9,099** tagged payments (~$1.57M) and **502** Square-linked recurring plans created from those payments. Report: `scripts/reports/madina-square-donations-removal-2026-07-07.json`. Contacts/donors created during import were kept; **17** recurring plans from `RecurringDonations07032026.csv` (`import-madina-recurring-plans.mjs`) remain. **Recurring plan linking (July 2026):** `scripts/link-square-recurring-plans.mjs --execute` groups imported payments by donor+amount+frequency+category into `recurring_donation_plans` and sets `payments.recurring_donation_plan_id`. Explicit CSV **DAILY/WEEKLY/MONTHLY** rows plus **inferred** recurring from Square `ONE_TIME` rows (same donor+amount+category, 4+ payments over 14+ days). Plans with last payment within 60 days are **active**; older ones **completed**. Migration **`155_recurring_daily_frequency.sql`** adds `'daily'` to the frequency constraint. Contact Financial tab shows **Daily/Weekly/Monthly Recurring Donation** when `recurring_donation_plan_id` is set (`lib/contacts/contact-financial-actions.ts`). Report: `scripts/reports/square-recurring-plans-2026-07-03.json`. **Square recurring plans CSV (July 2026):** `RecurringDonations07032026.csv` (205 rows) synced via `scripts/import-madina-recurring-plans.mjs --execute` — **17 new plans** inserted, **180 existing** updated with Square status/dates/`total_payments`/`payments_made`; **Sustainers Campaign** mapped to category **General Donation** / fund **Sustainers Club**; **Qays Hawwar** skipped for manual review; 7 rows skipped (donor not found). Migration **`156_recurring_plan_payment_counts.sql`** adds `total_payments` and `payments_made` on `recurring_donation_plans`. **Category/fund repair (July 2026):** `scripts/fix-sustainers-recurring-category-fund.mjs --execute` corrected **9** plans that had category/fund swapped during import. Reports → **Recurring Donations** table shows donor, category/fund, frequency, plan start/end, total payments, amount, payments made, status, and next payment (`components/donations/donation-recurring-panel.tsx`). Row **⋯** menu (blue icon): **Edit Plan** (amount, frequency, dates, total/made counts, category/fund, notes), **Change Credit Card** (assign `contact_payment_methods` card), Record Payment, Pause/Resume, Cancel. Requires migration **`157_recurring_plan_contact_payment_method.sql`**. Report: `scripts/reports/madina-recurring-plans-import-2026-07-03.json`.

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

* **Catalog** (`/programs/catalog`) — page title **Programs**; lists **active offerings** (sellable programs) under open years/seasons as read-only cards (search + department filters; flyer or staff-picked background color with program name; year/season subtitle; enrollment progress; no view/edit menu — edit from department workspace). Run **`scripts/191_offering_catalog_branding.sql`**.
* **Program detail** (`/programs/[id]`) — only for orphan years (no `department_id`). Years with a department redirect to **HR → Departments → Overview** (`?year=…`); `?tab=settings` → Settings → **Year defaults**; legacy `?tab=offerings` → Programs; `?tab=reports` → Enrollments. Key files: `program-detail-client.tsx`, `department-overview-panel.tsx`, `department-year-configure-dialog.tsx`, `department-programs-panel.tsx`, `department-participants-panel.tsx`.
* **Offering manage** — Settings surface (registration, fees, schedule, staff, sessions). Department-linked: `/workforce/departments/[id]/programs/[programId]/offerings/[offeringId]` (keeps Departments sidebar). Orphan / Programs-module: `/programs/[id]/offerings/[offeringId]` (redirects to department URL when `department_id` is set). Attendance & Waitlist: `/programs/reports?tab=attendance|waitlist`.
* **Quick Create** (`/programs/create`) — basics + eligibility; redirects to **program detail** after save (or department when assigned).
* **Retired Edit Program** (`/programs/[id]/edit`) — redirects to program detail (General) or offering manage (Offerings / legacy tab deep links). Billing route redirects to offering Fees.
* **Service Needs** on **HR → Departments → [department] → Settings → Service Needs** (`?tab=settings&section=service-needs`). Department **Settings** also holds General / **Year defaults** (`?section=year-defaults` — year picker + `ProgramDefaultsSettingsPanel`; prefill from `?year=`), Registration / Notifications stubs (`department_program_settings`), and **Promo Codes** scoped to the whole department across years (`discount_codes.department_id`). Legacy `/programs/settings` and `/programs/settings/service-needs` redirect to `/workforce?tab=departments`. Key files: `components/departments/department-settings-panel.tsx`, `components/departments/department-year-defaults-settings-panel.tsx`, `components/departments/department-promo-codes-settings-panel.tsx`, `components/programs/program-service-needs-settings-client.tsx`, `components/programs/edit/program-service-requirements-panel.tsx`. Apply SQL `scripts/190_department_settings_promo_codes.sql`.
* Shared section components in `components/programs/edit/` (create + detail edit reuse basics; offerings use manage panels)
* Capacity group gender/grade rules (Male/Female parallel pools)

Quick Create collects: name, type, department, description, dates, eligibility, capacity, visibility, draft/active.

Offering manage completes: registration options, fee plans, sessions/schedule, staff.

---

## Programs

Completed:

* Program CRUD
* Departments
* Eligibility fields (min/max age, grade levels, gender)
* Registration types (Offering manage → Enrollment)
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

**Offering manage → Registration → Sessions (July 2026):** Staff can always add/edit sessions from this section via **Add Session** (no longer gated behind Selected Sessions / Day Pass). When those enrollment types are off, a tip still suggests enabling them so customers can register per session. Sessions save immediately. Key file: `program-sessions-editor.tsx`.

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
* Filters (department, offering, payment bucket, status, type)
* Offering column (course; year program as subtitle)
* Adult contact = participant; minor = person under parent Contact (no minor CRM profile)
* Amount / Received / Balance columns (Status only; no Type column)
* Labels: Participant / Contact (not Child / Parent)
* Shared entry from Programs → Reports (**Payments** tab opens Registrations list)
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

* Employees page is roster-only (no Departments/Positions tabs)
* **Departments** is under **HR → Overview** (`/workforce?tab=departments`) and `/workforce/departments`. **List UI (July 2026):** card grid (`DepartmentsManager`) with flyer thumb (or color + initial), name link, description, years/seasons count, and ⋯ menu (**Edit** / **Upload flyer** / **Delete**). Run **`scripts/203_department_flyer_url.sql`** for `departments.flyer_url` (uploads reuse `program-flyers` storage via `ProgramFlyerField`). Department names open `/workforce/departments/[id]`. Tabs: Overview (years/seasons), Programs, **Participants** (`?tab=students`; stages review / approved / roster; legacy rosters/applications), Schedule, **Financial** (Payroll / Expenses / Financial Summary), Reports (archived years). Employees live under Financial → Payroll (merged columns, no email/phone; name → contact; pencil → employment + **pay basis**). Legacy `/workforce/settings/departments`, `/hr/departments` redirect to the Overview Departments tab. Programs sidebar starts at Catalog (not Departments). **Payments** is a tab on Programs → Reports (opens `/programs/registrations`).
* **Positions** live under **HR → Overview → Employees → Positions** (`/workforce?tab=employees&view=positions`). HR sidebar Settings removed.
* Removed: Time Off, Work Schedule, Notifications, Teams, Applications (as employee sub-tabs)
* Removed QuickBooks payroll/scheduling note from copy
* **Contact-first hiring:** Add Employee searches existing Contacts only; if none match, create the person under Contacts first, then add them as an employee (`createEmployeeFromContact`). Same pattern for Add Volunteer.
* **HR Overview tabs (July 2026):** Sidebar HR opens a **child drawer** (Overview, Departments, Employees, Volunteers, Childcare Providers) at `/workforce`, `/workforce/departments`, `/workforce/employees`, `/workforce/volunteers`, `/workforce/childcare`. In-page tabs still switch sections. Org payroll Mark-paid queue is **Finance → Payroll**. Directory Applications use `?view=applications`; Positions use `?view=positions`. Key UI: `components/hr/hr-overview-client.tsx`, `components/hr/hr-overview-route-page.tsx`, `lib/hr/hr-overview-path.ts`. Legacy `/workforce?tab=…` redirects to the matching path; `/workforce?tab=payroll` → Finance Payroll.

### HR directory list pattern

Employees, Volunteers, and Childcare Providers share the same directory shell (`components/workforce/hr-directory-shell.tsx`):

* Header: title, subtitle, Export CSV, primary Add/Review action (default blue buttons)
* Tabs: Directory | Applications (pending count) | Positions (Employees only); Active/Inactive status filter (default Active; Archived tab removed)
* KPI stat cards, search/filters bar, avatar table, 10-per-page pagination

Key files:

* `components/hr/staff-records-client.tsx` — Employees (includes Positions view)
* `components/hr/hr-positions-manager.tsx` — job titles
* `components/workforce/volunteers-list.tsx` — Volunteers
* `components/hr/hr-childcare-panel.tsx` — Childcare Providers

Redirects:

* `/hr/time-off` → `/workforce?tab=employees`
* `/workforce/employees?tab=departments` → `/workforce?tab=departments`
* `/workforce/employees?tab=positions`, `/workforce/settings`, `/workforce/settings/positions`, `/settings/positions`, `/workforce/positions`, `/hr/positions` → `/workforce?tab=employees&view=positions`
* `/settings/departments`, `/hr/departments`, `/workforce/settings/departments`, `/workforce/departments` → `/workforce?tab=departments`
* `/workforce/employees`, `/workforce/volunteers`, `/workforce/childcare` → matching Overview tabs

---

## Child Care

Status: Complete (data wiring)

**Providers:** `/workforce?tab=childcare` (HR Overview)  
**Customer apply:** `/customer/apply/childcare` (Profile → Applications, or **Copy apply link** on the providers directory)  
**Registrations:** `/event-management/reports/childcare` (Event Management → Reports)

Completed:

* Providers under HR Overview → Childcare Providers using the shared HR directory shell
* Customer childcare provider application intake wired to `submitApplication` (`childcare_provider`)
* Approving a childcare provider application creates/links an active `staff` row (`staff_type = childcare`, position Childcare Provider) so event/session hours can post to payroll; existing staff keep employment type and get a childcare position label. Helper: `lib/hr/ensure-childcare-staff-from-application.ts`
* Registrations under **Event Management → Reports → Childcare Registrations** (moved from Workforce; old `/workforce/childcare/registrations` redirects)
* Removed mock provider array
* Providers loaded from approved `childcare_provider` applications
* Provider detail dialog shows real `form_data` from applications
* Empty states for no providers and no event history
* Applications tab / Review Applications link to Applications Submissions tab

Pending:

* Event participation tracking (Total Hours, Events Worked, History tab)

Key files:

* `lib/hr/childcare-provider-actions.ts`
* `components/hr/hr-childcare-panel.tsx`
* `components/child-care/childcare-registrations-client.tsx`
* `app/(dashboard)/event-management/reports/childcare/page.tsx`

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

Status: Relocated

HR application submissions no longer live under Settings. Each type opens on the matching category **Applications** view:

* Employment → `/workforce?tab=employees&view=applications`
* Volunteer → `/workforce?tab=volunteers&view=applications`
* Childcare provider → `/workforce?tab=childcare&view=applications`
* Committee member → `/membership/applications`

**Customer apply (July 2026):**
* Volunteer → `/customer/apply/volunteer` (Profile → Applications; staff **Copy apply link** on Volunteers). Approve creates/links a `volunteers` roster row (`lib/volunteers/ensure-volunteer-from-application.ts`).
* Childcare provider → `/customer/apply/childcare` (Profile → Applications; staff **Copy apply link** on Childcare Providers). Approve creates/links childcare `staff`.

**Application Templates hub removed.** Each type is reviewed under its category Applications tab (customer apply links + staff Copy apply link). **HR Settings removed** — Positions live under Employees → Positions (`/workforce?tab=employees&view=positions`).

Legacy `/settings/applications` (and `/people-management/applications`) redirects to the category Applications tab based on `application_type` (default: employment). `?tab=templates` and `/workforce/settings/application-templates` redirect to `/workforce`. Legacy `/workforce/settings/committee-applications` redirects to Membership Applications. Legacy `/workforce/settings` and `/workforce/settings/positions` redirect to Employees → Positions.

Module shortcut links and directory Applications tabs open the embedded submissions list for that category.

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

### Legacy tables (removed June 2026)

Migrations `140`–`141` drop superseded tables after export via `scripts/cleanup-legacy-donation-staging-tables.mjs`: `donation_payments`, `donation_pledges`, `donation_amount_options`, `donor_import_*`, `contact_import_staging`, `organization_settings`, `payment_import_rows`, and `backup_*_2026_05_24` snapshots.

### Key files changed

* `app/(dashboard)/donations/campaigns/pledges/page.tsx` — pledges CRUD + record payment on canonical tables only
* `app/(dashboard)/donations/page.tsx` — dashboard reads `pledge_status_view` + per-pledge outstanding
* `app/(customer)/customer/donation/page.tsx` — portal writes to `payments` / `pledges`
* `lib/customer/customer-portal-data-actions.ts` — portal reads canonical tables
* `lib/contacts/contact-profile-data.ts` — pledge activity from `pledge_status_view`
* `lib/donations/donation-status.ts` — lowercase status values + display labels

### Pending (not in this phase)

* Committed DDL for `pledge_status_view` / `donor_summary_view` definitions (now in migrations `097`, `116`, `119`, `124`)
* Data migration / backfill from pre-2026 imports (canonical ledger is source of truth)

### Legacy cleanup (June 2026)

```bash
# 1. Export Tier 2 archives + inventory (dry run)
node scripts/cleanup-legacy-donation-staging-tables.mjs

# 2. Delete Tier 2 rows + repair payments missing donor_id
node scripts/cleanup-legacy-donation-staging-tables.mjs --execute

# 3. Apply SQL on linked Supabase
npx supabase db query --linked -f scripts/140_drop_legacy_donation_and_staging_tables.sql
npx supabase db query --linked -f scripts/141_drop_payment_import_rows_and_backup_tables.sql
```

### Dev seed + validation (canonical only)

Dev-only scripts to populate and verify the stabilized ledger.

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
| Staff one-time payment | `components/donations/donation-payments-panel.tsx` (`/donations/payments/one-time`) | Contact picker searches all contacts; attribution pickers on insert; pledge allocate copies FKs from pledge |
| Staff pledge create/edit | `app/(dashboard)/donations/campaigns/pledges/page.tsx` | Contact picker searches all contacts; full FK pickers; edit pledge supports **Assigned to** reassignment (person/org/group) via `updatePledgeAction` |
| Staff pledge payment | `app/(dashboard)/donations/campaigns/pledges/page.tsx` | Copies pledge FKs onto payment |
| Portal one-time / pledge / pledge pay | `app/(customer)/customer/donation/page.tsx` | FKs on insert; optional campaign picker |
| Portal data | `lib/customer/customer-portal-data-actions.ts` | Payments select includes attribution columns; loads **active** campaigns only for customer pickers |
| Recurring plan create | `components/donations/donation-recurring-panel.tsx` (`/donations/payments/recurring`) | Category + fund + campaign on plan |
| CSV import | `app/(dashboard)/donations/payments/import/page.tsx` | Upload CSV + import history; `donations.manage` |
| Match payments | `app/(dashboard)/donations/payments/match/page.tsx` | Match queue; email/phone matching; bulk auto-match; add contact |
| Legacy import URL | `/donations/import` | Redirects to `/donations/payments/import` (or `/donations/payments/match` when `?tab=match`) |
| Legacy reconcile URL | `/donations/reconcile` | Redirects to `/donations/payments/match` |

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

* `STRIPE_SECRET_KEY` — Manaratee **platform** Connect key (not per-org)
* `STRIPE_WEBHOOK_SECRET`
* `NEXT_PUBLIC_APP_URL`

Per-org payout accounts use **Stripe Connect Express** (see below). `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is not used (hosted Checkout).

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

Pledge-via-Stripe. (Stripe **subscriptions** moved to Priority 16.) **Refunds** implemented separately — see Payment admin actions below. Per-org Connect moved to **Stripe Connect Express (June 2026)** below.

## Stripe Connect Express — org donation accounts (June 2026)

Status: Implemented

### Goal

Each organization connects its own Stripe Express account. One-time and recurring donation Checkout sessions run on the connected account (direct charges). **No Manaratee platform fee** on donations — 100% to the org minus Stripe processing.

### Schema (migration `139_stripe_connect_donations.sql`)

On `organizations`:

* `stripe_connect_account_id` (unique partial index)
* `stripe_connect_charges_enabled`, `stripe_connect_payouts_enabled`, `stripe_connect_details_submitted`
* `stripe_connect_onboarded_at`

### Staff UI

* `/donations/settings` → **Online Payments** tab — `DonationStripeConnectPanel`
* Connect / continue onboarding via Stripe Account Links
* Refresh status + open Express dashboard (login link)

### Checkout + refunds

* `createOneTimeDonationCheckout` / `createRecurringDonationCheckout` require a ready connected account (`charges_enabled` + `details_submitted`)
* Stripe API calls pass `{ stripeAccount: acct_… }`
* Staff Stripe refunds use the org connected account

### Webhook

Same endpoint: `POST /api/webhooks/stripe/donations`. In Stripe Dashboard, enable **Listen to events on Connected accounts**. Handles existing donation events plus `account.updated` to sync org Connect status.

### Key files

| Area | Path |
|------|------|
| Connect actions | `lib/stripe/stripe-connect-actions.ts` |
| Connect queries / request options | `lib/stripe/stripe-connect-queries.ts` |
| Account sync | `lib/stripe/stripe-connect-sync.ts` |
| Settings UI | `components/donations/donation-stripe-connect-panel.tsx` |

```bash
npx supabase db query --linked -f scripts/139_stripe_connect_donations.sql
```

### Pending

Platform subscription billing (orgs paying Manaratee monthly) — separate from Connect donations; schema stub in `121_organization_billing.sql`, not Stripe-charged yet.

### Payment edit, void, and refunds (June 2026)

Staff with `donations.manage` can edit, void, refund, and **allocate** payments from **Donor profile → Donation History** (`/donations/donors/individuals/[id]`, `/donations/donors/organizations/[id]`), **Payments → payment detail** (`/donations/payments/[paymentId]`), or **Contact Financial → Financial Activity** (click the payment date). Allocate links unallocated payments to an open pledge for that donor (`allocatePaymentToOpenPledgeAction`).

| Action | Manual / import | App Stripe (`source_type = processor`) |
|--------|-----------------|----------------------------------------|
| Edit amount/date/method | Yes | Notes only |
| Void | Yes | Blocked — use Stripe refund |
| Stripe refund (full/partial) | No | Yes |
| Record refund (ledger only) | Yes | No (except imported rows) |

Imported CSV payments (`source_type = import`) cannot receive in-app Stripe refunds even if the method column says `stripe`; staff refund externally and use **Refund** in the app.

**Totals:** migration `125_payment_refunds_net_amounts.sql` — net amount `amount - refunded_amount` in `pledge_status_view`, `donor_summary_view`, dashboard RPCs, and pledge refresh trigger (also fires on `refunded_amount` updates). Payment statuses: `partially_refunded`, `refunded`.

**Key files:** `lib/donations/payment-admin-actions.ts`, `lib/donations/stripe/refund-payment.ts`, `components/donations/donor-donation-history-table.tsx`, webhook `charge.refunded` in `lib/donations/stripe/checkout.ts`.

```bash
npx supabase db query --linked -f scripts/125_payment_refunds_net_amounts.sql
```

## Stripe recurring donation subscriptions (Priority 16)

Status: Implemented (June 2026)

### Goal

Stripe-powered recurring billing on top of existing `recurring_donation_plans`. Canonical `payments` rows are created only from `invoice.paid` / `invoice.payment_succeeded` webhooks — not at checkout start.

### Schema (migration `100_stripe_recurring_donations.sql`)

* `payments.stripe_invoice_id` — unique partial index for invoice idempotency
* `recurring_donation_plans.stripe_customer_id`
* Plan statuses extended: `pending_setup`, `past_due` (plus existing `active`, `paused`, `cancelled`, `completed`)

### Customer portal

* `/customer/donation` — **Donate** dialog: amount, frequency (one-time / monthly / quarterly / annually), campaign, category/fund; payment picker shows **cards on file** from `contact_payment_methods` (same as Profile → Payment Methods) plus org offline/online methods, with **Add new card** in-dialog
* `/customer/donation` — **Payment History** tab lists all payments for the contact: pledge payments, recurring donations, and one-time donations. Dashboard **Active Campaigns** cards link here with `?campaign={id}&action=pledge` or `?campaign={id}&give=one-time|recurring` to pre-select the campaign.
* `/customer/donation` — **New Pledge** (My Pledges tab): required **campaign** + **total pledge amount** only; pledge date is set automatically. After creating the pledge, donors use **Pay Now** (pay in full or any amount toward balance) or **Set Up Payment Plan** (monthly/quarterly/annually, number of payments, amount per payment, first payment date). Key files: `lib/customer/customer-pledge-actions.ts`, `lib/donations/pledge-payment-plan.ts`, migrations `158_pledge_payment_plan.sql`, `159_customer_pledge_plan_update.sql`
* **Admin/customer pledge alignment (July 2026):** Staff can set or edit the same installment **payment plan** on `/donations/campaigns/pledges` and donor **Pledges** tabs via `updatePledgePaymentPlanAction` + `components/donations/pledge-payment-plan-dialog.tsx` (shared validation in `validatePledgePaymentPlanInput`). Main pledges page **Record Payment** now uses `recordPledgePaymentAction` (balance cap, audit log, affiliation sync). Plan summary and suggested pay amount match the customer portal. Admin `Yearly` frequency stores as `annually` for consistency.
* `createRecurringDonationCheckoutAction` creates `recurring_donation_plans` (`pending_setup`) + `donation_checkout_sessions` (`recurring_setup`) + Stripe Checkout `mode: subscription`
* Success redirect: `/customer/donation?checkout=success&type=recurring&session_id={CHECKOUT_SESSION_ID}`

### Webhook events (`POST /api/webhooks/stripe/donations`)

| Event | Behavior |
|-------|----------|
| `checkout.session.completed` (recurring_setup) | Link `external_processor_id` (subscription), `stripe_customer_id`, activate plan; **no** payment insert |
| `invoice.paid` / `invoice.payment_succeeded` | Insert canonical `payments` with `recurring_donation_plan_id`, `stripe_invoice_id`; auto-receipt when enabled |
| `charge.refunded` | Sync `payments.refunded_amount` and status from Stripe charge totals (donation refunds) |
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
| Year-end statement | Individual or bulk from Reports → Receipts | Same receipt row (`annual_statement`) |
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
* `app/(dashboard)/donations/payments/import/layout.tsx` — `donations.manage`
* `app/(dashboard)/donations/payments/match/layout.tsx` — `donations.manage`
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
* `/donations/reports/one-time` — summary metric cards + server-paginated payments table + search/status filters
* `/donations/campaigns/pledges` — server-paginated table; filters: status, campaign, minimum pledged amount; pledge summary cards reflect the same filters; donor name opens contact profile in a modal (`ContactProfileDialog`). Legacy `/donations/pledges` and `/donations/reports/pledges` redirect here.
* `/donations/reports/donors` — `DonorsReportPanel` via `donation_donor_giving_report` RPC: period (lifetime / calendar year / custom), **column header filters** (Donor, Email, Phone, Total Given min, Last Gift, Pledge), email and phone columns, Pledge status (Open / Partial / Fulfilled) and Outstanding Balance columns, CSV + PDF export. Last Gift filter options: all, gift within 12 months, no gift in 12+/24+ months, never gave. Apply migrations `127`–`146`, **`150`**, **`151`**, **`152`**, **`153`**, **`163`** (report prefers `contacts.full_name` over stale `donors.full_name`; backfills donor name/email/phone from linked contacts). Contact profile name edits sync the linked `donors` row (`syncDonorExtensionFromContact`).
* `/donations` dashboard — executive overview: KPI cards (active campaigns, collected, outstanding, payments this month), **Action Required** (import match queue, payments that may link to an open pledge, overdue pledges, failed receipts, campaigns ending soon), **Active Campaigns** snapshot, **Quick Actions** (record payment/pledge, import, create campaign). **Recent Activity** feed is temporarily hidden while historical imports dominate the timeline. Key files: `app/(dashboard)/donations/page.tsx`, `components/donations/donations-overview-dashboard.tsx`, `lib/donations/donation-overview-actions.ts`

### Operational visibility

* `lib/donations/donation-ops-actions.ts` + `DonationOpsPanel` on **Reports → Match Payments** (`/donations/reports/match`)
* Surfaces failed emails, failed receipts, payments needing donor match (`pending_review` + `unresolved` only — not already-matched `unallocated`), Stripe processor failures

### Email scalability

* `sendBulkAnnualStatementsAction` — parallel batches of 10 (no external queue)

### Remaining scale work

* Recurring plans list not paginated (typically smaller dataset)
* Customer portal payment history unbounded per contact
* Dedicated test org for validation scripts still recommended

### Donations navigation (sidebar consolidation)

Status: Implemented (June 2026)

* Sidebar: **Overview**, **Campaigns**, **Pledges**, **Reports** (flat; report tabs on the page), **Settings** (`components/layout/sidebar.tsx`, `lib/navigation/donations-sidebar-children.ts`)
* **Reports** — in-page tab bar still available (`components/donations/donation-reports-nav.tsx`); same destinations as sidebar nested links:
  * **One-Time Donations** — `/donations/reports/one-time` (summary metric cards + server-paginated payments table: Date, **Donor** (column filter by name), Amount, Method, **Status** (column filter: Succeeded / Failed / Refunded / Partially Refunded; colored badges), **Actions** blue ⋮ menu: Refund, Link to Pledge, Download Receipt, Email Receipt to Donor)
  * **Recurring Donations** — `/donations/reports/recurring`
  * **Pledges** — `/donations/campaigns/pledges` (pledge table with column-header filters on Donor Name, Status, and Campaign; collection queue; add/edit pledge dialogs). Legacy `/donations/reports/pledges` redirects here.
  * **Donors** — `/donations/reports/donors` (**Individual Giving**, **Household Giving**, or **Group Giving** toggle; group report only lists groups with gifts/attributions in the selected period — group gifts + attributed member gifts; RPC `donation_group_giving_report`, migration **`166`**)
  * **Import** — `/donations/reports/import` (Upload + History; `donations.manage`)
  * **Match Payments** — `/donations/reports/match` (manage permission; operational health panel; KPI cards for **Needs match**, **May link to pledge**, **Unresolved**, **Action queue amount**; default filter **Needs match**)
  * **Receipts** — `/donations/reports/receipts`
* **Campaigns** — `/donations/campaigns` (org-wide pledge summary cards + campaign list with add/edit/delete; default table shows **active** campaigns plus the **two most recent** by start date, with **View all** for the full list); **Pledges** tab at `/donations/campaigns/pledges`; campaign detail at `/donations/campaigns/[id]` with **Add Pledge** and outstanding pledges table. Pledge collection reminders at `/donations/campaigns/pledges#collection-queue`.
* Former **Payments** sidebar item removed; payment list/import/match live under **Reports** tabs. Legacy `/donations/payments/*` redirects to `/donations/reports/*`
* Former **Records** sidebar item removed; duplicate read-only tabs (Donations, Donors, Campaigns, Recurring) removed from monolithic reports page
* `/donations/reports` redirects to **One-Time Donations** (`/donations/reports/one-time`)
* Record payment / add pledge remain on donor profile pages; **+ Record Payment** on One-Time Donations list preserved

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
| `/donations/campaigns` | Campaigns Overview — org-wide pledge summary cards; fundraising campaigns table (active + two most recent by default; **View all** expands full list, most recent first) |
| `/donations/campaigns/[id]` | Campaign detail — source breakdown + donor metrics (left), goal gauge (right) |
| `/donations` | Donations executive dashboard — KPI cards, action required, active campaigns snapshot, recent activity, quick actions |
| `/donations/settings` | Categories, **Funds** (subcategories under categories), Online Payments (Stripe Connect), receipt and pledge reminder settings. Campaign CRUD is under **Campaigns → Overview**. Org legal name/address/EIN: **Settings → General** (`/settings/general`). Org billing cards: **Billing** (`/billing`). |

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
| `/donations/settings` | Receipts tab — full receipt config (org legal/address/EIN moved to **Settings → General**) |
| `/donations/donors/individuals/[id]` | Lifetime giving totals; donation history per-payment receipts; annual statement |
| `/donations/donors/organizations/[id]` | Same as individual donor profile |
| `/donations/reports/receipts` | Receipt summary + year-end statements (bulk send, ⋯ per donor) |

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
| `/donations/campaigns/pledges` | Pledge list (filters: campaign, status, min amount), add/edit/pay, last reminder/contacted columns, inline reminder actions, detail dialog |
| `/donations/pledges` | Redirects to `/donations/campaigns/pledges` |
| `/donations/collect` | Redirects to `/donations/campaigns/pledges#collection-queue` |
| `/donations/donors/*/[id]` | Redirects to contact profile Financial tab when linked |
| `/contacts/[id]?tab=financial` | Pledges (with Remind / Mark Contacted), reminder history, donation history |
| `/donations/reports/collection` | Redirects to `/donations/campaigns/pledges#collection-queue` |
| `/donations/reports/pledges` | Redirects to `/donations/campaigns/pledges` |

### Workflow

1. Staff opens outstanding pledge (Pledges page or pledge detail).
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

* `recurring_donation_plans` — donor, amount, frequency, start/next/end dates, status (`active` / `paused` / `cancelled` / `completed`), `total_payments`, `payments_made` (migration `156`)
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
| `/donations/reports/recurring` | Full plan table (donor, category/fund, frequency, plan start/end, total payments, amount, payments made, status); MRR/ARR metrics; create plan; record payment. Status column filter defaults to **Active** (paused / cancelled / completed via row actions or Stripe sync — use Status → All Statuses to see them). Next payment is edited on the plan dialog, not shown as a table column. |
| `/donations/donors/*/[id]` | Active plans, recurring payment history, lifetime recurring giving |

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
| **S-04A/B** | **Programs** (`program_participant`) for enrollments (participant or registrant); **Customer** (`customer`) for events/ticketing + venue rentals (migration `175` after unified `137`) |
| **S-05/S-06** | Portal/staff pledge **payment** → `handleDonationAffiliationSync`; pledge create does not sync donor |
| **S-07** | `createTicketOrder` → `findOrCreateContact` + `ticket_orders.contact_id` |
| **S-08** | Ticketing completion → `syncContactAffiliations` on completed orders |
| **S-09/S-10** | Program `participant_contact_id` via `ensureContactForPerson`; enrollment → `syncContactAffiliations` for **Customer** |
| **S-11** | `ensureVolunteerForContact` fixed — roster + `syncContactAffiliations` only |
| **S-12** | Unified validation runner + shared lib + cross-module role accumulation |
| **S-13** | Documentation closeout — `Features.md`, `Project_Context.md`, `Database_Overview.md`, `Module_Inventory.md` |

### Affiliation derivation (Phase 1)

| Role | Activity trigger | Auto-remove | Sync entry |
|------|------------------|-------------|------------|
| `donor` | Linked `payments` for contact (direct or via `donor_id`) | Never (sticky) | `handleDonationAffiliationSync` / webhook helper |
| `volunteer` | `volunteers` row for contact | Never (sticky) | `syncContactAffiliations` |
| `customer` | Program enrollment (non-terminal), completed ticket order, or venue rental with `billing_contact_id` (status not declined/cancelled/draft) | Never (sticky) | `syncContactAffiliations` |
| `member` | Active `memberships` row | Yes when membership lapses | `syncContactAffiliations` |

Migration **`137_customer_role_merge.sql`** backfills legacy `program_participant`, `event_attendee`, and `venue_rental_customer` rows into `customer` and merges org auto-sync settings. Migration **`175_split_customer_programs_affiliation.sql`** restores **Programs** (`program_participant`) for enrollments and narrows **Customer** to events/venue.

### Module write paths

| Module | Identity helper | Affiliation trigger | Key files |
|--------|-----------------|---------------------|-----------|
| Stripe donations | Payment/donor metadata | After payment/plan insert (webhook) | `lib/donations/stripe/processor-payment.ts`, `processor-subscription.ts` |
| Portal/staff donations | Existing donor/contact | After payment insert (not pledge-only) | `app/(customer)/customer/donation/page.tsx`, `app/(dashboard)/donations/(operations)/pledges/page.tsx` |
| Ticketing | `findOrCreateContact` | Order reaches `completed` | `lib/tickets/ticket-order-actions.ts` |
| Programs | Youth: `p_participant_person_id` (minors stay people under parent Contact); adult: registrant contact. Affiliations sync existing contacts only — never create minor contacts. | Enrollment created (not waitlist-only); `promote_waitlist` | `lib/programs/program-registration-actions.ts`, `program-enrollment-actions.ts`, `program-lifecycle-actions.ts`, SQL **`195`** |
| Volunteers | Reuse canonical `contact_id` | Volunteer roster row created | `lib/volunteers/volunteer-actions.ts` |

### Key files

| File | Purpose |
|------|---------|
| `lib/contacts/contact-affiliation-sync.ts` | `computeDerivedAffiliations` (diagnostics), `syncContactAffiliations` → RPC, webhook helpers |
| `lib/contacts/contact-affiliation-rules.ts` | Terminal enrollment statuses, sticky/removable role policy |
| `lib/contacts/contact-actions.ts` | `findOrCreateContact`, `ensureContactForPerson` → gated RPCs |
| `lib/tickets/ticket-order-actions.ts` | FOC + `contact_id`; completion sync |
| `lib/programs/person-actions.ts` | Existing-contact lookup only (no auto-create for participants) |
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

**Matrix covered:** donations (one-time, recurring, pledge create/pay), ticketing (complete, pending→complete, contact reuse), programs (enroll, contact create/reuse, sticky terminal), volunteers (create, reuse, dedupe), cross-module accumulation (donor + volunteer + customer on one contact), policy (sticky roles, member auto-removable, sync primary path, no profile-refresh dependency).

**Last validated:** June 2026 — policy 8/8, suites 7/7, checks 75/75 (`validate:contacts-phase1:report`).

### Deferred (Phase 2+)

* Historical enrollment/ticket `contact_id` backfill
* Participant merge UI and dedupe tooling
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
