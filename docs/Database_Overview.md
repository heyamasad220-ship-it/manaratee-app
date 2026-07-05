Add project documentation
# DATABASE_OVERVIEW.md

## Database Summary

This project uses Supabase/PostgreSQL with a multi-tenant structure.

Most tenant-owned records connect to:

```text
organizations.id
```

The main tenant column is usually:

```text
organization_id
```

Important rule:

Every organization-specific table should either include `organization_id` directly or connect through another table that does.

---

## Core Platform Tables

* organizations
* organization_members
* organization_roles
* role_permissions
* organization_audit_logs (migration `142` — append-only financial + permission audit trail)
* profiles
* customer_profiles
* platform_admins
* platform_settings
* organization_payment_methods (migration `121` — platform subscription cards on file)
* organization_billing_invoices (migration `121` — platform subscription invoice history)

Key relationships:

```text
organization_members.organization_id → organizations.id
organization_members.role_id → organization_roles.id
organization_roles.organization_id → organizations.id
role_permissions.organization_id → organizations.id
role_permissions.role_id → organization_roles.id
organization_audit_logs.organization_id → organizations.id
customer_profiles.organization_id → organizations.id
```

---

## Subscription, Plans, and Modules

* plans
* plan_limits
* plan_modules
* modules
* organization_modules
* my_sidebar_modules
* organization_sidebar_modules
* subscriptions

Key relationships:

```text
organizations.plan_id → plans.id
plan_limits.plan_id → plans.id
plan_modules.plan_id → plans.id
plan_modules.module_id → modules.id
organization_modules.organization_id → organizations.id
organization_modules.module_id → modules.id
```

**Organization subscription terms (migration `123`):** on `organizations` — `subscription_start_date`, `complimentary_months` (e.g. 3 for three months free), `first_year_special_monthly_rate` (optional promotional rate for year one; standard `plans.monthly_price` after). Platform admin: `PATCH /api/platform/organizations/[organizationId]/billing-terms`. Display: `lib/organizations/organization-subscription-terms.ts`.

**Stripe Connect Express for donations (migration `139_stripe_connect_donations.sql`):** `organizations.stripe_connect_account_id`, `stripe_connect_charges_enabled`, `stripe_connect_payouts_enabled`, `stripe_connect_details_submitted`, `stripe_connect_onboarded_at`. Donation Checkout runs on the connected account; platform `STRIPE_SECRET_KEY` is for Connect only. Separate from `organizations.stripe_customer_id` (future platform subscription billing, migration `121`).

---

## CRM / Contacts / People

* people
* contacts
* contact_notes
* contact_roles
* contact_group_members
* contact_payment_methods
* families
* family_members
* organization_affiliation_settings
* person_relationships
* person_tags
* discount_tags

Key relationships:

```text
people.organization_id → organizations.id
contacts.organization_id → organizations.id
contacts.person_id → people.id
contact_notes.contact_id → contacts.id
contact_notes.organization_id → organizations.id
contact_roles.contact_id → contacts.id
contact_roles.organization_id → organizations.id
contact_group_members.group_contact_id → contacts.id
contact_group_members.member_contact_id → contacts.id
contact_group_members.organization_id → organizations.id
contact_payment_methods.contact_id → contacts.id
contact_payment_methods.organization_id → organizations.id
organization_affiliation_settings.organization_id → organizations.id
person_relationships.organization_id → organizations.id
person_relationships.person_id → people.id
person_relationships.related_person_id → people.id
families.organization_id → organizations.id
families.primary_contact_id → contacts.id
family_members.family_id → families.id
family_members.contact_id → contacts.id
family_members.organization_id → organizations.id
person_tags.organization_id → organizations.id
person_tags.tag_id → discount_tags.id
discount_tags.organization_id → organizations.id
```

**Customer role (migration `137_customer_role_merge.sql`):** Unified `customer` role replaces legacy `program_participant`, `event_attendee`, and `venue_rental_customer`. Derivation: non-terminal program enrollment, completed ticket order, or venue rental with `billing_contact_id`. Sticky once earned. Org auto-sync settings for the old roles migrate to `customer`. Run after `136_payment_attributed_group.sql`. If `sync_contact_affiliations` fails with missing `billing_contact_id`, apply **`147_venue_rentals_billing_contact_id.sql`** (adds column from `054` when skipped).

**Participation roles (superseded by `137`):** Migration `101_contact_participation_roles.sql` originally added separate participation roles; `137` consolidates them into `customer`.

**Contact record types (migration `132_contact_type_group.sql`):** `contacts.contact_type` CHECK — `individual` (person), `organization` (external entity), `group` (internal collective: halaqa, committee) with optional `primary_contact_name`. Group donor rows use `donors.donor_type = 'organization'`. Patch `sync_contact_affiliations` for groups: migration `133_sync_contact_affiliations_group.sql`.

**Group membership (migration `135_contact_group_members.sql`):** `contact_group_members` links individuals to group contacts (`group_contact_id`, `member_contact_id`, `status`). Group gifts on group Financial tab; member gifts attributed via `payments.attributed_group_contact_id` (migration **`136_payment_attributed_group.sql`**) roll up for group competition; auto-membership when a group is selected on a gift. UI: group **Overview → Group Members**; person **Overview → Groups**; optional group picker on **Record Payment**. Server: `lib/contacts/group-members-load-action.ts`, `lib/contacts/group-membership-data.ts`, `lib/contacts/group-member-actions.ts`, `lib/contacts/group-giving-actions.ts`.

**Family households (migration `148_families_and_family_members.sql`):** `families` + `family_members` are relationship containers only — **no family FK on payments**. Active members (`end_date IS NULL`) roll up to household totals on `/contacts/families` and `/contacts/families/[id]`. Backfilled from `person_relationships`; staff add/remove on contact profile syncs membership via `lib/contacts/family-sync.ts`. Household donor report RPC: **`149_household_giving_report.sql`**. `person_relationships` remains for portal/program family checks until fully migrated.

**Contact payment methods (migration `138_contact_payment_methods.sql`):** `contact_payment_methods` stores cards on file for a contact (brand, last4, expiry, cardholder, default flag). **Staff** add cards from contact profile **Financial → Payment Methods**; **contacts** add cards from the customer portal **Profile → Payment Methods**. Both paths use the same `contact_payment_methods` rows (full PAN and CVV collected at save only; only last 4 + MM/YYYY expiration persist). Server: `lib/contacts/contact-payment-method-actions.ts`, `lib/contacts/contact-payment-method-validation.ts`, `components/contacts/contact-payment-methods-panel.tsx`. Run after `137_customer_role_merge.sql`.

**Phase 1 identity linkage (June 2026):**

| Table / column | Purpose |
|----------------|---------|
| `contacts.person_id` | Canonical person ↔ contact link (family, participants) |
| `program_enrollments.participant_contact_id` | Program participant identity + **Customer** derivation |
| `program_enrollments.registrant_contact_id` | Guardian/registrant (preserved separately from participant) |
| `program_enrollments.payer_contact_id` | Payer (preserved separately from participant) |
| `ticket_orders.contact_id` | Ticketing purchaser identity + **Customer** derivation |
| `venue_rentals.billing_contact_id` | Venue rental billing contact + **Customer** derivation |
| `donors.contact_id` | Donor extension (pledges/payments FK); `donor` affiliation requires a payment |
| `volunteers.contact_id` | Volunteer roster + `volunteer` derivation |

Affiliation writes use `sync_contact_affiliations` RPC via `syncContactAffiliations` / `handleDonationAffiliationSync` — not manual `contact_roles` inserts on activity write paths. Profile open may call `refreshContactAffiliations` for reconciliation only; Phase 1 modules do not depend on it.

**RLS hardening (migrations `102`–`111`, June 2026):**

| Helper / RPC | Purpose |
|--------------|---------|
| `auth_user_can_view_contacts` | Staff CRM read (`contacts.view` or owner) |
| `auth_user_can_manage_contacts` | Staff CRM write (`contacts.manage` or owner) |
| `auth_user_can_view_family_contact` | Customer SELECT on linked family contacts |
| `auth_user_may_sync_derived_affiliations` | Gate for `sync_contact_affiliations` (M6b: + events/ticketing/membership) |
| `auth_user_may_create_contact_via_module` | Gate for `find_or_create_contact_for_org` (M6b: + events/ticketing/membership.manage) |
| `auth_user_may_ensure_contact_for_person` | Gate for `ensure_contact_for_person` |
| `sync_contact_affiliations` | SECURITY DEFINER derive + reconcile `contact_roles` + donor bridge; respects `organization_affiliation_settings` |

Staff policies on `contacts`, `contact_roles`, `contact_notes` require `contacts.view` / `contacts.manage`. Customer self-contact UPDATE/SELECT uses `auth_user_contact_ids()`. Migration `111` drops legacy open policies after G6 validation.

Run order: `102` → … → `110` → `112` → (G6 GREEN) → `111` → `114` (donor affiliation requires payment) → `115` (org affiliation settings).

Validate:

```bash
npm run validate:contacts-g6
npm run validate:contacts-security -- --post-m4   # after 111
```

---

## Programs Module

* programs
* departments
* age_groups
* program_sessions
* program_schedule_items
* program_lunch_options
* program_fee_options
* program_discounts
* program_expenses
* program_extended_care
* program_payment_plans

Key relationships:

```text
program_sessions.program_id → programs.id
program_sessions.organization_id → organizations.id
program_schedule_items.program_id → programs.id
program_lunch_options.organization_id → organizations.id
program_fee_options.program_id → programs.id
program_fee_options.organization_id → organizations.id
program_discounts.program_id → programs.id
program_discounts.discount_tag_id → discount_tags.id
program_discounts.organization_id → organizations.id
program_expenses.program_id → programs.id
program_expenses.department_id → departments.id
program_extended_care.enrollment_id → program_enrollments.id
program_payment_plans.enrollment_id → program_enrollments.id
```

---

## Registrations and Orders

* registration_carts
* registration_cart_items
* registration_cart_item_fees
* registration_orders
* program_enrollments
* program_enrollment_sessions
* program_waitlist

Key relationships:

```text
registration_carts.organization_id → organizations.id
registration_cart_items.cart_id → registration_carts.id
registration_cart_items.organization_id → organizations.id
registration_cart_items.program_id → programs.id
registration_cart_item_fees.cart_item_id → registration_cart_items.id
registration_cart_item_fees.fee_option_id → program_fee_options.id
registration_orders.organization_id → organizations.id
registration_orders.cart_id → registration_carts.id

program_enrollments.program_id → programs.id
program_enrollments.session_id → program_sessions.id
program_enrollments.lunch_option_id → program_lunch_options.id
program_enrollments.department_id → departments.id
program_enrollments.child_person_id → people.id
program_enrollments.participant_contact_id → contacts.id
program_enrollments.registrant_contact_id → contacts.id
program_enrollments.payer_contact_id → contacts.id
program_enrollments.cart_item_id → registration_cart_items.id
program_enrollments.order_id → registration_orders.id

program_enrollment_sessions.enrollment_id → program_enrollments.id
program_enrollment_sessions.session_id → program_sessions.id
program_enrollment_sessions.program_id → programs.id
program_enrollment_sessions.organization_id → organizations.id

program_waitlist.program_id → programs.id
program_waitlist.child_person_id → people.id
program_waitlist.lunch_option_id → program_lunch_options.id
```

---

## Financial Assistance

* program_financial_assistance
* program_financial_assistance_documents
* program_financial_assistance_status_history

Key relationships:

```text
program_financial_assistance.enrollment_id → program_enrollments.id
program_financial_assistance_documents.financial_assistance_id → program_financial_assistance.id
program_financial_assistance_status_history.financial_assistance_id → program_financial_assistance.id
```

---

## Donations, Pledges, and Payments

**Canonical ledger (active writes, June 2026 stabilization):** `payments`, `pledges`, `donors` (+ `contacts` for identity). Staff and customer portal now insert only into these tables.

**Legacy table cleanup (migrations `140`–`141`, June 2026):** Dropped superseded tables after JSON export via `scripts/cleanup-legacy-donation-staging-tables.mjs`:

* Tier 1 (`140`): `donation_payments`, `donation_pledges`, `donation_amount_options`, `donor_import_*`, `contact_import_staging`, `organization_settings`
* Tier 2 (`141`): `payment_import_rows`, `backup_*_2026_05_24` snapshot tables

Import CSV flow writes directly to `payments` + `payment_import_batches` (no row staging table).

**Dev seed:** `scripts/seed-donations-dev.mjs` inserts test data into canonical tables only (see `docs/Features.md` Donations section). Does not use dropped legacy tables.

**`payments.source` constraint (patch `131_payments_source_square.sql`):** lowercase channel keys (`cash`, `check`, **`square`**, `zelle`, `venmo`, `paypal`, `stripe`, `import`, `manual`). **`square`** = Square terminal batch deposit on a campaign (no donor/contact). Campaign overview classifies via memo `|batch|square|` or `source = square`. Customer portal normalizes configured payment method display names via `lib/donations/payment-source-channel.ts` before insert.

* campaigns (`goal_amount`, `description`, `start_date`, `end_date`, `status`, `code`, `overview_metric_keys` — migration `134`)
* donors
* donation_categories
* donation_subcategories
* pledges
* payments
* payment_methods
* donor_summary_view
* pledge_status_view
* donation_settings (receipt + pledge reminder config per org — migrations `090`, `091`)
* donation_receipts (payment receipts + annual statements — canonical payments only)
* pledge_reminders (pledge collection reminder activity log — migration `091`)
* recurring_donation_plans (ongoing giving schedules — migration `092`; not pledges; `daily` frequency added in migration `155`; `total_payments` / `payments_made` added in migration `156`)
* donation_checkout_sessions (in-flight Stripe Checkout — migration `093`; not a payment ledger)
* payment_processor_events (Stripe webhook audit + idempotency — migration `093`)
* transactional_email_log (operational donation email audit — migration `094`)

**Stripe processor columns on `payments` (migration `093`):** `stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_charge_id`, `refunded_amount`. Unique partial index on `stripe_payment_intent_id`. Online card donations are inserted only via webhook (`source_type = processor`, `source = stripe`).

**Stripe recurring billing (migration `100_stripe_recurring_donations.sql`):** `payments.stripe_invoice_id` (unique partial index). `recurring_donation_plans.stripe_customer_id`. Plan statuses include `pending_setup` and `past_due`. Recurring charges insert `payments` via `invoice.paid` webhook with `recurring_donation_plan_id` set; `pledge_id` remains null.

**Square plan metadata (migration `156_recurring_plan_payment_counts.sql`):** `recurring_donation_plans.total_payments` (expected count from processor export) and `payments_made` (completed count). Populated by `scripts/import-madina-recurring-plans.mjs` from Square recurring plans CSV.

**Transactional email (migration `094`):** `transactional_email_log` tracks receipt, year-end statement, and pledge reminder sends. `donation_receipts.status` includes `failed`. `donation_settings.year_end_statement_email_template` for statement email body.

**RLS hardening (migration `095_donations_rls_hardening.sql`):** Row-level security on canonical ledger tables (`payments`, `pledges`, `donors`) plus donation operational tables (`recurring_donation_plans`, `donation_receipts`, `pledge_reminders`, `donation_checkout_sessions`, `payment_processor_events`, `donation_settings`). Staff policies require `donations.view` / `donations.manage` via `auth_user_can_view_donations` / `auth_user_can_manage_donations` (owner bypass included). Customers may SELECT/INSERT own rows through `auth_user_contact_ids` / `auth_user_donor_ids`. Service role bypass unchanged for webhooks and checkout creation.

Run after `094_transactional_email.sql`:

```bash
npx supabase db query --linked -f scripts/095_donations_rls_hardening.sql
npm run validate:donations-security
```

**Performance indexes (migration `096_donations_performance_indexes.sql`):** org-scoped indexes on canonical ledger + donation operational tables. See Priority 15 in `docs/Features.md`.

**Analytical views (migration `097_donations_views.sql`):** `pledge_status_view`, `donor_summary_view` with `security_invoker = true` (RLS on underlying tables applies). `donor_summary_view` includes `contact_id` (patch `116_donor_summary_view_contact_id.sql`) for payment contact matching.

**Pilot blocker view fixes (migration `119_donations_pilot_blocker_views.sql`):** `pledge_status_view` excludes voided payments from pledge balances; cancelled pledges expose `calculated_status = cancelled` and `balance_remaining = 0`. `donor_summary_view` excludes voided from `total_donations`.

**Outstanding pledge flag (migration `124_donor_summary_outstanding_pledge.sql`):** `donor_summary_view.has_open_pledge` is true only when `pledge_status_view.balance_remaining > 0`. Backfills `pledges.status` from payment totals; trigger `sync_pledge_status_after_payment_change` keeps status in sync on payment changes.

**Donor giving report RPCs (migration `127_donor_giving_report.sql`, patch `128_donor_giving_report_contact_id.sql`, fix `143_donor_giving_report_type_fix.sql`, patch `144_donor_giving_report_summary_gift_count_cast.sql`, patch `145_donor_giving_report_email_search.sql`, patch `146_donor_giving_report_min_total_given.sql`, patch `150_donor_giving_report_email_phone.sql`, patch `151_donor_giving_report_pledge_status.sql`, patch `152_donor_giving_report_column_filters.sql`, patch `153_donor_giving_report_last_gift_filter.sql`):** `donation_donor_giving_report` (paginated rows with optional payment date range, column filters for donor name / email / phone / pledge status / **last gift** (`p_last_gift_filter`: all, active_12m, lapsed_12m, lapsed_24m, never), **minimum total given**, outstanding pledge balance, **contact_id**, net payment amounts) and `donation_donor_giving_report_summary` (aggregate donor count / total given / gift count for the same filters). Migration **143** casts `payment_date` to `date` and aligns totals with `payment_net_amount`. Migration **144** casts `SUM(donation_count)` to `bigint`. Migration **145** adds email search. Migration **146** adds `p_min_total_given`. Migration **153** replaces `p_lapsed_only` with `p_last_gift_filter`. Used by Reports → Donors (`/donations/reports/donors`).

**People donor filter (migration `129_donor_giving_contact_search.sql`, grants `130_donor_giving_rpc_grants.sql`):** `search_donor_giving_contact_ids` — contacts with at least one non-voided payment (direct or via `donors.contact_id`). Run **`130`** so authenticated app users can call the RPC (without it, People falls back to ~95 affiliation tags). **Link orphan donors to People:** `node scripts/link-orphan-donors-to-contacts.mjs --execute` then `node scripts/sync-donor-affiliations.mjs --execute`.

**Payment refunds / net totals (migration `125_payment_refunds_net_amounts.sql`):** `payment_net_amount(amount, refunded_amount)` helper. Views and dashboard RPCs use net amounts. `refresh_pledge_status` and payment trigger include `refunded_amount`. Status values `partially_refunded` and `refunded` on `payments`.

**Import columns on `payments` (migration `117`):** `import_email`, `import_phone`, `import_batch_id` — CSV match hints and batch audit link. Legacy `payment_import_rows` staging removed in migration `141`.

**Chunked CSV import (migration `118`):** `payment_import_batches.import_seen_keys` holds duplicate keys while a file imports in 100-row server-action chunks; cleared when import completes.


**Dashboard RPCs (migration `098_donations_dashboard_rpcs.sql`):** `donation_org_payment_summary`, `donation_org_pledge_summary`, `donation_monthly_payment_totals`, `donation_payment_source_totals`. Payment sum RPCs updated by `120_donations_pilot_blocker_totals.sql` to exclude voided (aligned with Reports Overview).

**Money received (post-125):** `SUM(payment_net_amount(amount, refunded_amount))` where `LOWER(status) <> 'voided'`. Fully refunded payments contribute $0.

Key relationships:

```text
campaigns.organization_id → organizations.id
donors.organization_id → organizations.id
donors.contact_id → contacts.id

donation_subcategories.category_id → donation_categories.id

pledges.organization_id → organizations.id
pledges.donor_id → donors.id
pledges.campaign_id → campaigns.id
pledges.category_id → donation_categories.id
pledges.subcategory_id → donation_subcategories.id

payments.organization_id → organizations.id
payments.donor_id → donors.id
payments.contact_id → contacts.id
payments.pledge_id → pledges.id
payments.campaign_id → campaigns.id
payments.category_id → donation_categories.id
payments.subcategory_id → donation_subcategories.id
payments.payment_method_id → payment_methods.id

donation_settings.organization_id → organizations.id
donation_receipts.organization_id → organizations.id
donation_receipts.payment_id → payments.id
donation_receipts.donor_id → donors.id
donation_receipts.contact_id → contacts.id
donation_receipts.sent_by → auth.users.id

pledge_reminders.organization_id → organizations.id
pledge_reminders.pledge_id → pledges.id
pledge_reminders.donor_id → donors.id
pledge_reminders.contact_id → contacts.id
pledge_reminders.sent_by → auth.users.id

recurring_donation_plans.organization_id → organizations.id
recurring_donation_plans.donor_id → donors.id
recurring_donation_plans.contact_id → contacts.id
recurring_donation_plans.campaign_id → campaigns.id
recurring_donation_plans.category_id → donation_categories.id
recurring_donation_plans.subcategory_id → donation_subcategories.id
recurring_donation_plans.payment_method_id → payment_methods.id
payments.recurring_donation_plan_id → recurring_donation_plans.id

donation_checkout_sessions.organization_id → organizations.id
donation_checkout_sessions.donor_id → donors.id
donation_checkout_sessions.contact_id → contacts.id
donation_checkout_sessions.campaign_id → campaigns.id
donation_checkout_sessions.category_id → donation_categories.id
donation_checkout_sessions.subcategory_id → donation_subcategories.id
donation_checkout_sessions.payment_id → payments.id

payment_processor_events.organization_id → organizations.id
payment_processor_events.payment_id → payments.id
payment_processor_events.checkout_session_id → donation_checkout_sessions.id

transactional_email_log.organization_id → organizations.id
```

---

## Applications

Status: Active Development

Tables:

* application_type_definitions (global registry of application types)
* applications (tenant submissions)
* application_history (audit trail)
* application_documents (uploaded files)

Migrations:

* `scripts/012_applications.sql` — core Applications engine
* `scripts/013_rename_hr_module.sql` — renames HR module display name to People Management

Key relationships:

```text
applications.organization_id → organizations.id
applications.application_type → application_type_definitions.id
applications.contact_id → contacts.id
application_history.application_id → applications.id
application_history.organization_id → organizations.id
application_documents.application_id → applications.id
application_documents.organization_id → organizations.id
```

Seeded application types:

* volunteer (hr)
* employment (hr)
* committee_member (hr)
* childcare_provider (hr)
* vendor (vendor_hub)
* financial_aid (programs)

Status values:

draft, submitted, pending_review, approved, rejected, withdrawn

Key lib paths:

* `lib/applications/application-actions.ts`
* `lib/applications/application-types.ts`
* `lib/applications/application-routes.ts`
* `lib/applications/application-status-tabs.ts`

---

## Staff

* staff
* staff_assignments
* staff_background_checks
* staff_compliance
* staff_departments
* staff_documents

Key relationships:

```text
staff_assignments.staff_id → staff.id
staff_assignments.program_id → programs.id
staff_background_checks.staff_id → staff.id
staff_compliance.staff_id → staff.id
```

---

## Scheduling and Venues

* schedule_categories
* schedule_sessions
* schedule_activities
* venues
* venue_bookings

Key relationships:

```text
schedule_activities.age_group_id → age_groups.id
schedule_activities.category_id → schedule_categories.id
schedule_activities.program_id → programs.id
schedule_activities.session_id → schedule_sessions.id
```

---

## Vendor Hub

* vendors
* vendor_categories
* vendor_hub_events
* vendor_hub_vendors
* vendor_hub_booths
* vendor_hub_booth_types
* vendor_hub_booth_assignments
* vendor_hub_payments

No foreign key relationships were included in the current relationship export for these tables.

These should be reviewed later.

---

## Import and Backup Tables

**Cleanup (June 2026):** `payment_import_rows` and `backup_*_2026_05_24` tables dropped after export (`scripts/cleanup-legacy-donation-staging-tables.mjs`, migrations `140`–`141`).

Active import metadata:

* `payment_import_batches` — CSV upload history (linked from `payments.import_batch_id`)

Archived exports live under `scripts/backups/legacy-cleanup/` when cleanup script is run.

---

## Tables Needing Later Review

These tables either have no visible relationships in the current export or need more context:

* my_sidebar_modules
* organization_sidebar_modules
* organization_users
* subscriptions
* staff_departments
* staff_documents
* vendor hub tables
* venue_bookings
* venues

---

## AI Instructions for Database Work

When working with this database:

1. Always check existing tables before creating new ones.
2. Do not create duplicate systems if a table already exists.
3. Preserve `organization_id` tenant isolation.
4. Do not remove foreign keys without review.
5. Do not modify backup tables unless explicitly requested.
6. Be careful with roles, permissions, registrations, payments, and financial assistance.
7. Prefer small migrations over large schema rewrites.
