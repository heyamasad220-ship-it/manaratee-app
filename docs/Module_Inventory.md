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
* Permission matrix
* Permission assignment
* Server-side permission checks
* Permission-aware navigation

---

## Programs

Status: Working

Features:

* Program CRUD
* **Quick Create** + program detail inline edit + offering manage (see `docs/programs-staff-setup-ui.md`)
* Organization filtering
* Program details
* Eligibility rules (ages, grades, gender, capacity groups)
* Registration model, eligibility, capacity, and fee plans (offering overview + edit dialog Advanced; unified fees + discounts save with dialog Save; run `scripts/200_program_pricing_billing_scope.sql`)
* Program detail **Reports** — enrollments across offerings (filter + CSV)
* Offering-scoped pricing (Phase 2A/2B)
* **Department Settings** (`?tab=settings` on department workspace): General / Registration / Notifications stubs (`department_program_settings`); department-wide promo codes (`discount_codes.department_id`); Service Needs for that department’s years. Legacy `/programs/settings*` → `/workforce?tab=departments`. Run **`scripts/190_department_settings_promo_codes.sql`**.
* **Summer Camps 2026 Phase 1 import** (payments CSV → Recreational Camps / year + offerings / weeks / enrollments / FA / childcare addons): `scripts/import-summer-camps-2026.mjs`. **Merged** Camp One + Two → one **Summer Camp** (8 weeks, week-count tuition tiers + sibling 5%): `scripts/merge-summer-camps-2026.mjs` + SQL **`190`**. Master roster + staff payroll phases pending.
* **QLH (Education) registrations import** (Excel roster → Education years `QLH 2024-2025` / `QLH 2025-2026` + default `QLH Registration` offering each): `scripts/import-qlh-registrations.mjs`.

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
* **Reports → Registrations** — family/contact payment view (`/programs/registrations`)
* **Reports → Enrollments** — one row per participant demographics/consent (`/programs/reports/enrollments`)
* **Reports → Payment Summary** — family balances, program fees (months × monthly), additional fees (`/programs/reports/tuition-plans`)
* **Reports → Add-ons** — one row per purchased add-on (materials, lunch, uniforms, field trips) (`/programs/reports/addons`)

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

* List organization members with roles
* Invite user by email (`/api/organizations/invite-user`)
* Change member organization role

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
* Module order: Dashboard → Contacts → **Programs/ Events** → Membership → Fund Development → …

* Pinned footer: Billing (super admin SaaS subscription) → Settings

---

## Finance

Status: Working (nav folded into **Programs/ Events**)

Routes:

* `/finance` → `/finance/transactions`
* `/finance/transactions` — org payment transactions (Donations + Programs); voided hidden by default (Status column filter); **Reports** tab under Programs/ Events
* `/finance/payroll` — org payroll queue (Mark paid); **Reports** tab under Programs/ Events
* `/finance/financial-assistance` — FA hub (Overview / Submissions / Templates / Reports / Payment Plans); top-level **Programs/ Events** drawer item

No separate Finance drawer group. Transactions and Payroll are tabs on **Reports**; Financial Assistance is its own drawer link.

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

**Giving collectives** (CRM `contact_type = group`) are not Contacts. Detail workspace: `/donations/groups/[id]` (Members, Group giving = campaign totals, Activity = events only — not individual gifts). Badge: Membership Group / Department / Group Donation via `giving_group_kind` (`scripts/167_giving_group_category.sql`). They appear on **Donations → Reports → Donors → Group Giving** (`/donations/reports/donors?view=group`). Legacy `/contacts/groups` and `/contacts/[id]` for groups redirect into Donations.

Enable for orgs: Platform Admin modules toggle, or repair SQL `scripts/165_ensure_membership_sidebar.sql` (also `scripts/058_membership_module.sql`). Permissions: `membership.view` / `membership.manage` (sidebar falls back to contacts permissions).

---

## Reports

Status: Planned

No active implementation yet.

---

## Contacts / CRM

Status: **Phase 1 complete** (identity integrity + affiliation sync, June 2026)

North star: **One Contact · Many Roles · Many Activities · No Duplicate Identities**

### Affiliation sync engine

| File | Role |
|------|------|
| `lib/contacts/contact-affiliation-sync.ts` | `computeDerivedAffiliations`, `syncContactAffiliations` (RPC), webhook helpers |
| `lib/contacts/contact-affiliation-rules.ts` | Sticky vs auto-removable policy, terminal enrollment statuses |
| `lib/contacts/contact-constants.ts` | Role labels; participation roles excluded from manual CRM picks |
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

Routes: `/contacts/people` (default; `/contacts` redirects here), `/contacts/[id]`, `/contacts/families` (redirects to Reports → Families), `/contacts/families/[id]` (redirects to primary contact), `/contacts/organizations`, `/contacts/reports`, `/contacts/reports/directory`, `/contacts/settings`

**Contact profile Overview:** Module-gated right rail with Quick Actions, Financial Summary, and Activity (`components/contacts/contact-profile-overview-rail.tsx`).

**Groups** list is not under Contacts. Giving collectives use `/donations/groups/[id]` and roll up on **Donations → Reports → Donors → Group Giving**; `/contacts/groups` and group `/contacts/[id]` redirect into Donations. Member groups live under **Membership → Groups**.

**Reports (Phase 1):** Contact Directory report with Individuals / Organizations / Families tabs, Roles filter + CSV export (`lib/contacts/contact-report-actions.ts`, `components/contacts/contacts-directory-report-panel.tsx`). Families removed from Contacts sidebar (July 2026). Donor giving reports stay under Donations.

**Contact record types:** `individual`, `organization`, `group` (migration `132`). Groups = internal collectives (halaqas, committees); Organizations = external entities.

Validation:

```bash
npm run validate:contacts-phase1
```

Deferred (Phase 2+): participant merge UI, historical backfill, venue rental customer derivation, segmentation.

**RLS wave 1 (June 2026):** Migrations `102`–`111`. M6b aligns ticketing/membership RPC gates. CR-8: `npm run validate:contacts-g6`. M4 authorized for staging after G6 GREEN.

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

* Departments → `/workforce?tab=departments` (department workspace at `/workforce/departments/[id]`: **department-level** Overview / Programs / Group giving / Events / Settings; **year-level** via `?year=` — Overview / Offerings / Registrations / Schedule / Financial / Reports; department Overview = flyer + description + Terms (`terms_html` / `terms_pdf_url`, SQL `241`); Programs catalog = `?tab=programs` without year; click program → `?year=` Program Overview; offering manage under `/workforce/departments/[id]/programs/...`; legacy tab aliases unchanged; apply SQL `169`/`170`/`171`/`172`/`173`/`174`/`186`/`190`/`203`/`241`; scoped access via `lib/departments/department-access.ts`). Historical QIL load: `scripts/import-qil-year.mjs`; consolidate course-as-programs → offerings: `scripts/migrate-qil-courses-to-offerings.mjs` (after `174`).
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
**Registrations:** `/programs/reports/childcare` (Programs/ Events → Reports → Childcare)

Data source: approved `childcare_provider` applications (not mock data).

Key files:

* `app/(dashboard)/workforce/childcare/page.tsx`
* `app/(dashboard)/programs/reports/childcare/page.tsx`
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
