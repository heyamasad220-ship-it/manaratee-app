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
* Subscription-aware modules
* **Roles & Permissions subscription filter (June 2026):** Settings → Roles & Permissions only lists permission rows for modules enabled on the org (`lib/permissions/permission-definitions.ts`, filtered via `loadOrganizationEnabledModuleSlugs`). Core modules (Settings, Contacts) always appear; product modules (e.g. Donations only for MAS Dallas) gate their permission groups. **Facility Manager** and **Facility Coordinator** roles are hidden unless the org has **Facilities** (`spaces`) or **Venue Rentals** (`bookings`) enabled (`filterOrganizationRolesForOrganization` in `lib/permissions/facilities-access.ts`).
* **Organization audit log (June 2026):** Settings → **Audit Log** (`/settings/audit-log`) — append-only history of donation ledger edits (payment update/void/refund/allocate, pledge update/payment/cancel) and permission changes (member role assignment, role permission toggles). Table: `organization_audit_logs` (migration `142_organization_audit_logs.sql`). Writes via service role in `lib/audit/organization-audit-log.ts`; reads via RLS for staff with `settings.users.view`, `settings.roles.view`, `donations.view`, or `donations.manage`. Permission toggles route through `setOrganizationRolePermissionAction` so changes are logged server-side.
* **Org billing view (June 2026):** `/billing` (sidebar **Billing** under System; `/settings/billing` and `/settings/subscription` redirect here) — plan price, persona bundle, plan limits, enabled modules, payment methods on file, and billing history (`lib/organizations/organization-billing-actions.ts`, `organization-subscription-summary.ts`). Visible to platform support sessions, `organization_members.role` of `super_admin`/`owner`, or org role name **Super Admin**. Apply migration `121_organization_billing.sql` for payment methods and invoice history tables.
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

**Donor join deep-link (June 2026):** Settings → Users exposes two links: general customer join and **Donor signup and give**. The donor link is `/join/{org-slug}?next=/customer/donation?give=one-time` (encoded in the URL). After signup or sign-in, the user is routed to `/customer/donation` and the **Donate** dialog opens (one-time by default). Requires donations module + org Stripe Connect (Donations → Settings → Online Payments). Key files: `lib/organizations/join-organization-url.ts`, `lib/auth/sanitize-customer-redirect-path.ts`, `components/customer/organization-join-client.tsx`, `components/settings/organization-join-link-card.tsx`.

## Customer Venue Rentals (pilot — Phase 1 UX)

Status: Pilot preparation (June 2026)

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

**Contacts list UI (June 2026):** Removed **All Contacts** (`/contacts` redirects to `/contacts/people`). Sidebar lists **People**, **Families**, **Organizations**, **Groups**, **Reports**, and **Settings**. User-facing **Affiliation** terminology replaced with **Roles** in Contacts → Settings automatic-role rules (contact profiles no longer show an editable Roles card — roles sync from activity only). Discount tags still sync automatically from roles in the background (`person_tags` on affiliation sync); the Discount Tags card was removed from contact profile Overview. **Contact profile Overview (June 2026):** Compact header with name, record type, status, and group badges (**Assign** opens searchable group picker via `addGroupMemberAction`); sub-tabs **General** (name, phone, DOB, gender, address, notes) and **Family** (family members). People/Organizations/Groups lists: search + add only (role/status dropdown filters removed); table columns **Contact** (name styled as link), **Email**, **Phone**, **Created by** (not stored yet — shows —), **Last modified**, **Status** (Active/Inactive only). No **Actions** column — edit, merge, and delete live on the contact profile **Overview** tab. Removed intro banners and stat cards on type-specific list pages. Removed Teams column and team filter from `ContactsCrmList`. Team assignment remains on individual contact profiles where HR teams are enabled. **Organizations list (July 2026):** first column renamed **Organization** with column **sort** + **filter** (name); **Primary Contact** moved between organization name and Email; top search bar removed (use column filter); server-side sort via `fetchContactsList` (`sortBy`, `nameFilter`). **Groups list (July 2026):** same pattern — **Group** column with sort/filter, Primary Contact after name, no top search bar.

**Contacts Reports — Phase 1 (June 2026):** Sidebar **Reports** (above Settings). Hub at `/contacts/reports`; **Contact Directory** at `/contacts/reports/directory`. Column-header filters on **Contact** (search name/email/phone), **Type**, **Roles**, **Status**, and **Teams** (no separate filters card). Summary cards (total + people/orgs/groups breakdown), paginated preview (50 rows/page), **Export CSV** of the full filtered set (includes address fields). Requires `contacts.view`. Donor giving totals remain under **Donations → Reports → Donors** (hub links there). Key files: `lib/contacts/contact-report-actions.ts`, `lib/contacts/contact-report-csv.ts`, `components/contacts/contacts-directory-report-panel.tsx`.

**Group giving attribution (June 2026):** When recording a payment (Donations → Payments or pledge payment), staff can optionally pick a **Group** from `/contacts/groups`. The gift stays on the individual contact; `payments.attributed_group_contact_id` counts it toward the group total and **auto-adds the donor to `contact_group_members`**. Group Financial tab rollups: **Group Gifts** (payments on the group donor) + **Member Gifts for Group** (attributed individual gifts) = **Combined Total**. Pooled group checks should still be recorded on the group contact directly. Apply **`scripts/136_payment_attributed_group.sql`** (after `135`). Key files: `lib/contacts/group-giving-actions.ts`, `components/donations/donation-group-picker.tsx`, `components/donations/donation-payments-panel.tsx`.

**Contacts Groups record type (June 2026):** New **Groups** list at `/contacts/groups` for internal collectives (halaqas, committees, pooled giving). **Groups are the primary name** for collectives: add **members** on the group profile (**Overview → Group Members**); group gifts and **group pledges** stay on the group **Financial** tab (**Donations**, **Pledges** filters); each member’s individual gifts stay on their own profile. Group **Overview** hides address (organizations still show address). **Payment Methods** and **Statements** tabs are hidden for groups (people and organizations only; giving statements go to individual contacts). Group **Financial** uses **Group Gifts / Member Gifts / Combined Total** rollup cards only (not the generic Total Paid / Lifetime summary row on people and orgs). Individuals see linked groups on **Overview → Groups**. Table: `contact_group_members` (migration `135`). `contact_type = 'group'` with optional `primary_contact_name`. Group donor rows use `donor_type = 'organization'`. HR **Teams** remain optional for membership programs; use **Groups** for donation rollups. Apply: `scripts/132_contact_type_group.sql`, `scripts/133_sync_contact_affiliations_group.sql`, **`scripts/135_contact_group_members.sql`**. Key files: `lib/contacts/group-members-load-action.ts`, `lib/contacts/group-membership-data.ts`, `lib/contacts/group-member-actions.ts`, `components/contacts/contact-group-members-panel.tsx`, `components/contacts/contact-group-financial-panel.tsx`.

**Settings → Users list fix (June 2026):** `/settings/users` now loads members via `fetchOrganizationUsersForSettings()` (service role + `settings.users.view`) instead of browser Supabase queries limited by RLS — admins see all org members (e.g. invited Super Admins), not only their own row. Row menu supports **Change Role**, **Edit Profile** (name + login email), **Send Reset Email** (Supabase recovery link to `/auth/confirm`), and **Delete** (removes org membership; blocks self-delete and last Super Admin). Actions require org system admin or `settings.users.manage`; audit log entries: `member.profile_updated`, `member.password_reset_sent`, `member.removed`. Key file: `lib/organizations/organization-users-actions.ts`.

**Contacts add form (June 2026):** Add Contact no longer requires affiliations at create time; donor and other tags sync from activity or can be set on the contact profile.

**Merge duplicate donor contacts (June 2026):** When the same entity was imported twice (e.g. `MSAADA` and `MSAADA Educational Foundation`), merge into one canonical contact. **Individuals only** in the UI — groups and organizations cannot be merged (UI hidden; server rejects). **CLI** supports organizations and groups (moves `contact_group_members` before deleting the source group). **UI:** contact profile **Merge duplicate** (keep this record, search for the duplicate) or list row **⋯ → Merge into another contact** (remove this row, search for the record to keep). Preview shows payments/pledges moved before confirm. Requires `contacts.manage`; merge actions use the service-role client after that gate so payment/pledge counts and relinks work without separate `donations.view`. **CLI:** `node scripts/merge-donor-contacts.mjs` (`--search`, `--target-id`, `--source-id`, `--rename`, `--execute`). Logic: `lib/contacts/contact-merge.ts`, `lib/contacts/contact-merge-actions.ts`, `components/contacts/contact-merge-dialog.tsx`. Keeps the **target** contact’s name unless `--rename` is set; reassigns pledges/payments/donor rows, notes, roles; syncs all linked payment `sender_name` values to the canonical contact name; deletes source; syncs affiliations. **All Payments** list displays the linked contact/donor name (not stale import `sender_name`).

**Donor affiliation after first payment (June 2026):** … **People → Donor filter** lists contacts with at least one non-voided payment (`search_donor_giving_contact_ids`, migrations `129` + **`130` grants**), not only stored affiliation tags. **Orphan donors** (missing or stale `contact_id`) are excluded from People until linked — repair: `node scripts/link-orphan-donors-to-contacts.mjs --execute` (creates/matches contacts, merges duplicate donor rows, backfills payment `contact_id`), then `node scripts/sync-donor-affiliations.mjs --execute`. Key files: `lib/contacts/contact-list-actions.ts`, `scripts/link-orphan-donors-to-contacts.mjs`.

**Contacts search fix (June 2026):** Contact list search no longer references `primary_contact_name` when that column is absent in the database — fixes production search errors after bulk import.

**Contact profile module gating (June 2026):** Contact detail tabs and panels respect org-enabled modules from `/api/organizations/sidebar-modules` — e.g. MAS Dallas (donations-only) hides Workforce, venue rentals, programs/membership participation, and applications sections. Key files: `lib/contacts/contact-profile-module-access.ts`, `components/contacts/contact-profile-client.tsx`.

**Contact profile admin parity (June 2026):** Staff contact profile **Overview** mirrors the customer portal profile: editable address, bio/notes, date of birth, gender, and family members (add/remove). **Payment methods** (stored credit/debit cards on the contact profile) are on the **Financial** tab with **Add Card** (full card number and security code at entry; only last 4, expiration, and cardholder name persist). Customer portal **Profile → Payment Methods** uses the same `ContactPaymentMethodsPanel` and persists via `lib/customer/customer-payment-method-actions.ts` (loaded in `loadCustomerProfilePortalData`). Apply migration `138_contact_payment_methods.sql`. **Date of birth** is optional on staff contact edit and when staff add a family member (email and phone optional too); it remains required on customer signup and customer family-member add. Key files: `components/contacts/contact-basics-panel.tsx`, `components/contacts/contact-family-panel.tsx`, `components/contacts/contact-payment-methods-panel.tsx`, `lib/contacts/contact-payment-method-actions.ts`, `lib/contacts/contact-profile-admin-actions.ts`.

**Family giving / households (July 2026):** Donations remain on **individual contacts** only — no `family_id` on `payments`. New tables `families` + `family_members` (migration **`148`**) backfill from `person_relationships`; removing a member sets `end_date` (gifts stay on the contact). **Contacts → Families** list shows lifetime giving, gift count, and last gift; click a **family name** to open `/contacts/families/[id]` with summary cards, per-member giving, and recent family gifts. **Donations → Reports → Donors** toggles **Individual Giving** vs **Household Giving** (RPC `donation_household_giving_report`, migration **`149`**). Tax receipts stay on the donating contact. Adding/removing family on a contact profile syncs `family_members` via `lib/contacts/family-sync.ts`. **Household management (July 2026):** Contact profile **Family** tab — **Link existing contact** (search spouse/donor already in CRM) or create new person; banner links to household giving page. **Remove member** ends household membership only — the contact and all donations stay on their individual record (divorce / separation). **Household settings** on `/contacts/families/[id]` — edit household name, change primary contact / head, and remove members from the Members table (`lib/contacts/family-management-actions.ts`, `components/contacts/family-settings-panel.tsx`, `components/contacts/family-members-panel.tsx`). Linking ends the member's prior solo household when they were the only active member. Key files: `lib/contacts/family-giving-data.ts`, `lib/contacts/family-actions.ts`, `components/contacts/family-giving-detail.tsx`, `components/contacts/contact-family-panel.tsx`.

**Configurable automatic affiliations (June 2026):** Contacts → Settings → **Affiliations** lets each org turn activity-based affiliations on/off. Defaults follow subscribed modules (e.g. venue-only orgs have Donor off when Donations is not enabled). Stored in `organization_affiliation_settings`; enforced by `sync_contact_affiliations` (migration `115`). Manual affiliations on contact profiles are unchanged. Files: `lib/contacts/contact-affiliation-settings.ts`, `components/contacts/affiliation-rules-panel.tsx`, `scripts/115_organization_affiliation_settings.sql`.

**Contacts profile edit (June 2026):** Contacts list **View & edit profile** (and row click) opens `/contacts/[id]?edit=1` with the Contact information form in edit mode. Profile header includes **Edit contact**; record type and primary contact are editable on save. Files: `components/contacts/contact-profile-client.tsx`, `components/contacts/contact-basics-panel.tsx`, `lib/contacts/contact-profile-path.ts`.

**Donation contact picker (June 2026):** Add Pledge and Record Payment search **org contacts** (name, email, phone), not only existing `donors` rows. On save, `ensureDonorExtensionForContact` creates the donor extension when needed. Add Pledge shows an **Add contact** button when search returns no matches; quick-add dialog supports **Person / Organization**, primary contact name for organizations, and auto-suggests Organization when the name looks like a company (LLC, Inc, etc.). Donor affiliation syncs on **first payment**, not pledge creation. Key files: `lib/donations/donation-list-actions.ts`, `components/contacts/quick-add-contact-dialog.tsx`.

**Pledge reassignment (June 2026):** **Edit Pledge** on **Campaigns → Pledges** (`/donations/pledges`) and contact profile **Financial → Pledges** includes an **Assigned to** picker (person, organization, or group). Saving reassigns the pledge to the selected contact’s donor record and moves linked **payments** and **pledge reminders** with it; affiliation sync runs on both old and new contacts. Use this to move historical pledges from an individual to a group (e.g. Quran Institute). Key files: `lib/donations/pledge-admin-actions.ts` (`updatePledgeAction`, `reassignPledgeContact`), `components/donations/pledge-contact-picker.tsx`, `components/donations/donor-pledges-tab.tsx`, `app/(dashboard)/donations/(operations)/pledges/page.tsx`.

**Contact Financial → cross-module summary (June 2026):** Contact profile **Financial** tab is a read-only summary hub (not a second ledger). **Summary cards:** Total Paid, Lifetime Contributions (donations only), Outstanding Balance, Last Financial Activity. **Open Balances** lists unpaid pledges, venue rental payment lines, and program fee balances from existing tables. **Financial Activity** is a unified timeline with one tab row: activity filters (**All Transactions** — actual payments only, no pledges; Donations, Pledges, …) plus **Payment Methods** and **Statements** after Pledges when applicable. **Payment Methods** tab: staff add cards here; contacts can also add cards from **Profile → Payment Methods** in the customer portal (same saved list). Table columns: **Type** = activity kind (Donation, Pledge, Programs, Venue Rental, …); **Description** = campaign name for pledges, One-Time/Recurring Donation for gifts, program name for programs; **Method** = Cash, Check, Zelle, PayPal, Venmo, Square, etc.; Stripe shows `•••• 1234` when card metadata is available; generic **manual** / **import** sources show **—**; **Status** = for donations: **Succeeded**, **Failed**, **Refunded**, or **Partially Refunded** (imported/unallocated gifts show **Succeeded**); for pledges: **Open**, **Partial**, **Fulfilled**, or **Cancelled**. **Date** is clickable: donation **payments** open an inline **Edit Payment** dialog; **pledges** open an inline **Edit Pledge** dialog on the same contact profile; venue rentals and other modules follow their linked record. Recurring gifts remain in the sidebar when applicable. Pledge commitments appear under the **Pledges** filter; gift payments stay under **Donations** even when later linked to a pledge. **Contact profile back navigation:** the back button returns to the previous dashboard page (e.g. **Back to Campaign** when opened from a campaign) via `returnTo` query param or session-tracked last path; contact dialogs include **Open full profile** with the same return context. Key files: `components/contacts/contact-financial-panel.tsx`, `lib/contacts/contact-financial-actions.ts`, `lib/navigation/return-to.ts`.

**Contact Financial → Pledges + reminders (June 2026):** Pledge remind/mark-contacted and payment actions remain in Donations module (`DonorPledgesTab` on donor workflows). Contact Financial tab lists pledge events in the unified timeline only.

**Payment import & match (June 2026 — unified flow):** Under **Payments** → **Import** (`/donations/payments/import`; Upload + History sub-tabs) and **Match Payments** (`/donations/payments/match`). Upload CSV → payments are created immediately in the match queue (`pending_review`) in **100-row server chunks**. **Auto-match after import** is on by default: high-confidence contact matches (≥85%, email/phone/exact name) link automatically; **name-only imports with no ≥85% match auto-create a new contact** from the payment sender name (no email/phone on the row). Weak partial matches (e.g. shared “Dr.”) are not shown as suggestions. Remainder with email/phone but no match stays for manual review. **Auto-allocate to best pledge** (default on with auto-match) uses `lib/donations/payment-pledge-allocation.ts`: prefers **lump-sum** (`one_time`) open pledges over **installment** schedules (`monthly`, `quarterly`, `yearly`); skips installment pledges when donor has an active `recurring_donation_plans` row and a lump-sum pledge exists; leaves payment **unallocated** when two pledges tie on top balance. Bulk auto-match and **Quick Apply** share the same picker. Migrations `116`–`118`. Key files: `components/donations/payment-import-match-workspace.tsx`, `lib/donations/payment-import-match-actions.ts`, `lib/donations/payment-contact-matching.ts`, `lib/donations/payment-pledge-allocation.ts`. Legacy `/donations/import` and `/donations/reconcile` redirect to the new Payments routes.

**Payment reconcile matching (June 2026):** Superseded by unified Import & Match flow above. Legacy `/donations/reconcile` redirects to `/donations/payments/match`.

**Campaign progress gauge (June 2026):** Speedometer-style fundraising gauge on `/donations/campaigns` (card grid for campaigns with goals) and campaign detail **Goal Progress**. Red/orange/green arc, needle, and total raised; supports exceeding 100% of goal. Component: `components/donations/campaign-progress-gauge.tsx`.

**Campaign source breakdown (June 2026):** Campaign detail (`/donations/campaigns/[id]`) shows fundraising metrics in a **colorful table** (Cash, Checks, Square, One-Time, Recurring, Ticket Sales, Donors, Largest Gift, Pledges last with highlight) plus **Goal Progress** gauge on the right. **Per-campaign metric customization:** **Customize** on the overview table toggles visible rows and order; **Automatic** mode (default) hides empty source rows such as Ticket Sales or Square until they have activity. Stored in `campaigns.overview_metric_keys` (migration `134`). Below metrics: **Outstanding Pledges** table for the campaign (donor with **Primary contact** subline for organizations/groups or colored group badges for individuals, pledged/paid/balance in red, status with orange **Open** badge, date, **Actions** menu linking to pledge view/edit/payment on `/donations/pledges`). Donor names open **Contact profile in a modal** (`ContactProfileDialog`) from outstanding pledges, campaign donors list, and largest-gift row. Logic: `computeCampaignSourceBreakdown`, `fetchCampaignOutstandingPledges` in `lib/donations/campaign-analytics.ts`; metric config: `lib/donations/campaign-overview-metrics.ts`; UI: `campaign-source-breakdown-cards.tsx`, `campaign-overview-metrics-editor.tsx` (`CampaignOverviewMetricsTable`), `campaign-outstanding-pledges-table.tsx`.

**Donations payment methods (June 2026):** Removed **Payment Methods** tab from Donations → Settings; org cards on file are managed under **Billing** (`/billing`). Existing `payment_methods` rows remain for donation source labels where referenced.

**Contact timeline reset (July 2026):** Contact profile **Timeline** tab hides import-sourced payments/pledges and events before `organizations.contact_timeline_reset_at`. Financial tab and reports are unchanged. Run migration **`154`**, then: `node scripts/clear-contact-timelines.mjs --org <uuid> --execute` (backs up and deletes `contact_activities`, sets reset timestamp). Rules: `lib/contacts/contact-timeline-rules.ts`.

**Donor contact enrichment import (July 2026):** Bulk match/create contacts from a donor directory CSV and fill missing email/phone without overwriting existing values. Tool: `node scripts/enrich-donor-contacts-from-csv.mjs --file <csv> --execute`. Matches by email → phone → exact name → fuzzy name (≥85%); creates unmatched rows; ensures `donors` extension; runs `sync_contact_affiliations` per affected contact. Report JSON under `scripts/reports/enrich-donor-contacts-*.json`.

**MAS campaign ledger import (June 2026):** Historical pledge/payment spreadsheet import via `node scripts/import-mas-campaign-ledger.mjs --file <csv> [--campaign <name>] [--execute] [--create-campaigns]`. Dry-run by default. **Payments-only import:** `--payments-only` for CSVs with **no Pledge/Balance** — one-time payments only (no pledges). With **Group Name** → group attribution + membership links (`GroupDonationsImport.csv`). Without group column → individual one-time gifts (`One-Time-Donations.csv`). Campaign alias: `Ramadan2025` → `Ramadan 2025`. **Ledger semantics:** `Pledge` = explicit commitment; `Cash`/`Checks` = direct payments; `One-time`/`CC` = one-time card payment toward a pledge; `Recurring`/`CC+` = installment payments toward a pledge. When payment columns are empty but **`Total Received`** is set (fully paid rows), that amount is used as the payment total. **Blank Pledge + payment(s)** → implicit fulfilled pledge equal to total payments on the row (no outstanding balance). Tag: `MAS_CAMPAIGN_LEDGER_V1`. Skips spreadsheet summary rows (`Total`, `Subtotal`, `Grand Total`). **Group names** (e.g. `Wednesday Halaqa`) import as `contact_type = group`, not People. **Square terminal batches:** ledger rows named `Square` import as campaign batch deposits (`source: square`, no People contact) and appear on the campaign overview **Square** line alongside Cash/Checks. **Repair existing Square donor:** `node scripts/clean-mas-ledger-square-batch.mjs --execute`. **Reclassify group mis-imports:** `node scripts/reclassify-mas-ledger-group-contacts.mjs --execute` (after migration `132`). **Repair existing imports:** `node scripts/repair-mas-ledger-implicit-pledges.mjs [--execute]` — creates missing implicit pledges and links unallocated MAS-tagged payments without re-importing. If CSV campaign spelling differs from an existing record (e.g. `Ramadan2025` vs `Ramadan 2025`), merge with `node scripts/merge-mas-ramadan2025-campaign.mjs --execute`. Erroneous summary donor cleanup: `node scripts/clean-mas-ledger-total-donor.mjs --execute`. Placeholder donor cleanup (names that are only `?`, start with `?`, or high `?` ratio without a real Latin name): `node scripts/merge-mas-anonymous-placeholder-donors.mjs [--target "Anonymous"] [--target-id <uuid>] [--execute]` — reassigns pledges/payments to the canonical Anonymous donor and deletes source donors/orphan contacts. Report: `scripts/reports/mas-anonymous-placeholder-donor-merge-<date>.json`.

**Donations pilot blockers (June 2026):** Migrations `119`–`120` — voided payments excluded from `pledge_status_view` balances and headline totals; cancelled pledges emit `calculated_status = cancelled` (excluded from Collect/allocation); portal pledge pay saves `status = allocated`. Validation: `lib/donations/pilot-blocker-validation.test.ts`. Apply: `119_donations_pilot_blocker_views.sql`, `120_donations_pilot_blocker_totals.sql`.

**Donations sidebar (June 2026):** Under Donations: **Overview**, **Campaigns** (campaign list + detail), **Reports** (tabs: One-Time Donations, Recurring Donations, Pledges, Donors, Import, Match Payments, Receipts), **Settings**. Legacy `/donations/pledges` redirects to `/donations/reports/pledges`. Campaign detail includes **Add Pledge** (pre-selects the campaign).

**Pledge collection merged into Pledges (June 2026):** Collect tab removed; collection reminders, last-contacted dates, and inline reminder actions live on **Campaigns → Pledges** (`/donations/pledges#collection-queue`). Legacy `/donations/collect` redirects to the same anchor.

**Donors giving report (June 2026):** Reports → **Donors** (`/donations/reports/donors`) … Donor names link to the **canonical contact profile** Financial tab (`/contacts/[contactId]?tab=financial`), not a separate donor page. Cross-module financial summary, pledge management, giving statements, and recurring gifts live on that tab via `ContactFinancialPanel`. Legacy `/donations/donors/individuals/[id]` and `/donations/donors/organizations/[id]` redirect to the contact profile when `donors.contact_id` is set. Contact basics and notes remain on the profile **Overview** tab. Apply `scripts/127_donor_giving_report.sql`, `scripts/128_donor_giving_report_contact_id.sql`, `scripts/143_donor_giving_report_type_fix.sql` (date cast + net amounts), `scripts/144_donor_giving_report_summary_gift_count_cast.sql` (summary gift_count bigint cast), `scripts/145_donor_giving_report_email_search.sql` (search by donor/contact email), and `scripts/146_donor_giving_report_min_total_given.sql` (minimum total given filter).

**Receipts tab merged (June 2026):** Reports **Receipts** (`/donations/reports/receipts`) combines receipt summary metrics + year-end giving statements table. Per-donor **⋯** menu: View statement, Download PDF, Send statement email. `/donations/reports/tax-receipts` redirects to Receipts. Per-payment receipt actions remain on Payments (`PaymentReceiptActions`).

**Tax Receipts duplicate donor rows (June 2026):** `donation_donor_tax_year_totals` now groups by `donor_id` only (not `sender_name`). App merges RPC rows defensively in `mergeDonorTaxYearTotals`. Apply: `scripts/126_donation_tax_year_totals_group_by_donor.sql` (or re-run updated `125` on fresh installs).

**Pledges summary cards (June 2026):** Pledges page stat cards match Donations Overview styling (colored left border, rounded icon badges). File: `app/(dashboard)/donations/(operations)/pledges/page.tsx`.

**Donation attribution fields (June 2026):** Add Pledge / Record Payment forms pick **Fund** first (enabled); **Category** auto-fills from the fund and is read-only when funds exist. Manage categories and funds under **Donations → Settings → Categories** (`donation_categories`, `donation_subcategories`). File: `components/donations/donation-attribution-fields.tsx`, `app/(dashboard)/donations/settings/page.tsx`.

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

* **Quick Create** (`/programs/create`) — basics only; redirects to edit after save
* **Edit Program** (`/programs/[id]/edit`) — tabbed full setup (Basics, Enrollment, Registration, Pricing, Sessions, Financial Assistance)
* Shared section components in `components/programs/edit/`
* `saveEditProgram` wrapper for edit save (returns errors instead of throwing)
* Legacy Billing / Program Fees cards removed from edit form; fee plans are SSOT on Pricing tab
* Capacity group gender/grade rules (Male/Female parallel pools)

Quick Create collects: name, type, department, description, dates, eligibility, capacity, visibility, draft/active.

Edit Program completes: registration options, fee plans, sessions, waitlist, financial assistance.

---

## Programs

Completed:

* Program CRUD
* Departments
* Eligibility fields (min/max age, grade levels, gender)
* Registration types (Edit Program → Registration tab)
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
* Filters
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

* Tabs reduced to: Overview, Employees, Departments, Positions
* Removed: Time Off, Work Schedule, Notifications, Teams, Applications (as employee sub-tabs)
* Removed QuickBooks payroll/scheduling note from copy
* Employment applications linked from Employees header via `ModuleApplicationsLink`

Redirects:

* `/hr/time-off` → `/hr/employees?tab=overview`
* Old settings tab URLs for departments/positions → `/hr/employees?tab=...`

---

## Child Care

Status: Complete (data wiring)

Route: `/hr/childcare`

Completed:

* Moved under People Management at `/hr/childcare`
* Removed mock provider array
* Providers loaded from approved `childcare_provider` applications
* Summary stat cards preserved (blue/green/purple/amber color scheme)
* Provider detail dialog shows real `form_data` from applications
* Empty states for no providers and no event history
* Review Applications / Add Provider flows link to Applications Submissions tab

Pending:

* Event participation tracking (Total Hours, Events Worked, History tab)

Key files:

* `lib/hr/childcare-provider-actions.ts`
* `components/hr/hr-childcare-panel.tsx`

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

Status: Active Development

Route: `/people-management/applications`

Completed:

* Three top-level tabs: **Overview**, **Submissions**, **Templates**
* Overview: stat cards, status shortcuts, per-type counts; clicks navigate to Submissions with filters
* Submissions: status tabs, search, type/status filters, applications table
* Templates: cards per PM application type with scaffold for future form builder
* Module shortcut links (Child Care, Employees, etc.) open Submissions tab with type filter
* `PEOPLE_MANAGEMENT_APPLICATIONS_HUB_TYPES` excludes employment from default hub view

URL behavior:

* `/people-management/applications` → Overview
* `?tab=submissions` → Submissions
* `?tab=templates` → Templates
* `?application_type=` or `?status=` → Submissions (auto)

Pending:

* Template form builder (Configure Fields)
* Custom org-defined application types in UI

Key files:

* `components/applications/people-management-applications-client.tsx`
* `components/applications/application-templates-panel.tsx`

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

* `app/(dashboard)/donations/pledges/page.tsx` — pledges CRUD + record payment on canonical tables only
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
| Staff pledge create/edit | `app/(dashboard)/donations/pledges/page.tsx` | Contact picker searches all contacts; full FK pickers; edit pledge supports **Assigned to** reassignment (person/org/group) via `updatePledgeAction` |
| Staff pledge payment | `app/(dashboard)/donations/pledges/page.tsx` | Copies pledge FKs onto payment |
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

Imported CSV payments (`source_type = import`) cannot receive in-app Stripe refunds even if the method column says `stripe`; staff refund externally and **Record Refund** in the app.

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
* `/donations/pledges` — server-paginated table; filters: status, campaign, minimum pledged amount; pledge summary cards reflect the same filters; donor name opens contact profile in a modal (`ContactProfileDialog`)
* `/donations/reports/donors` — `DonorsReportPanel` via `donation_donor_giving_report` RPC: period (lifetime / calendar year / custom), **column header filters** (Donor, Email, Phone, Total Given min, Last Gift, Pledge), email and phone columns, Pledge status (Open / Partial / Fulfilled) and Outstanding Balance columns, CSV + PDF export. Last Gift filter options: all, gift within 12 months, no gift in 12+/24+ months, never gave. Apply migrations `127`–`146`, **`150`**, **`151`**, **`152`**, **`153`** (last-gift column filter replaces toolbar lapsed-only checkbox).
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

* Sidebar: **Overview**, **Campaigns**, **Reports**, **Settings** (`components/layout/sidebar.tsx`)
* **Reports** — tab bar (`components/donations/donation-reports-nav.tsx`):
  * **One-Time Donations** — `/donations/reports/one-time` (summary metric cards + server-paginated payments table: Date, **Donor** (column filter by name), Amount, Method, **Status** (column filter: Succeeded / Failed / Refunded / Partially Refunded; colored badges), **Actions** blue ⋮ menu: Refund, Link to Pledge, Download Receipt, Email Receipt to Donor)
  * **Recurring Donations** — `/donations/reports/recurring`
  * **Pledges** — `/donations/reports/pledges` (pledge table with column-header filters on Donor Name, Status, and Campaign; collection queue; add/edit pledge dialogs)
  * **Donors** — `/donations/reports/donors` (**Individual Giving** or **Household Giving** toggle; household aggregates active member contact gifts)
  * **Import** — `/donations/reports/import` (Upload + History; `donations.manage`)
  * **Match Payments** — `/donations/reports/match` (manage permission; operational health panel; KPI cards for **Needs match**, **May link to pledge**, **Unresolved**, **Action queue amount**; default filter **Needs match**)
  * **Receipts** — `/donations/reports/receipts`
* **Campaigns** — `/donations/campaigns` (org-wide pledge summary cards + campaign list with add/edit/delete); campaign detail at `/donations/campaigns/[id]` with **Add Pledge** and outstanding pledges table. Pledge collection reminders at `/donations/reports/pledges#collection-queue`.
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
| `/donations/campaigns` | Campaigns Overview — org-wide pledge summary cards; fundraising campaigns table (most recent first) |
| `/donations/campaigns/[id]` | Campaign detail — source breakdown + donor metrics (left), goal gauge (right) |
| `/donations` | Donations executive dashboard — KPI cards, action required, active campaigns snapshot, recent activity, quick actions |
| `/donations/settings` | Categories, **Funds** (subcategories under categories), Online Payments (Stripe Connect), receipt and pledge reminder settings. Campaign CRUD is under **Campaigns → Overview**. Org billing cards: **Billing** (`/billing`). |

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
| `/donations/settings` | General tab — org legal/address/EIN; Receipts tab — full receipt config |
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
| `/donations/pledges` | Pledge list (filters: campaign, status, min amount), add/edit/pay, last reminder/contacted columns, inline reminder actions, detail dialog |
| `/donations/collect` | Redirects to `/donations/pledges#collection-queue` |
| `/donations/donors/*/[id]` | Redirects to contact profile Financial tab when linked |
| `/contacts/[id]?tab=financial` | Pledges (with Remind / Mark Contacted), reminder history, donation history |
| `/donations/reports/collection` | Redirects to `/donations/pledges#collection-queue` |

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
| `/donations/reports/recurring` | Full plan table (donor, category/fund, frequency, plan start/end, total payments, amount, payments made, status, next payment); MRR/ARR metrics; create plan; record payment |
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
| **S-04A/B** | Unified **Customer** role (`customer`) replaces `program_participant`, `event_attendee`, `venue_rental_customer`; derivation in `computeDerivedAffiliations` + RPC (migration `137_customer_role_merge.sql`) |
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

Migration **`137_customer_role_merge.sql`** backfills legacy `program_participant`, `event_attendee`, and `venue_rental_customer` rows into `customer` and merges org auto-sync settings.

### Module write paths

| Module | Identity helper | Affiliation trigger | Key files |
|--------|-----------------|---------------------|-----------|
| Stripe donations | Payment/donor metadata | After payment/plan insert (webhook) | `lib/donations/stripe/processor-payment.ts`, `processor-subscription.ts` |
| Portal/staff donations | Existing donor/contact | After payment insert (not pledge-only) | `app/(customer)/customer/donation/page.tsx`, `app/(dashboard)/donations/(operations)/pledges/page.tsx` |
| Ticketing | `findOrCreateContact` | Order reaches `completed` | `lib/tickets/ticket-order-actions.ts` |
| Programs | `ensureContactForPerson` / `resolveParticipantContactIdForRegistration` | Enrollment created (not waitlist-only); `promote_waitlist` | `lib/programs/program-registration-actions.ts`, `program-enrollment-actions.ts`, `program-lifecycle-actions.ts` |
| Volunteers | Reuse canonical `contact_id` | Volunteer roster row created | `lib/volunteers/volunteer-actions.ts` |

### Key files

| File | Purpose |
|------|---------|
| `lib/contacts/contact-affiliation-sync.ts` | `computeDerivedAffiliations` (diagnostics), `syncContactAffiliations` → RPC, webhook helpers |
| `lib/contacts/contact-affiliation-rules.ts` | Terminal enrollment statuses, sticky/removable role policy |
| `lib/contacts/contact-actions.ts` | `findOrCreateContact`, `ensureContactForPerson` → gated RPCs |
| `lib/tickets/ticket-order-actions.ts` | FOC + `contact_id`; completion sync |
| `lib/programs/person-actions.ts` | `ensureParticipantContactForPerson`, `resolveParticipantContactIdForRegistration` |
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
