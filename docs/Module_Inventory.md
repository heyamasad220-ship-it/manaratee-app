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
* **Quick Create** + **Edit Program** tabbed setup (see `docs/programs-staff-setup-ui.md`)
* Organization filtering
* Program details
* Eligibility rules (ages, grades, gender, capacity groups)
* Registration types and fee plans (Edit Program)
* Offering-scoped pricing (Phase 2A/2B)

Pending:

* Session enrollment tracking improvements
* Phase 3 Stripe checkout

---

## Program Sessions

Status: Partial

Features:

* Program sessions table
* Session capacity fields

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

Status: In Development

Completed:

* Database design
* Program settings
* Status history
* Document storage

Pending:

* Customer application flow
* Admin review dashboard
* Approval workflow

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

---

## Sidebar System

Status: Working

Features:

* Subscription filtering
* Permission filtering
* Dynamic visibility

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
* `/hr/volunteers`
* `/hr/teams`

---

### Employees

Status: Working (simplified)

Route: `/hr/employees`

Tabs: Overview, Employees, Departments, Positions

Removed tabs (redirect to Overview or related pages):

* Time Off, Work Schedule, Notifications, Teams, Applications

Employment applications accessed via header link → filtered Submissions view.

---

### Child Care

Status: Working (real data)

Route: `/hr/childcare`

Data source: approved `childcare_provider` applications (not mock data).

Key files:

* `app/(dashboard)/hr/childcare/page.tsx`
* `components/hr/hr-childcare-panel.tsx`
* `lib/hr/childcare-provider-actions.ts`

Stats cards: Total Providers, Active Providers, Total Hours, Total Events Worked.

Hours and event history show `0` until event participation tracking exists.

Header action: Provider Applications → filtered Submissions tab.

---

### Applications (People Management hub)

Status: Active Development

Canonical route: `/people-management/applications`

Permission: `applications.view`

Tabs:

| Tab | Purpose |
|-----|---------|
| Overview | Dashboard stats, status shortcuts, per-type submission counts |
| Submissions | Search, filters, applications table, review links |
| Templates | Application type cards; form builder scaffold (in progress) |

URL query params:

* `tab` — `overview` (default), `submissions`, `templates`
* `status` — filters Submissions (e.g. `pending_review`, `approved`)
* `application_type` — filters by type; opens Submissions tab when set

Hub types on Overview/Submissions (employment excluded from default hub):

* volunteer
* committee_member
* childcare_provider

Employment still available via `?application_type=employment`.

Redirects:

* `/hr/applications`, `/settings/applications` → PM Applications
* `/applications/pending|approved|rejected` → PM or `/applications/all` by module
* Old Settings Applications tabs → appropriate PM or Employees pages

Key files:

* `app/(dashboard)/people-management/applications/page.tsx`
* `components/applications/people-management-applications-client.tsx`
* `components/applications/applications-module-page.tsx`
* `components/applications/application-templates-panel.tsx`

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

Status: Partial

Route: `/hr/reports`
