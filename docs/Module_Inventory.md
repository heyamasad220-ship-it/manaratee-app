# MODULE_INVENTORY.md

## Authentication

Status: Working

Features:

* Email login
* Google OAuth integration
* Supabase authentication
* Organization switching

Planned:

* Apple OAuth

---

## Organizations

Status: Working

Features:

* Multi-tenant organizations
* Organization membership
* Active organization switching
* Dashboard org branding: logo preview uses the image aspect ratio (`object-contain`) instead of a cropped square; Change Logo is edit-mode only; Edit / Cancel / Save Changes sit at the bottom of the page
* Dashboard **Subscribed Modules** lists enabled product modules from the same source as the staff sidebar (Event Management, Programs, Vendor Hub, Venue Rentals, Fund Development, Membership). Workforce, Finance, Facilities, Community Calendar, and Sign Ups are not subscription SKUs; Facilities is implied by operations modules, and Community Calendar and Sign Ups appear when Vendor Hub or Event Management is on.
* **Module-based pricing (August 2026):** Super Admin Modules page sets monthly prices, included capabilities, and multi-module discounts. Add and Edit open the same dialog. The Super Admin main column and organization detail sheet scroll so the catalog, SQL 274/275 reminder, and discount card stay reachable. Organization Modules tab saves selected SKUs and billed cents. Plans are no longer required. Run SQL **`274`** then **`275`**.
* Horizon Community Foundation demo: staff header user menu shows **Admin** instead of the email username

---

## Users

Status: Working

Features:

* User listing
* Organization member management
* Role assignment
* Organization role support

---

## Roles & Permissions

Status: Working

Features:

* Custom organization roles
* **Super Admin** and **Admin** are created automatically for every organization (SQL **`271`**). Super Admin is first; they invite Admins. `admin@manaratee.com` is a platform admin, not an org Super Admin.
* Open a role to set its permissions (grouped checkboxes). The old all-roles matrix was removed so extra roles and permissions do not add more columns.
* Permission assignment
* Server-side permission checks
* Permission-aware navigation

---

## Programs

Status: Working

Features:

* Program CRUD
* **Program kinds** — Academic vs Seasonal (`programs.program_kind`); org entitlement `organizations.program_kinds` (SQL **`246`**); policy + hard validation in `program-kind-policy.ts`; Phase 2–5 terminology/create/report work; Phase 6 packaging: Platform Admin Product Modules nests Academic/Seasonal toggles under Programs (tenant Billing no longer edits this)
* **Quick Create** + program detail inline edit + offering manage (see `docs/programs-staff-setup-ui.md`)
* Organization filtering
* Program details
* **Program Catalog** — staff Offerings page `/programs/catalog` is an org-wide admin table of existing offerings (not a second model). Customer `/customer/programs` and public `/o/[orgSlug]/programs` remain card catalogs (public visibility; join to register)
* **Programs Home** — rail item opens a flyout: **Overview**, **All programs**, **Registrations**, **Finance**, **Financial Assistance**, **Reports**, **Settings**. `/programs` is titled Overview (breadcrumb `Dashboard > Programs > Overview`) with Programs and Offerings KPI cards only. Nested pages keep **Programs** in the breadcrumb pointing at `/programs`. Reports and Finance keep their own secondary tab bars. `/programs/list` is **All programs** (years/seasons with an Academic or Seasonal tag); cards show department, dates, offering count, and total enrolled. Filters: search, department, type, status (default Active; Closed / Archived / All available). **New Program** opens `/programs/create`. `/programs/[id]` is the program workspace (**Overview | Offerings | Applications** (Application & Approval only) **| Registrations | Schedule | Finance | Reports | Settings**; Finance is Transactions | Payment Summary | Add-ons; Reports is Overview | Trends | Year comparison | Attendance; both are already filtered to that program). Overview is a compact health dashboard (KPIs, needs attention, financial summary, recent activity). Offerings are listed on the Offerings tab. **Schedule → Class times** is a weekly **Week Board** of offering cards (plus **List** table); Activity planner is unchanged. Department Programs tab is a summary doorway into that workspace.
* Eligibility rules (ages, grades, gender, capacity groups)
* Registration model, eligibility, capacity, and fee plans (offering overview + edit dialog Advanced; unified fees + discounts save with dialog Save; run `scripts/200_program_pricing_billing_scope.sql`)
* Program detail **Reports** — Overview (enrollment summary + by offering, drill-down to Registrations), Trends, Attendance
* **Year comparison** (org-wide Programs → Reports, and Program Workspace → Reports) — participants/families, new vs returning vs dropped, participant line chart + family stacked bars by program series or department. Year/program names open the matching workspace (a shared year opens the largest program). Org: `/programs/reports/year-comparison`. Program: `/programs/[id]?tab=reports&section=year-comparison`.
* **Camp enrollment** (org-wide Programs → Reports) — Recreational Camps household history: season trend, program summary table (new vs returning from the previous camp), family participation count / last program / last date. 2026 Summer Camp session weeks split into Camp 1 and Camp 2. Route `/programs/reports/camp-enrollment`.
* Offering-scoped pricing (Phase 2A/2B)
* **Move students between offerings** — program **Registrations** roster **Change** tag (opens an offering drop-down) and offering overview Enrolled students **Move** keep the same enrollment (payments/history) and retarget it to another offering in the same year/season (`moveEnrollmentToOfferingAction`). Closed destinations allowed; archived/cancelled/full/duplicate/terminal blocked. Session week access is cleared.
* **Cancel offering** — Offerings list **⋯** or offering overview **Cancel offering**. Dialog lists enrolled students and money received. Staff can **Refund payments received** (ledger refund of paid schedule rows) or keep payments and write off remaining balances. Then registrations are cancelled (`cancel_enrollment`, reason “Offering cancelled — not enough enrollment”), waitlist rows are removed, the offering is `cancelled`, and the room is cleared from the Facilities calendar. Move a student to another class first if you want to keep them enrolled. Staff list **Offering Status** filter defaults to **Active**. Run SQL **`283`**. Cancelled classes are hidden from families. Keys: `cancel-offering-dialog.tsx`, `cancel-offering-with-students-actions.ts`.
* **Offering edit dialog** persists **Primary instructor** on Save (`setOfferingPrimaryInstructor`); picker is department employees (`staff.department_id`). One active offering-level primary per class (SQL **`278`**). **Facility / space** sits under Delivery; **Online** warns then clears `program_schedule_items.venue_id` / `location` so the class drops off the Facilities calendar (`setOfferingScheduleFacility`).
* **Department Settings** (`?tab=settings` on department workspace): name and color on one row, **Director Name** (department employee / `staff.is_department_head`), Description, and Terms with one **Save** at the bottom. **Delete department** is at the bottom and is blocked when any programs, offerings, or employees exist — department heads can edit Settings but cannot create or delete departments. Program General / Notifications / Promo Codes live on Program Workspace Settings (`/programs/[id]?tab=settings`). **Service Needs** lives on Event workspace Settings (`/event-management/[id]?tab=settings`). Leftover `?section=year-defaults|registration|notifications|promo-codes` opens the Programs doorway; leftover `?section=service-needs` opens department Events. Programs flyout **Settings** is `/programs/settings` (org-wide placeholder). `/programs/settings/service-needs` → `/event-management`. Run **`scripts/190_department_settings_promo_codes.sql`**.
* **Department heads (no org-wide Programs/Workforce role):** Heads log in with a work email when one is assigned (type it on Employment details, or Settings → Users → Assign person). Sidebar is **My department** only. They fully manage that department’s tools (employees, payroll, events, settings, and that department’s programs / offerings / registrations / payments). Org-wide `/programs`, `/programs/list`, `/programs/registrations`, `/finance/*`, and `/workforce/departments` stay hidden. Key files: `lib/programs/program-access.ts`, `lib/events/event-access.ts`, `lib/departments/department-headship.ts`.
* **Program Lead (no org-wide Programs role):** One Directory person per year/season (`programs.lead_contact_id`). They open **that** program workspace and see every offering in it — not the whole department. Pick them on Program Workspace → Settings → General. Sidebar **My program** (or one item per led program) when they lack `programs.view` and are not already using **My department**. Staff Tools has the same shortcut. Do **not** grant `programs.view` just to make a lead work. Camp group leads who cover a few classes stay **Coordinator** (or Primary instructor) on those offerings and use **My Classes** — that is not Program Lead. SQL **`290`**. Key files: `lib/programs/program-leadship.ts`, `lib/programs/program-lead-actions.ts`, `components/programs/program-lead-settings-card.tsx`.
* **Summer Camps 2026 Phase 1 import** (payments CSV → Recreational Camps / year + offerings / weeks / enrollments / FA / childcare addons): `scripts/import-summer-camps-2026.mjs`. **Merged** Camp One + Two → one **Summer Camp** (8 weeks, week-count tuition tiers + sibling 5%): `scripts/merge-summer-camps-2026.mjs` + SQL **`190`**. Enrollment process is **Direct Registration** (SQL **`281`**). Master roster + staff payroll phases pending.
* **QLH (Education) registrations import** (Excel roster → Education years `QLH 2024-2025` / `QLH 2025-2026` + default `QLH Registration` offering each): `scripts/import-qlh-registrations.mjs`.
* **Education historical enrollments import** (cleaned `EducationPrograms.xlsx` + `EduPrograms2.csv` → Education year programs 2022–27 plus **Istiqamah Institute** department; people + enrollments only): `scripts/import-edu-historical-enrollments.mjs`. Tag `EDU_HISTORICAL_V1`.
* **Historical camp enrollments import** (`Camp_Enrollment_Growth.xlsx` → Recreational Camps closed seasonal programs 2022–2026; people + enrollments only; skips 2026 Camp One/Two): `scripts/import-camp-enrollments-historical.mjs`. Tag `CAMP_HISTORICAL_V1`. Household fold: `scripts/sync-summer-camp-households.mjs --camp-parents`.
* **QIL historical payments** (`New_PAYMENT_TRANSACTION_REPORT.csv` → closed years **QIL 2022-2023** / **2023-2024** / **2024-2025**; 2025-26 left as-is; 2026-27 new Stripe IDs only, matched to existing offerings): `scripts/import-qil-historical-payments.mjs`. Tag `QIL_HISTORICAL_PAYMENTS_V1`.
* **QIL 2024-2025 gap fill** (`QIL24-25.csv` → missing students only on existing offerings): `scripts/import-qil-2024-2025-gap.mjs`. Tag `QIL_2024_25_GAP_V1`.
* **QIL 2026–2027 final roster + payments** (`QI-FinalList.xlsx` + `QI-Payments0915.csv` → year **`QIL 2026-2027`** enrollments; names not on the list cancelled; no duplicate seats): `scripts/import-qil-final-2026-2027.mjs`. Tag `QIL_2026_27_FINAL_V1`.
* **MUHSEN Sunday School 2026-2027** (Education academic year, offering Ages 5-12, registration + one-time fee plan; Sabiqoon / Men in the Making are Event Management, not this program): `scripts/import-muhsen-sabiqoon-men-in-the-making.mjs`. Tag `MUHSEN_SABIQOON_MITM_V1`.

Pending:

* Session enrollment tracking improvements
* Phase 3 Stripe checkout

---

## Program Sessions

Status: Partial

Features:

* Program sessions table
* Session capacity fields
* Add/edit sessions from offering edit dialog → Advanced → Sessions (always available; tip if Selected Sessions / Day Pass off)

Pending:

* Session enrollment tracking
* Session capacity updates

---

## Registrations

Status: Partial

Features:

* Enrollment records
* Waitlist records
* Registration detail pages
* Status management
* Program **Applications** tab (`?tab=applications`) is the application queue for Application & Approval programs; **Registrations** (`?tab=students`) is the single operational enrollment roster. Enrollment status is independent of payment (`enrollment-process.ts`, SQL `280`). Applications KPIs: **Pending** (submitted + evaluation statuses), Approved — Registration Pending. Registrations KPIs are clickable: Enrolled / Waitlisted / Cancelled (plus Pending Checkout on Direct Registration) and filter the table (`?status=` / `?offering=`). Roster has no money columns — balances are **Finance → Payment Summary**. Default columns: Participant, Offering, Teacher, Status, Parent / Guardian, Registered, Actions. Adult rows show email/phone under Participant; empty demographic cells show **—**. Optional columns (email, phone, DOB, age, gender, allergies, photo consent, program) are toggled via **Columns** and stored in browser localStorage. Toolbar: Search, Offering, Teacher, Status, Filters (age/gender/date range), Columns, Export CSV (current view vs full registration data), Clear filters. Status defaults to **Active**. Application chips: All / Pending / Approved / Waitlisted / Declined / Withdrawn. Staff can **Withdraw** an application before registration (`withdrawProgramApplication`); already-registered students withdraw from Registrations. Direct Registration hides Applications. Customer Register on Application & Approval programs requires an unused approved application for that offering (SQL **`281`** set Summer Camp 2026 to Direct Registration).
* **Registrations** — family/contact payment view (`/programs/registrations`)
* **Reports → Enrollments** — org-wide participant demographics/consent (`/programs/reports/enrollments`); row opens **Participant profile** (`/programs/participants/[personId]`: identity, household, enrollments, attendance, waitlist/applications, session access; no financials). Edit updates `people` (+ enrollment note sync); apply SQL `242`. Program workspace **Reports** is analytics only (Overview / Trends / Attendance) — the operational list is **Registrations**.
* **Finance → Payment Summary** (program workspace) / org **Reports → Payment Summary** — family balances; Participants first (adult email/phone); **Contact** last for minors (hidden on all-adult self-registration); offering names, program fees (months × monthly), additional fees, status filter, CSV; free/$0 courses omitted (`/programs/[id]?tab=finance&section=payment-summary`; org `/programs/reports/tuition-plans`)
* **Reports → Add-ons** — org-wide extras (`/programs/reports/addons`); program workspace **Finance → Add-ons**. Transaction fees are excluded.

Known Issue:

* Customer registration submission still requires debugging

---

## Lunch Options

Status: Working

Features:

* Supabase-driven lunch options
* Customer registration integration

---

## Financial Assistance

Status: Working (staff awards + applications)

Completed:

* Database design (applications + **staff awards** `program_enrollment_fa_awards` — run **185**)
* Program settings / Overview
* Status history + document storage (applications)
* Staff **Mark financial assistance** writes awards; **Reports** tab lists who / program / offering / original vs assisted fee / plan; **Remove** restores original fee and supersedes the award
* Contact profile Program enrollments + Financial timeline show FA

Pending:

* Richer admin review for customer applications
* Approval workflow polish

---

## Users

Status: Working (invite flow fixed May 2026)

Route: `/settings/users`

Features:

* List organization **staff** members with roles (server-loaded; client refreshes only after invite/edit/delete). Customer-portal contacts (`viewer`) are not listed.
* Platform owner (`admin@manaratee.com`) is hidden from this list even if a support membership exists
* Invite user by email (`/api/organizations/invite-user`), optionally assigning the login to an existing Directory person
* **Assigned to** column: which Directory person currently holds that work email; assign / reassign / unassign from the row menu
* Change member organization role

**Links (`/settings/links`):** Public Community Calendar, Program Catalog, general customer portal, and donor signup URLs. Moved off Users (August 2026).

Invite requirements:

* Inviter needs `settings.users.manage` or system admin role on membership
* Supabase service role key + redirect URL configured
* Auth callback: `/auth/callback` (route handler exchanges PKCE code)
* Password reset: `/forgot-password` → `/auth/confirm` (recovery token) → `/auth/set-password`

---

## Sidebar System

Status: Working

Features:

* Subscription filtering
* Permission filtering
* Dynamic visibility
* Module order: Dashboard → Directory → **Administration** (Programs or Event Management only) → Membership → Fund Development → Programs → Event Management → Vendor Hub → **Community Calendar** and **Sign Ups** (both appear when Vendor Hub or Event Management is on; neither is a subscription SKU) → …

* Pinned footer: Billing (super admin SaaS subscription) → Settings

---

## Finance

Status: Working (not a subscription SKU — included with **Programs**. Financial Assistance and Reports live under Programs when that module is on; otherwise Finance stays a rail item only if a leftover `finance` org row is still enabled)

Routes:

* `/finance` → `/finance/transactions`
* `/finance/transactions` — org payment transactions (Donations + Programs); voided hidden by default (Status column filter); **Finance** card on Programs Home (Transactions | Payroll)
* `/finance/payroll` — org payroll queue (Mark paid); Programs Home → Finance → Payroll
* `/finance/financial-assistance` — FA hub (Overview / Submissions / Templates / Reports / Payment Plans); **Financial Assistance** card on Programs Home

No separate Finance drawer when Programs is on. Transactions and Payroll are the Finance destination; Financial Assistance is its own Programs Home card.

Permissions: `finance.view` (module; fallbacks include donations/staff/reports/applications view); child pages also accept `reports.view` / `staff.view` / `applications.view` as appropriate. Mark paid requires `finance.manage`.

Legacy redirects:

* `/reports` → `/finance/transactions`
* `/programs/financial-assistance` → `/finance/financial-assistance`
* `/workforce?tab=payroll` → `/finance/payroll`

Enable module + home route: `scripts/192_finance_module_sidebar_restore.sql` (depends on `187`).

Key files: `lib/finance/finance-paths.ts`, `app/(dashboard)/finance/*`, `components/reports/org-reports-client.tsx`, `components/finance/finance-payroll-queue-panel.tsx`, `lib/finance/org-payroll-queue.ts`

Note: Department payroll approval stays on department workspace Financial → Payroll. Module-specific reports remain under each module (e.g. `/programs/reports`, `/donations/reports/*`).

---

## Membership

Status: Implemented (sidebar + pages)

Routes: `/membership`, `/membership/members`, `/membership/applications`, `/membership/groups`, `/membership/settings`, `/membership/benefits`

**Applications:** Committee member submissions at `/membership/applications` (moved from HR Settings). Permission: `applications.view`.

**Groups:** Member groups (formerly HR Teams) at `/membership/groups` — overview, groups list, group positions. Legacy `/membership/teams` redirects here. Permission: `membership.view`.

**Giving collectives** (CRM `contact_type = group`) are not Contacts. Detail workspace: `/donations/groups/[id]` (Members, Group giving = campaign totals, Activity = events only — not individual gifts). Badge: Membership Group / Department / Group Donation via `giving_group_kind` (`scripts/167_giving_group_category.sql`). They appear on **Fund Development → Donors → Group Giving** (`/donations/reports/donors?view=group`). Legacy `/contacts/groups` and `/contacts/[id]` for groups redirect into Donations.

Enable for orgs: Platform Admin modules toggle, or repair SQL `scripts/165_ensure_membership_sidebar.sql` (also `scripts/058_membership_module.sql`). Permissions: `membership.view` / `membership.manage` (sidebar falls back to contacts permissions).

---

## Reports

Status: Planned

No active implementation yet.

---

## Contacts / CRM

Status: **Directory IA (August 2026)** — user-facing module renamed Contacts → Directory; canonical `contacts` table unchanged.

North star: **One Contact · Many Roles · Many Activities · No Duplicate Identities**

### Affiliation sync engine

| File | Role |
|------|------|
| `lib/contacts/contact-affiliation-sync.ts` | `computeDerivedAffiliations`, `syncContactAffiliations` (RPC), webhook helpers |
| `lib/contacts/contact-affiliation-rules.ts` | Sticky vs auto-removable policy, terminal enrollment statuses |
| `lib/contacts/contact-constants.ts` | Role labels; participation roles excluded from manual CRM picks |
| `lib/directory/directory-roles.ts` | Dynamic role catalog, assignable roles, populated-nav helper |
| `lib/directory/directory-nav-summary.ts` | Tenant-scoped entity + role counts for Overview and sidebar |
| `lib/permissions/permission-keys.ts` | `contacts.view`, `contacts.manage` |

**Write-path rules (Phase 1):**

* Donations (portal/staff) → `handleDonationAffiliationSync`
* Donations (Stripe webhooks) → `syncDonationAffiliationFromWebhook` only
* Programs, ticketing, volunteers → `syncContactAffiliations` with explicit `organizationId`
* Do not insert `contact_roles` directly for activity-derived roles on write paths
* Do not depend on contact profile refresh for role assignment after activity writes

### Module integration (Phase 1)

| Module | Identity | Affiliation trigger |
|--------|----------|---------------------|
| Donations — Stripe | `donors.contact_id` / payment metadata | Webhook processors (S-02/S-03) |
| Donations — portal/pledges | `donors.contact_id` | Portal + staff pledge actions (S-05/S-06) |
| Programs | `participant_contact_id` / `registrant_contact_id` via `ensureContactForPerson` | Enrollment → **Programs** (`program_participant`); parents as registrant included (S-09/S-10; split in `175`) |
| Ticketing / Venue | ticket order / rental billing contact | → **Customer** only (events + bookings; `175`) |
| Volunteers | `volunteers.contact_id` | `createVolunteer`, `ensureVolunteerForContact` (S-11) |

Routes: `/directory` (Overview), `/directory/people`, `/directory/families`, `/directory/families/[id]`, `/directory/organizations`, `/directory/role/[role]`, `/directory/reports`, `/directory/settings`, `/directory/[id]` (contact profile). Legacy `/directory/groups` and `/contacts/groups` redirect to Fund Development Group Giving. Legacy `/contacts/...` list URLs redirect into Directory. Permissions remain `contacts.view` / `contacts.manage` (UI labels: View/Manage Directory).

**People / Organizations lists:** `components/contacts/contacts-crm-list.tsx` loads via `fetchContactsList`. Shared list types (`ContactListRow`, filters, stats) are in `lib/contacts/contact-list-types.ts` — not the `"use server"` actions file — so the client does not hit a `ContactListRow is not defined` runtime error. People and Organizations include **Export CSV** (filtered rows, `fetchContactDirectoryExportAction`) and a Roles column filter. Phone columns and CSV/PDF exports display US numbers as `(###) ###-####` (`lib/ui/format-phone.ts`); stored values are unchanged.

**Contact profile Overview:** Module-gated right rail with Quick Actions, Financial Summary, and Activity (`components/contacts/contact-profile-overview-rail.tsx`).

**Contact profile Financial (September 2026):** One Financial tab, gated by subscribed billing modules (`lib/contacts/contact-financial-nav.ts`). Programs-only tenants do not see Fund Development Recurring/Pledges/Statements or Membership. Mixed tenants get **All** plus a tab per subscribed module (Fund Development, Programs, Venue Rentals, Vendor Hub, Membership). A programs-only person in a mixed org opens Programs, not empty Pledges. Deep link: `/directory/[id]?tab=financial&module=programs`.

**Groups:** Giving groups (`contact_type = group`) are Fund Development only — **Donors → Group Giving** (`/donations/reports/donors?view=group`) and workspace `/donations/groups/[id]`. They exist to roll up donations from a department or collective (for example Qur'an Institute for Ladies), not as Directory identities. Campaign groups (`campaign_groups`) stay on Campaign → Groups; group detail Donors count opens a list of names and amounts. Membership Groups remain `/membership/groups`. Legacy Directory Groups URLs redirect into Fund Development.

**Reports:** Directory → Reports is analytics (growth, role distribution with overlap, completeness, possible duplicates). Types live in `lib/directory/directory-report-types.ts` (not the `"use server"` actions file). People / Organizations / Families are first-class Directory sections, not report tabs. Donor giving reports stay under Fund Development.

**Dynamic role navigation:** Directory flyout CRM lookups (Members, Sponsors, Parents, Vendors, Rental Customers) appear only when the current tenant has matching records. **Donors**, **Employees**, **Volunteers**, **Childcare Providers**, and **Service Providers** are not Directory nav items — operational lists live under **Administration** or Fund Development reports. Role-view URLs still work as bookmarks. `/resources/service-providers` redirects to `/directory/role/service-providers`. Counts load with sidebar modules (`fetchDirectoryNavSummary`). These are filtered views of canonical contacts — not duplicate identity tables. Role-view tables add lookup columns from Workforce / Membership / Fund Development / Vendor Hub / Rentals (summaries only). Donor giving columns are gated by `donations.view`. **Sponsor** is a manual `contact_roles` value (`scripts/269_directory_sponsor_role.sql`).

**Search Directory first:** Workforce, Vendor Hub, Venue Rentals, Fund Development, and Membership add flows search existing Directory people/organizations before creating a new canonical record. Department and org **Add employee** can create a Directory person from the dialog when search finds no match.

**Contact record types:** `individual`, `organization`, `group` (migration `132`). Groups = Fund Development giving collectives (not Directory identities); Organizations = external entities.

Validation:

```bash
npm run validate:contacts-phase1
```

Deferred (Phase 2+): participant merge UI, historical backfill, venue rental customer derivation, segmentation.

**Directory SQL (optional):** `scripts/268_directory_module_label.sql` updates `modules.name` / `route` for the contacts slug to Directory / `/directory`. The app already overrides the sidebar label without this script. **Sponsor role:** run `scripts/269_directory_sponsor_role.sql` so `contact_roles` accepts `sponsor`.

**RLS wave 1 (June 2026):** Migrations `102`–`111`. M6b aligns ticketing/membership RPC gates. CR-8: `npm run validate:contacts-g6`. M4 authorized for staging after G6 GREEN.

---

## Fund Development

Status: Working (IA: Overview / Campaigns / Donors / Pledges / Donations / Settings)

Routes stay `/donations/*`. **Campaigns** list includes committed/collected/outstanding plus **Campaign Groups** and **Wishlist** views (`?view=groups` / `?view=wishlist`). **Donors** (`/donations/reports/donors`) is Individual / Household / Group giving — pledge status and outstanding balance stay on **Pledges**. Operations: `/donations/payments/transactions` (register + giving charts), `/recurring`, `/import-match`, `/receipts`. Legacy `/donations/reports/*` URLs redirect except Donors. Campaign **Campaign Groups** and Campaign → Groups both **Export CSV**. Global Pledges (`/donations/campaigns/pledges`) defaults to **Open** (any outstanding balance) and shows overdue on Remaining. **Export CSV** uses the current table filters. Statuses are **Open** and **Fulfilled** only. KPI cards and table headers stay pinned while rows scroll.

Transactions date range (`?range=`) filters KPIs, charts, the table, and CSV export. Giving over time is a line (daily for 7/30/90 day ranges, monthly for last year / all time). Receipts Missing queue: `/donations/payments/receipts?status=missing`. Year-end statement KPIs read `donation_receipts` where `receipt_type = annual_statement`.

Permissions: `donations.view`, `donations.manage`, `donations.campaigns.manage`, `donations.prospects.manage`, `donations.reports.manage`.

Customer portal **My Donations** (`/customer/donation`) is the donor workspace: Donation Options, My Pledges, and Giving History. Featured campaigns appear on the customer Dashboard (`/customer/dashboard`), not under Giving Opportunities.

Campaign workspace tabs: Overview, **Event**, **Prospects**, Pledges, Donations, **Sponsorship**, Groups, **Wishlist**. Opening a campaign loads that campaign’s pledges, payments, and recurring plans only (not the whole-org ledger). Workspace tabs stay pinned while page content scrolls. On Overview, Campaign Goal KPI cards stay pinned with the tabs and wrap instead of scrolling sideways. **Event** (`?tab=events`) lists the campaign’s `internal_events` row linked via `internal_events.campaign_id` (JSON `ticketing_config.linkedCampaignId` kept in sync; attach existing or **Create event** in place when none is linked; click the row to open the event workspace). Ticketed events pin KPI cards for sold / remaining / checked in (each with a ticket-type breakdown), revenue, and ticket donations. **Donations** pins one-time total, recurring plan count, monthly recurring amount, one-time gift count, and unique donors. Staff with manage permission can **Receive Donation** and **New Recurring Plan** on that tab (campaign locked; recurring plans need installments or an end date). Orgs without Event Management see a subscribe message instead of the event list. **Prospects** is one donation prospect table (`?tab=prospects`): **Add prospect** opens a popup (prospect, ask amount, typed Assigned to name, optional last contact / next follow-up / notes); click a saved row to edit, remove, or record a pledge. Pinned KPIs are prospects, total ask, overdue follow-ups, and pledged. The ask-level strategy chart is retired (`campaign_ask_levels` kept unused). Sponsorships are created on **Sponsorship**, not this table. Legacy `?tab=plan`, `?tab=strategy`, and `section=prospects` open the same Prospects table. Each campaign has one goal (`campaigns.goal_amount`); Goal Breakdown phases are retired (`scripts/270_disable_campaign_goal_phases.sql`). **Sponsorship** has internal views **Sponsors | Packages**: committed sponsorships plus campaign-owned sponsorship packages and benefit fulfillment. Wishlist items are campaign priorities (`campaign_wishlist_items`); pledged/collected come from `pledges`/`payments.wishlist_item_id`. Public donate: `/donate/w/{token}`. SQL: `scripts/267_campaign_wishlist.sql`, `scripts/284_campaign_sponsorship_prospects.sql`, `scripts/285_campaign_sponsorship_packages.sql`, `scripts/292_campaign_same_organization_fks.sql`, `scripts/299_campaign_prospect_assigned_to_name.sql`. Staff add/edit/collect pledges through one **Pledge Details** window (`components/donations/pledge-details-dialog.tsx`) on the global Pledges page, campaign workspace, Prospects, and contact Financial pledges. Monthly / quarterly / yearly pledges require a first payment date plus installments or an end date. Status is automatic (Open / Fulfilled). Contact search can **Create** a missing person or organization without leaving the window.

---

## Reports

Status: Planned

No active implementation yet.

---

## People Management

Status: Active Development

Display name: **People Management** (slug `hr`, routes `/hr/*`).

### Members, Volunteers, Teams

Status: Working (contacts-based views with role filters)

Routes:

* `/hr/members`
* `/workforce/volunteers` → redirects to `/workforce?tab=volunteers` (HR directory shell)
* `/hr/teams`

---

### Employees

Status: Working (simplified)

Route: `/workforce` (Employees tab: `?tab=employees`)

HR / Workforce under **Programs/ Events**: Departments (drawer link), Workforce (Employees | Volunteers | Childcare Providers tabs). Org payroll queue under **Programs/ Events → Reports → Payroll**.

Roster-only employee list using the shared HR directory shell (Export, Add Employee, Employees | Applications | Positions tabs, KPI cards, Active/Inactive status filter defaulting to Active, pagination), embedded under **HR → Overview → Employees**.

**Contact-first:** Add Employee searches Directory (`HrContactPicker`); the dialog can create a person if none match. **Work email** on the employee drawer is a typed field: Save assigns an existing Settings → Users login or invites that mailbox and assigns it (not `contacts.email`). Check **Department Head (Director)** on the same sheet. Marking inactive or removing from the department unassigns that mailbox. Department **Financial → Employees** pay basis includes **Unpaid (volunteer)** without clearing saved rates (`scripts/293`). The list defaults to active staff assigned to a class (director stays visible); switch Assignment to All employees for unassigned staff.

Removed tabs (redirect to Overview):

* Departments → `/workforce?tab=departments` (list at `/workforce/departments`: color + initial cards with Director and Employees; whole card opens the workspace. Department workspace at `/workforce/departments/[id]`: **department-level** Overview / Programs / Events / Group giving / Financial (**View Master Calendar** / **Check space availability** / **Create event** live on Events) / Settings; **Employees** is a Financial sub-tab (`?tab=financial&section=employees`; leftover `?tab=employees` opens it); **Financial** has one sticky combined KPI row (Employees, Revenue, Expenses, Profit — Revenue is program fees collected; Expenses is payroll + operating costs; Profit is Revenue − Expenses) then sub-tabs Employees / Payroll / Expenses / Financial Summary; **Programs** tab is a summary doorway into `/programs/[id]` (series KPI cards for active/closed year counts when a series has two or more years; click a card to filter the list and show enrollment over years) (workspace tabs: Overview | Offerings | Applications (Application & Approval) | Registrations | **Schedule** [Class times: Week Board + List, plus Activity planner] | **Finance** [Transactions / Payment Summary / Add-ons, locked to this program] | **Reports** [Overview / Trends / Attendance, locked to this program] | Settings); leftover `?year=` redirects to that workspace; leftover `?tab=schedule` opens the Programs doorway; offering manage under `/programs/[id]/offerings/...`; department Overview = snapshot KPIs (active programs, offerings, employees, students, upcoming events, families with returning/new) + two-column **active** programs list and enrollment-over-time chart (**View all programs** / Programs tab includes closed years); description + Terms live on Settings (`terms_html` / `terms_pdf_url`, SQL `241`; no flyer on Overview); one Save plus Delete department at the bottom of Settings (delete blocked if programs, offerings, or employees exist); apply SQL `169`/`170`/`171`/`172`/`173`/`174`/`186`/`190`/`203`/`241`; scoped access via `lib/departments/department-access.ts`). Historical QIL load: `scripts/import-qil-year.mjs`; 2026–2027 payments/registrations: `scripts/import-qil-payments-2026-2027.mjs` (SQL `277`); prune Approved to QIApproved.xlsx + QIPayments.csv: `scripts/prune-qil-approved-2026-2027.mjs`; free Al-Ajurrumiyyah enroll: `scripts/enroll-qil-ajurrumiyyah-2026-2027.mjs`; consolidate course-as-programs → offerings: `scripts/migrate-qil-courses-to-offerings.mjs` (after `174`).
* Positions → `/workforce?tab=employees&view=positions`
* Time Off, Work Schedule, Notifications, Teams, Applications

Employment applications: `/workforce?tab=employees&view=applications`.  
Positions (job titles): `/workforce?tab=employees&view=positions`.

Shared shell: `components/workforce/hr-directory-shell.tsx` (also used by Volunteers and Childcare Providers). Overview shell: `components/hr/hr-overview-client.tsx`.

### HR Settings

**Removed.** The HR sidebar Settings item is gone. Positions live under Employees → Positions. Legacy `/workforce/settings` and `/workforce/settings/positions` redirect to `/workforce?tab=employees&view=positions`. Application Templates hub also removed (category Applications tabs). Departments remain under Overview.

Key files:

* `components/hr/hr-positions-manager.tsx`
* `components/hr/hr-overview-client.tsx`
* `components/hr/staff-records-client.tsx`
* `app/(dashboard)/workforce/page.tsx`
* `app/(dashboard)/workforce/settings/positions/page.tsx` (redirect only)

Committee Applications live under **Membership → Applications** (`/membership/applications`).

---

### Child Care

Status: Working (real data)

**Providers:** `/workforce?tab=childcare` (HR Overview directory shell: Providers | Applications; Active/Inactive filter)  
**Customer apply:**
* Volunteer → `/customer/apply/volunteer` (Profile → Applications when Programs or Event Management is on; **Copy apply link** on Volunteers). Approve creates/links a `volunteers` roster row.
* Childcare → `/customer/apply/childcare` (Profile → Applications when Programs or Event Management is on; **Copy apply link** on providers). Approving creates/links a childcare `staff` row for payroll hour logging.
**Registrations:** `/event-management/reports/childcare` (Event Management → Reports → Childcare)

Data source: approved `childcare_provider` applications (not mock data).

Key files:

* `app/(dashboard)/workforce/childcare/page.tsx`
* `app/(dashboard)/event-management/reports/childcare/page.tsx`
* `components/hr/hr-childcare-panel.tsx`
* `components/child-care/childcare-registrations-client.tsx`
* `lib/hr/childcare-provider-actions.ts`

Stats cards: Total Providers, Active Providers, Total Hours, Total Events Worked.

Hours and event history show `0` until event participation tracking exists.

Header action: Provider Applications → filtered Submissions tab.

---

### Applications (HR / Membership)

Status: Working

Submissions are embedded on each category **Applications** view (not under HR Settings):

| Type | Route |
|------|-------|
| Employment | `/workforce?tab=employees&view=applications` |
| Volunteer | `/workforce?tab=volunteers&view=applications` |
| Childcare | `/workforce?tab=childcare&view=applications` |
| Committee member | `/membership/applications` |

Permission: `applications.view`

Application Templates hub removed — review under category Applications tabs. HR Settings sidebar removed; Positions live under Employees → Positions (`/workforce?tab=employees&view=positions`).

Legacy redirects:

* `/settings/applications`, `/people-management/applications`, `/hr/applications` → category Applications tab (by `application_type`)
* `/settings/applications?tab=templates`, `/workforce/settings/application-templates` → `/workforce`
* `/workforce/settings/committee-applications` → `/membership/applications`

Key files:

* `components/applications/hr-category-applications-panel.tsx`
* `components/applications/applications-module-page.tsx`
* `lib/applications/application-routes.ts` (`hrCategoryApplicationsUrl`, `MEMBERSHIP_APPLICATIONS_PATH`)
* `app/(dashboard)/settings/applications/page.tsx` (redirect only)
* `app/(dashboard)/membership/applications/page.tsx`
* `app/(dashboard)/workforce/settings/application-templates/page.tsx` (redirect only)

Other modules:

* Vendor Hub → `/applications/all?application_type=vendor`
* Programs → Financial Assistance applications filter

Contact profile: `components/contacts/contact-applications-panel.tsx`

Detail page: `/applications/[id]`

---

### People Management Settings

Status: Working (simplified)

Route: `/hr/settings`

Content: **Discount Policies only**

Removed tabs: General, Roles

Redirects from old tab URLs (`?tab=general`, `?tab=roles`, `?tab=discount-policies`) → `/hr/settings`

`HrJobRolesManager` component remains in codebase but is not linked from Settings.

---

### People Management Reports

**Removed as a separate hub.** Headcount metrics (Active Employees, Departments, Volunteers, Childcare Providers), employees-by-department, and recent hires live on **HR → Overview** (`/workforce`). Attendance Rate and Time Off placeholders were dropped. Legacy `/hr/reports` and `/workforce/reports` redirect to `/workforce`.

Key file: `components/hr/hr-reports-client.tsx` (`HrOverviewDashboard`)

---

## Sign Ups

Status: In progress (Overview and Reports)

* Staff rail: **Sign Ups** when Vendor Hub or Event Management is enabled. Not a subscription SKU.
* Flyout: **Overview** · **Notifications** · **Reports** · **Settings**
* Overview (`/sign-ups/overview`) is a report of events that need volunteers (`internal_events.requires_volunteers`). Event Management rows open `/event-management/[id]`. Vendor Hub rows open `/vendor-hub/events/[id]`. Cancelled and declined events are omitted. Default filter is Upcoming.
* Volunteers column: people already assigned on the event (`service_participations`, type volunteer) over open slots from Service Needs.
* Reports (`/sign-ups/reports`) lists pending and confirmed volunteer sign-ups across events. Columns: event name, volunteer name, email, phone number, slot, time.
* The same list for one event is the **Volunteers** tab on that event or bazaar (no event-name column). It also holds times and slots.
* Event Management: Service Needs → Volunteers shows the tab. Vendor Hub bazaars always show **Sign-ups**. Both use **Slots** and **Volunteers**, with one Save and no sign-up toggle. Saving a time window sets `requires_volunteers` and lists the event on Sign Ups → Overview. An empty slot list stays off the overview until slots are saved.
* Notifications and Settings are not built yet.
* Key files: `lib/sign-ups/sign-up-overview-queries.ts`, `lib/sign-ups/sign-up-reports-queries.ts`, `components/events/event-volunteers-panel.tsx`, `components/sign-ups/reports/sign-ups-reports-client.tsx`, `components/layout/sidebar.tsx`

## Community Calendar

Status: Working (shared)

* Staff route: `/community-calendar` (top-level sidebar; included with Vendor Hub or Event Management, not a separate SKU)
* Public (no-login): `/o/[orgSlug]/community-calendar` — featured event, event-type circles, All/Today/This weekend, 4-column cards; ticketed → `/o/[orgSlug]/events/[id]`
* Sources: `internal_events.community_calendar_status` (SQL `247` + `300` + `305`). Published bazaars appear from their Vendor Hub date/place hold (`source_module = vendor_hub`).
* Public page and staff UI use **Private** / **Public** (`published`); legacy `community_visible` rows still appear on the staff calendar until re-saved as Public
* Legacy: `/vendor-hub/community-calendar` redirects
* Publish: Event workspace Settings → General → Community Calendar card, or bazaar create/edit
* Staff Event Management cards open `/event-management/[id]`. Staff bazaar cards open Vendor Hub. Public ticketed cards open `/o/[orgSlug]/events/[id]`. Bazaar public cards are listings only.
* Key files: `lib/community-calendar/*`, `public-community-calendar-view.tsx`

## Vendor Hub

Status: Working

* Staff flyout: **Overview** (`/vendor-hub`, exact) · **Vendor Network** · **Events** (`/vendor-hub/events`) · **Reports** · **Settings**. The Events page title and its one KPI row (Events, Upcoming, Next, On the calendar) stay fixed while the table scrolls.
* Overview matches the Fund Development dashboard: colored KPI cards (active events, onboarding pending, booth requests, booths still open), **Action Required**, **Active events**, and blue **Quick Actions**. The logo header and breadcrumbs stay fixed on every Vendor Hub page. Vendor Network title and tabs stay fixed while that section scrolls. Booths-by-type and recent orders are on the bazaar workspace and Reports.
* Reports tabs: **Orders** (`?tab=vendor-sales`) · **Booth Performance** · **Participation History** (`?tab=history`). Orders is purchased booths for all events (or `?eventId=`). Type = selling category; Booth type = physical space. Columns popup + CSV. Event **Orders** tab is the same report filtered to that bazaar. Legacy `/vendor-hub/network/history` redirects
* Vendor Network tabs: Vendors, Onboarding, Documents, Invitations. The Vendor Network title and those tabs stay fixed while the list scrolls. Vendor columns: Business Name, Vendor Type, Primary Contact, Phone, Email, Last Activity, Status. A vendor **row click** opens the profile in a dialog; closing it stays on the Vendors list. The Vendors **Vendor Type** column is the catalog dropdown (not the booth), every dropdown is the same width, and it saves on the vendor profile. The column filter uses checkboxes so several types can be selected at once, then **Apply** saves the selection and closes the list. **Export CSV** downloads the vendors that match the current filters, including the selected types. Catalog includes **Ice Cream** (`scripts/306_ice_cream_vendor_type.sql`). Vendor-type saves and profile loads use the faster vendor policies in `scripts/307_vendor_hub_application_rls_perf.sql` (avoids statement timeouts).
* **Bazaars live in Vendor Hub (September 2026):** Create/edit only in Vendor Hub. No Event Management picker, ticketing, or program link. A date/place hold on `internal_events` (`source_module = vendor_hub`, SQL **`305`**) is for Facilities (one or more on-site spaces via `internal_event_venues`) and Community Calendar only — hidden from Event Management lists. Old `/event-management/[id]` bazaar URLs redirect to Vendor Hub. `vendor_hub_events.internal_event_id` stays required for that hold (SQL **`300`**). Bazaar **Volunteers** is always on (times, slots, and signups). Saving slots lists the bazaar on Sign Ups → Overview.
* **MAS Fall Bazaar Oct 10 2026:** Imported 25 Eventbrite booth orders (`FallBazaar101026.csv`) as Vendor Hub payments/assignments (not Ticketing). Script: `scripts/import-fall-bazaar-101026.mjs`.
* **Table selection (September 2026):** Vendors pick a numbered table in My Bazaars. Price is base + selection extra (hall regular/blue/stage **+$10**, corners **+$25**). Org default booth types plus template **Default bazaar layout** in Vendor Hub → Settings → Booths, including **Mocktail / smoothie (truck or cart)** at **$175**. SQL **`301`** + **`302`** + **`304`**. MAS Fall Bazaar Oct 10 inventory remapped onto those types (SQL **`303`**).

## Event Management (workspace)

Status: In progress

* Staff flyout: **Overview** (`/event-management`) · **Events** (`/event-management/events`) · Master Calendar · **Ticketing** (`/event-management/ticketing`, tabs Overview / ticketed Events / Orders / Check-in / Settings) · Reports · Settings (**General** = optional on-site **Approval required**, default off; Notifications)
* **Events list (September 2026):** **One-time** and **Recurring** tabs (`?recurrence=recurring`). Recurring is one row per series (same name or `seriesId`), with Schedule, next/last date, and remaining meetings; the name opens the next upcoming meeting. Create/edit schedule is One-time, Recurring rule, or Custom dates (still Recurring tab, schedule **Custom dates**). Edit can switch those modes; after a one-time ↔ recurring save, Events opens the matching tab. Contact, Phone, and Email columns (requester from `coordinator_contact_id`) can be shown or hidden with **Columns**. Actions is a three-dot menu with Copy and Delete (same delete guards as the workspace). Active list is soonest-first and hides past dates. Searching a Recurring series shows remaining recurrences, schedule, and time KPI cards.
* **Facilities Calendar list view (September 2026):** `/facilities/calendar` Day | Grid | List. List (`?view=list`) is an agenda grouped by date: time, space, holder, title, and PoC. Click the start date and end date separately (`?date=` and `?endDate=`; default 30 days).
* **Create event** opens in place on Overview, Events, Master Calendar, campaign Event, and department Events. On-site: **View facility calendar** link only (no room picker). Online/external skip Facilities. SQL **`291`** `event_management_settings`.
* **Facilities Calendar create (September 2026):** **Create event** on `/facilities/calendar` opens today’s Day view instead of a popup. Click an empty slot to create after checking availability.
* **Source of truth (September 2026):** Event Management, campaigns, and department Events share `internal_events`. Campaign link is `internal_events.campaign_id`. Childcare rows must belong to an event or program. **Bazaars are Vendor Hub**, not Event Management workspaces (SQL **`305`**). SQL **`300_event_management_source_of_truth.sql`**.
* **Ticketing** is its own Event Management area. Tabs: Overview, ticketed Events, Orders, Check-in, Settings (categories + checkout defaults). Ticketing → Events defaults to **Active events** (filter to Past or All). Status is Draft / Active / Past (Past after the date). Org-wide **Check-in** uses `TicketCheckInScanner`: phone camera QR (`TicketQrCamera`), computer type-a-code, plus active ticketed events. Org-wide lookup: `checkInOrgTicketByCode`. Event Management Overview counts upcoming one-time dates and recurring series (not ticketed-among-upcoming or ticket Revenue). Ticketed rows on Events still show Issued / Remaining / Revenue / Category.
* Overview KPI cards sit on one row: upcoming **one-time** and **recurring** counts (a series such as Tuesday Night Live is one recurring event), Need Childcare / Volunteers / Vendors. Ticket **Revenue** is on Ticketing → Overview. A **This month** table lists upcoming event dates with a Ticketed tag and childcare / volunteer / vendor need tags.
* Ticketing **Orders** (`/event-management/ticketing/orders`) shows the latest 50 orders with pagination. The Events dropdown is a checkbox list (select one or more events, or leave empty for all). Legacy `/event-management/reports/orders` redirects here.
* Events is a view/manage list with **One-time** and **Recurring** tabs (search, department, Active/Draft/Past). One-time lists each date; Recurring groups a series into one row. Sorted soonest date first on Active. Status is **Draft**, **Published**, or **Completed** (date has passed). Default column order: Event, Department, Contact, Date, Time, Location, Space, Status, Actions (Recurring also shows Schedule and next/last date). Ticketed rows can also show Category (`ticketing_event_categories`, SQL `287`), Issued, Remaining, and Revenue after Status. Event names are blue links. **Columns** chooses which table columns to show. Actions is a three-dot **Copy** / **Delete** menu. Opening a row goes to `/event-management/[id]`.
* Reports tabs: **Tickets** (day/event/customer analytics) · **Childcare**. Legacy `/event-management/check-in` and `/event-management/settings/categories` redirect into Ticketing.
* Progressive tabs via `workspace_features` + `ticketing_config.attendanceMode` (SQL `252`)
* Expenses ledger: `event_expenses` / `event-expense-actions.ts`
* UI: overview dashboard (pinned colorful KPI row: Type, Schedule, Location, Childcare, Volunteers, Vendors; click the event name to edit the booking form; Finance with revenue/expenses/net, Recent orders at bottom), **Settings → Tickets** (Paid/Free + Starts/Ends + ticket types), Ticketing → Orders for the org-wide order list, finance, reports (attendee CSV), feature switches
* Public registration on `/o/[orgSlug]/events/[eventId]` with sale-window enforcement (`createPublicEventRegistration`)
* Paid public tickets: Stripe Checkout on org Connect (`ticket-stripe.ts`); same donations webhook `POST /api/webhooks/stripe/donations` when `manaratee_module=ticketing`. Fallback: pay at event + staff **Mark paid**. SQL `255`
* Staff **Refund** / order-detail **Cancel or refund** refund Stripe Connect charges (`refundEventTicketOrder`). Staff can void selected tickets on a multi-ticket order, refund a suggested or custom amount, add a note, and choose whether to email the customer. Full remaining voids leftover seats (`refunded`); partial keeps unselected seats (`partially_refunded`, SQL `258` `refunded_amount_cents`). Dashboard `charge.refunded` is idempotent and applies Stripe’s refunded total.
* Door staff: `events.checkin` (SQL `257`) — scan/check-in without event manage. Pair with `events.view`.
* Customer portal **My Tickets** `/customer/tickets` (codes + QR + resume checkout). SQL `256`
* Youth forms / liability waiver on Opportunities + Youth tab Forms dialog (SQL `259`)
* Event documents on Settings → Features (`event_documents`, SQL `254`)
* **Service Needs** on Event workspace Settings (volunteers / youth / vendors → `internal_events.requires_*` + `service_requirements`; `internal-event-service-needs-settings.tsx`)
* **TicketOrders.csv Event Management import (August 2026):** Historical Eventbrite ticket orders → `internal_events` + `event_ticket_types` + `ticket_orders` + `tickets`. Groups repeated Eventbrite order totals into one order per buyer/event/date. Skips vendor/bazaar booths, QLH/QIL/Sunday School, and processing-fee rows. Attaches Sep 12 2026 Crystal Banquet tickets to the existing Annual Fundraising Dinner. Attendee = ticket holder; Contact column is the Directory contact (name + email + phone, name links to profile). SQL **`286`**. Tag `TICKET_ORDERS_CSV_V1`. Script: `node scripts/import-ticket-orders-csv.mjs` / `--execute`. Reports: `scripts/reports/ticket-orders-import-dry-run.json`, `ticket-orders-import-execute.json`.
* **Internal Events Google Form import (September 2026):** One-time department requests from `InternalEvents.xlsx` → `internal_events` + Directory contacts + facility rooms. Recurring and Other skipped. Tag `INTERNAL_EVENTS_XLSX_V1`. Script: `node scripts/import-internal-events-xlsx.mjs` / `--execute`.
* **Public recurring gatherings import (September 2026):** Weekly/custom drop-in series (Learn Love Live Quran, Thursday ladies halaqa, Tuesday Night Live, Crochet Clique, Men Talk) as one `internal_events` row per date. Public series published to Community Calendar. Tag `INTERNAL_EVENTS_RECURRING_PUBLIC_V1`. Script: `node scripts/import-internal-events-recurring-public.mjs` / `--execute`.
* **MUHSEN / Sabiqoon / Men in the Making (September 2026):** MUHSEN Sunday School 2026-2027 is an Education program with registration and a payable fee plan. Sabiqoon (5 Sundays) and Men in the Making (10 Saturdays) are public walk-in Event Management series. Tag `MUHSEN_SABIQOON_MITM_V1`. Script: `node scripts/import-muhsen-sabiqoon-men-in-the-making.mjs` / `--execute`.
* **Fundraising Dinner Sep 12 2026 door report:** Itemized tickets + checkout donations + check-in on Annual Fundraising Dinner (`FUNDRAISER_DINNER_SEP2026_V1`). **Ticket donations** KPI on event Overview / Finance and the campaign Event tab. Script: `node scripts/import-fundraiser-dinner-report.mjs` / `--execute`.
* **Fundraising Dinner Sep 12 2026 Square donations:** 95 gifts ($32,191) on campaign **Annual Fundraiser - September 2026** with group attribution (`FUNDRAISER_DINNER_DONATIONS_SEP2026_V1`). Square MONTHLY gifts and remark-only monthly commitments are linked to `recurring_donation_plans`. Campaign → Donations shows Type + Recurring. Script: `node scripts/import-fundraiser-dinner-donations.mjs` / `--execute` / `--link-recurring --execute`. Export CSV from Campaign → Groups and **Campaigns → Campaign Groups**.
