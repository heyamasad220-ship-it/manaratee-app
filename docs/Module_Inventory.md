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
* Dashboard **Subscribed Modules** lists enabled product modules from the same source as the staff sidebar (Event Management, Programs, Vendor Hub, Venue Rentals, Fund Development, Membership). Workforce, Finance, Facilities, and Community Calendar are not subscription SKUs; Facilities is implied by operations modules, and Community Calendar is implied by Vendor Hub or Event Management.
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
* Permission matrix
* Permission assignment
* Server-side permission checks
* Permission-aware navigation

---

## Programs

Status: Working

Features:

* Program CRUD
* **Program kinds** — Academic vs Seasonal (`programs.program_kind`); org entitlement `organizations.program_kinds` (SQL **`246`**); policy + hard validation in `program-kind-policy.ts`; Phase 2–5 terminology/create/report work; Phase 6 packaging: Platform Admin Product Modules nests Academic/Seasonal toggles under Programs; tenant Billing still uses the dropdown card
* **Quick Create** + program detail inline edit + offering manage (see `docs/programs-staff-setup-ui.md`)
* Organization filtering
* Program details
* **Program Catalog** — staff Offerings page `/programs/catalog` is an org-wide admin table of existing offerings (not a second model). Customer `/customer/programs` and public `/o/[orgSlug]/programs` remain card catalogs (public visibility; join to register)
* **Programs Home** — rail item opens `/programs` (titled Overview; breadcrumb `Dashboard > Programs > Overview`; colored whole-card links; no module tabs). Nested pages keep **Programs** in the breadcrumb pointing at `/programs`. Reports and Finance keep their own secondary tab bars. `/programs/list` is all years/seasons with an Academic or Seasonal tag; cards show department, dates, offering count, and total enrolled. Filters: search, department, type, status (default Active; Closed / Archived / All available). **New Program** opens `/programs/create`. `/programs/[id]` is the program workspace (**Overview | Offerings | Applications** (Application & Approval only) **| Registrations | Schedule | Finance | Reports | Settings**; Finance is Transactions | Payment Summary | Add-ons; Reports is Overview | Trends | Year comparison | Attendance; both are already filtered to that program). Overview is a compact health dashboard (KPIs, needs attention, offerings preview, financial summary, recent activity). **Schedule → Class times** is a weekly **Week Board** of offering cards (plus **List** table); Activity planner is unchanged. Department Programs tab is a summary doorway into that workspace.
* Eligibility rules (ages, grades, gender, capacity groups)
* Registration model, eligibility, capacity, and fee plans (offering overview + edit dialog Advanced; unified fees + discounts save with dialog Save; run `scripts/200_program_pricing_billing_scope.sql`)
* Program detail **Reports** — Overview (enrollment summary + by offering, drill-down to Registrations), Trends, Attendance
* **Year comparison** (org-wide Programs → Reports, and Program Workspace → Reports) — participants/families, new vs returning vs dropped, participant line chart + family stacked bars by program series or department. Year/program names open the matching workspace (a shared year opens the largest program). Org: `/programs/reports/year-comparison`. Program: `/programs/[id]?tab=reports&section=year-comparison`.
* Offering-scoped pricing (Phase 2A/2B)
* **Move students between offerings** — program **Registrations** roster **Change** tag (opens an offering drop-down) and offering overview Enrolled students **Move** keep the same enrollment (payments/history) and retarget it to another offering in the same year/season (`moveEnrollmentToOfferingAction`). Closed destinations allowed; archived/cancelled/full/duplicate/terminal blocked. Session week access is cleared.
* **Cancel offering** — Offerings list **⋯** → Cancel offering (`cancelProgramOffering`); blocked while students are enrolled. Staff list shows **Offering Status** Active or Cancelled. Run SQL **`283`**. Cancelled classes are hidden from families.
* **Offering edit dialog** persists **Primary instructor** on Save (`setOfferingPrimaryInstructor`); picker is department employees (`staff.department_id`). One active offering-level primary per class (SQL **`278`**).
* **Department Settings** (`?tab=settings` on department workspace): name and color on one row, **Director Name** (department employee / `staff.is_department_head`), Description, and Terms with one **Save** at the bottom. **Delete department** is at the bottom and is blocked when any programs, offerings, or employees exist. Program defaults / Registration / Notifications / Promo Codes live on Program Workspace Settings (`/programs/[id]?tab=settings`). **Service Needs** lives on Event workspace Settings (`/event-management/[id]?tab=settings`). Leftover `?section=year-defaults|registration|notifications|promo-codes` opens the Programs doorway; leftover `?section=service-needs` opens department Events. Legacy `/programs/settings` → `/workforce?tab=departments`; `/programs/settings/service-needs` → `/event-management`. Run **`scripts/190_department_settings_promo_codes.sql`**.
* **Summer Camps 2026 Phase 1 import** (payments CSV → Recreational Camps / year + offerings / weeks / enrollments / FA / childcare addons): `scripts/import-summer-camps-2026.mjs`. **Merged** Camp One + Two → one **Summer Camp** (8 weeks, week-count tuition tiers + sibling 5%): `scripts/merge-summer-camps-2026.mjs` + SQL **`190`**. Enrollment process is **Direct Registration** (SQL **`281`**). Master roster + staff payroll phases pending.
* **QLH (Education) registrations import** (Excel roster → Education years `QLH 2024-2025` / `QLH 2025-2026` + default `QLH Registration` offering each): `scripts/import-qlh-registrations.mjs`.
* **Education historical enrollments import** (cleaned `EducationPrograms.xlsx` + `EduPrograms2.csv` → Education year programs 2022–27 plus **Istiqamah Institute** department; people + enrollments only): `scripts/import-edu-historical-enrollments.mjs`. Tag `EDU_HISTORICAL_V1`.
* **QIL historical payments** (`New_PAYMENT_TRANSACTION_REPORT.csv` → closed years **QIL 2022-2023** / **2023-2024** / **2024-2025**; 2025-26 left as-is; 2026-27 new Stripe IDs only, matched to existing offerings): `scripts/import-qil-historical-payments.mjs`. Tag `QIL_HISTORICAL_PAYMENTS_V1`.
* **QIL 2024-2025 gap fill** (`QIL24-25.csv` → missing students only on existing offerings): `scripts/import-qil-2024-2025-gap.mjs`. Tag `QIL_2024_25_GAP_V1`.

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
* **Reports → Add-ons** — org-wide extras (`/programs/reports/addons`); program workspace **Finance → Add-ons**

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
* Invite user by email (`/api/organizations/invite-user`)
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
* Module order: Dashboard → Directory → **Administration** → Membership → Fund Development → Programs → Event Management → …

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

**Giving collectives** (CRM `contact_type = group`) are not Contacts. Detail workspace: `/donations/groups/[id]` (Members, Group giving = campaign totals, Activity = events only — not individual gifts). Badge: Membership Group / Department / Group Donation via `giving_group_kind` (`scripts/167_giving_group_category.sql`). They appear on **Fund Development → Reports → Donor Giving** (`/donations/reports/donors?view=group`). Legacy `/contacts/groups` and `/contacts/[id]` for groups redirect into Donations.

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

**Groups:** Giving groups (`contact_type = group`) are Fund Development only — **Reports → Donor Giving → Group Giving** (`/donations/reports/donors?view=group`) and workspace `/donations/groups/[id]`. They exist to roll up donations from a department or collective (for example Qur'an Institute for Ladies), not as Directory identities. Campaign groups (`campaign_groups`) stay on Campaign → Groups. Membership Groups remain `/membership/groups`. Legacy Directory Groups URLs redirect into Fund Development.

**Reports:** Directory → Reports is analytics (growth, role distribution with overlap, completeness, possible duplicates). Types live in `lib/directory/directory-report-types.ts` (not the `"use server"` actions file). People / Organizations / Families are first-class Directory sections, not report tabs. Donor giving reports stay under Fund Development.

**Dynamic role navigation:** Directory flyout CRM lookups (Members, Sponsors, Parents, Vendors, Rental Customers) appear only when the current tenant has matching records. **Donors**, **Employees**, **Volunteers**, **Childcare Providers**, and **Service Providers** are not Directory nav items — operational lists live under **Administration** or Fund Development reports. Role-view URLs still work as bookmarks. `/resources/service-providers` redirects to `/directory/role/service-providers`. Counts load with sidebar modules (`fetchDirectoryNavSummary`). These are filtered views of canonical contacts — not duplicate identity tables. Role-view tables add lookup columns from Workforce / Membership / Fund Development / Vendor Hub / Rentals (summaries only). Donor giving columns are gated by `donations.view`. **Sponsor** is a manual `contact_roles` value (`scripts/269_directory_sponsor_role.sql`).

**Search Directory first:** Workforce, Vendor Hub, Venue Rentals, Fund Development, and Membership add flows search existing Directory people/organizations before creating a new canonical record.

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

Status: Working (IA: Overview / Campaigns / Pledges / Donations / Reports / Settings)

Routes stay `/donations/*`. Operations: `/donations/payments/transactions`, `/recurring`, `/import-match`, `/receipts`. Analytics: `/donations/reports` (Giving Summary, Donor Giving, Campaign Performance, Pledge Performance, Recurring Giving). Donor Giving (Individual / Household / Group) lists gifts only — pledge status and outstanding balance stay on **Pledges**.

Transactions and Giving Summary share a date range (`?range=`) that filters KPIs, charts, the table, and CSV export. Receipts Missing queue: `/donations/payments/receipts?status=missing`. Year-end statement KPIs read `donation_receipts` where `receipt_type = annual_statement`.

Permissions: `donations.view`, `donations.manage`, `donations.campaigns.manage`, `donations.prospects.manage`, `donations.reports.manage`.

Campaign workspace tabs: Overview, **Fundraising Plan**, Pledges, Donations, **Sponsorship**, Groups, **Wishlist**. Fundraising Plan has internal views **Ask Strategy | Prospects** (`?tab=plan`, `?tab=plan&section=prospects`). Legacy `?tab=strategy` and `?tab=prospects` still open those views. Each campaign has one goal (`campaigns.goal_amount`); Goal Breakdown phases are retired (`scripts/270_disable_campaign_goal_phases.sql`). Prospects is a shared donation/sponsorship outreach pipeline (`ask_type` on `campaign_prospects`; people and Directory organizations can both be prospects; activity log; convert donations to pledges and sponsorships to `campaign_sponsorships`). **Sponsorship** has internal views **Sponsors | Packages**: committed sponsorships plus campaign-owned sponsorship packages and benefit fulfillment. Wishlist items are campaign priorities (`campaign_wishlist_items`); pledged/collected come from `pledges`/`payments.wishlist_item_id`. Public donate: `/donate/w/{token}`. SQL: `scripts/267_campaign_wishlist.sql`, `scripts/284_campaign_sponsorship_prospects.sql`, `scripts/285_campaign_sponsorship_packages.sql`. Staff add/edit/collect pledges through one **Pledge Details** window (`components/donations/pledge-details-dialog.tsx`) on the global Pledges page, campaign workspace, prospects, and contact Financial pledges.

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

**Contact-first:** Add Employee requires selecting an existing contact (`HrContactPicker` → `createEmployeeFromContact`). Create the person in Contacts first if they are not found.

Removed tabs (redirect to Overview):

* Departments → `/workforce?tab=departments` (list at `/workforce/departments`: color + initial cards with Director and Employees; whole card opens the workspace. Department workspace at `/workforce/departments/[id]`: **department-level** Overview / Programs / Events / Employees / Group giving / Financial (**View Master Calendar** / **Check space availability** / **Create event** live on Events) / Settings; **Employees** is a top-level roster (`?tab=employees`; leftover `?tab=financial&section=employees` opens it); **Financial** sub-tabs are Payroll / Expenses / Financial Summary; **Programs** tab is a summary doorway into `/programs/[id]` (workspace tabs: Overview | Offerings | Applications (Application & Approval) | Registrations | **Schedule** [Class times: Week Board + List, plus Activity planner] | **Finance** [Transactions / Payment Summary / Add-ons, locked to this program] | **Reports** [Overview / Trends / Attendance, locked to this program] | Settings); leftover `?year=` redirects to that workspace; leftover `?tab=schedule` opens the Programs doorway; offering manage under `/programs/[id]/offerings/...`; department Overview = snapshot KPIs (programs, offerings, employees, students, events, collected/payroll/net) + programs list; description + Terms live on Settings (`terms_html` / `terms_pdf_url`, SQL `241`; no flyer on Overview); one Save plus Delete department at the bottom of Settings (delete blocked if programs, offerings, or employees exist); apply SQL `169`/`170`/`171`/`172`/`173`/`174`/`186`/`190`/`203`/`241`; scoped access via `lib/departments/department-access.ts`). Historical QIL load: `scripts/import-qil-year.mjs`; 2026–2027 payments/registrations: `scripts/import-qil-payments-2026-2027.mjs` (SQL `277`); prune Approved to QIApproved.xlsx + QIPayments.csv: `scripts/prune-qil-approved-2026-2027.mjs`; free Al-Ajurrumiyyah enroll: `scripts/enroll-qil-ajurrumiyyah-2026-2027.mjs`; consolidate course-as-programs → offerings: `scripts/migrate-qil-courses-to-offerings.mjs` (after `174`).
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
* Volunteer → `/customer/apply/volunteer` (Profile → Applications; **Copy apply link** on Volunteers). Approve creates/links a `volunteers` roster row.
* Childcare → `/customer/apply/childcare` (Profile → Applications; **Copy apply link** on providers). Approving creates/links a childcare `staff` row for payroll hour logging.
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

## Community Calendar

Status: Working (shared)

* Staff route: `/community-calendar` (top-level sidebar; included with Vendor Hub or Event Management, not a separate SKU)
* Public (no-login): `/o/[orgSlug]/community-calendar` — featured event, event-type circles, All/Today/This weekend, 4-column cards; ticketed → `/o/[orgSlug]/events/[id]`
* Sources: Vendor Hub bazaars (`vendor_hub_events.calendar_status`) + Event Management (`internal_events.community_calendar_status`; SQL `247`)
* Public page and staff UI use **Private** / **Public** (`published`); legacy `community_visible` rows still appear on the staff calendar until re-saved as Public
* Legacy: `/vendor-hub/community-calendar` redirects
* Publish: bazaar create/edit; Event workspace Overview → Community Calendar card
* Key files: `lib/community-calendar/*`, `public-community-calendar-view.tsx`, `community-calendar-client.tsx`

## Vendor Hub

Status: Working

* Staff flyout: **Overview** (`/vendor-hub`, exact) · **Vendor Network** · **Bazaar Events** · **Reports** · **Settings**
* Overview merges former Dashboard health KPIs with the former Reports Overview snapshot (revenue by category, top vendors)
* Reports tabs: **Vendor Sales** · **Booth Performance** · **Participation History** (`?tab=history`). Legacy `/vendor-hub/network/history` redirects
* Vendor Network tabs: Vendors, Onboarding, Documents, Invitations

## Event Management (workspace)

Status: In progress

* Staff flyout: **Overview** (`/event-management`) · **Events** (`/event-management/events`) · Master Calendar · Ticketing · Reports · Settings
* Ticketing Overview KPI cards show total events, active events, tickets issued, and revenue; the table lists active events with a **View all events** link to the Events tab. Issued/revenue include inactive historical ticket types and page all completed orders (not the first 1,000 only)
* Ticketing Orders defaults the Events filter to **Active events** (All / Past / a specific event remain available)
* Ticketing **Events** tab is one table with Overview sales columns plus a **Category** dropdown after Event (`ticketing_event_categories`, SQL `287`); Overview is the sales snapshot with KPI cards
* Events catalog is the view/manage list (search, department, Active/Draft/Past). Opening a row goes to `/event-management/[id]`.
* Progressive tabs via `workspace_features` + `ticketing_config.attendanceMode` (SQL `252`)
* Expenses ledger: `event_expenses` / `event-expense-actions.ts`
* UI: overview dashboard (colorful KPI row, Finance with revenue/expenses/net, Recent orders at bottom), registration workspace, finance, reports (attendee CSV), feature switches
* Public registration on `/o/[orgSlug]/events/[eventId]` with sale-window enforcement (`createPublicEventRegistration`)
* Paid public tickets: Stripe Checkout on org Connect (`ticket-stripe.ts`); same donations webhook `POST /api/webhooks/stripe/donations` when `manaratee_module=ticketing`. Fallback: pay at event + staff **Mark paid**. SQL `255`
* Staff **Refund** / Ticketing **Cancel/refund** refund Stripe Connect charges (`refundEventTicketOrder`). Full remaining voids tickets; partial keeps seats valid (`partially_refunded`, SQL `258` `refunded_amount_cents`). Dashboard `charge.refunded` is idempotent and applies Stripe’s refunded total.
* Door staff: `events.checkin` (SQL `257`) — scan/check-in without event manage. Pair with `events.view`.
* Customer portal **My Tickets** `/customer/tickets` (codes + QR + resume checkout). SQL `256`
* Youth forms / liability waiver on Opportunities + Youth tab Forms dialog (SQL `259`)
* Event documents on Settings (`event_documents`, SQL `254`)
* **Service Needs** on Event workspace Settings (volunteers / youth / vendors → `internal_events.requires_*` + `service_requirements`; `internal-event-service-needs-settings.tsx`)
* **TicketOrders.csv Event Management import (August 2026):** Historical Eventbrite ticket orders → `internal_events` + `event_ticket_types` + `ticket_orders` + `tickets`. Groups repeated Eventbrite order totals into one order per buyer/event/date. Skips vendor/bazaar booths, QLH/QIL/Sunday School, and processing-fee rows. Attaches Sep 12 2026 Crystal Banquet tickets to the existing Annual Fundraising Dinner. Attendee = ticket holder; Contact column is the Directory contact (name + email + phone, name links to profile). SQL **`286`**. Tag `TICKET_ORDERS_CSV_V1`. Script: `node scripts/import-ticket-orders-csv.mjs` / `--execute`. Reports: `scripts/reports/ticket-orders-import-dry-run.json`, `ticket-orders-import-execute.json`.
