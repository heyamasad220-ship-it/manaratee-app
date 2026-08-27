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
* organization_members — `role` is the platform access tier (`super_admin`, `admin`, `viewer`, …). `platform_support_access` (SQL **`086`**, **`272`**) marks platform-admin support rows so they are not treated as org Super Admins. `organization_users` is a convenience view over members (excludes support rows after **`272`**).
* organization_roles — every org gets **Super Admin** and **Admin** system roles (`is_system_role`); SQL **`271`** backfills existing orgs and lets Super Admin / Admin / platform admins insert roles (fixes RLS on Add Role).
* role_permissions — keys include `events.view`, `events.checkin` (SQL **`257`**, door staff scan/check-in), `events.manage`, plus ticketing/program counterparts. `events.manage` still implies check-in in the app.
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
* modules — product SKU monthly price is `monthly_price_cents` (SQL **`274`**). Included capabilities are `included_capability_slugs` (SQL **`275`**). Legacy dollar columns (`price_monthly`, `monthly_price`) are not guaranteed and must not be selected from the app.
* organization_modules — product SKUs in `lib/modules/module-catalog.ts` (Workforce/Finance are not catalog modules; SQL **`273`**)
* module_discount_rules — percent off by selected product-module count (SQL **`274`**)
* organization_subscriptions — current billed snapshot in integer cents (SQL **`274`**); historical invoices stay on organization_billing_invoices
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

**Organization subscription terms (migration `123`):** on `organizations` — `subscription_start_date`, `complimentary_months` (e.g. 3 for three months free), `first_year_special_monthly_rate` (optional promotional rate for year one). Standard monthly amount now comes from `organization_subscriptions.billed_monthly_cents` (SQL **`274`**), not `plans.monthly_price`. Platform admin: `PATCH /api/platform/organizations/[organizationId]/billing-terms`. Display: `lib/organizations/organization-subscription-terms.ts`.

**Program mode packaging (migration `246`):** `organizations.program_kinds` text NOT NULL DEFAULT `'both'` — `academic` | `seasonal` | `both`. Controls which program create modes the tenant may use. App helpers: `lib/programs/organization-program-kinds.ts`, `lib/programs/program-kind-policy.ts`. UI: Platform Admin → Organizations → Modules → Programs (Academic and Seasonal toggles); tenant Billing (super-admin dropdown). API: `PATCH /api/platform/organizations/[id]/program-kinds`.

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
* organization_employee_benefits

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
organization_employee_benefits.organization_id → organizations.id
organization_employee_benefits.discount_tag_id → discount_tags.id
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

**Employee benefit (migration `184`):** `organization_employee_benefits` defaults to 50% off for active full-time staff on programs + venue rentals (`applies_to_ticketing = false`). Quote engine wraps `compute_program_registration_quote` to apply the benefit when the registrant or participant is active FTE.

**Discount tag auto-apply (migration `202`):** `discount_tags` gains `percent_off`, `auto_apply`, `applies_to_programs`, `applies_to_venue_rentals`, `applies_to_ticketing`. Custom tags (e.g. Top Donor) are assigned on contact Overview; when `auto_apply` is on, checkout uses the best matching tag percent for programs (quote SQL) and venue rentals (pricing suggestion). FTE benefit still wins vs a weaker tag percent. Function: `contact_best_auto_apply_tag_discount`.

**Venue rental discount policies (migration `217`):** `venue_rental_discount_policies` — org catalog of optional fixed/$ or % discounts with `requires_multi_venue` / `min_venues` and optional `discount_tag_id` → `discount_tags`. Applied to space-fee quotes on Payments / Financial (largest matching savings wins).
**Customer role (migration `137_customer_role_merge.sql`, split in `175`, fix `197`):** Migration 137 unified `program_participant`, `event_attendee`, and `venue_rental_customer` into `customer`. **`175_split_customer_programs_affiliation.sql`** restores **`program_participant`** (UI label **Programs**) for enrollments. **`197_fix_sync_affiliations_programs_payer.sql`** repairs `sync_contact_affiliations` (removed invalid `vendors.contact_id`) and grants Programs for **participant, registrant, or payer** (and paid `program_charges`). **`customer`** remains for completed ticket orders and qualifying venue rentals (billing contact) only. Both are sticky once earned. Org auto-sync: Programs → `programs` module; Customer → `event-management` / `ticketing` / `bookings`. If `sync_contact_affiliations` fails with missing `billing_contact_id`, apply **`147_venue_rentals_billing_contact_id.sql`**.

**Participation roles (superseded by `137`):** Migration `101_contact_participation_roles.sql` originally added separate participation roles; `137` consolidates them into `customer`.

**Contact record types (migration `132_contact_type_group.sql`):** `contacts.contact_type` CHECK — `individual` (person), `organization` (external entity), `group` (Fund Development giving collective — department/committee rollup, not a Directory identity) with optional `primary_contact_name`. Group donor rows use `donors.donor_type = 'organization'`. Patch `sync_contact_affiliations` for groups: migration `133_sync_contact_affiliations_group.sql`.

**Giving group category (migration `167_giving_group_category.sql`):** On `contacts` when `contact_type = group`: `giving_group_kind` (`membership_group` | `department` | `group_donation`), optional `linked_hr_team_id` → `hr_teams`, optional `linked_department_id` → `departments`. Drives workspace badge and Events tab (department events; URL `?tab=activity`).

**Staff hourly rate (migration `168_staff_hourly_rate.sql`):** Optional `staff.hourly_rate` numeric for department/employee compensation. Used when adding employees from a department workspace.

**Staff pay basis (migration `169_staff_pay_basis.sql`):** `staff.pay_basis` (`hourly` | `monthly`) and optional `staff.monthly_salary` for fixed monthly compensation.

**Department operating finance (migration `170_department_operating_finance.sql`):** `department_staff_pay_entries` (staff × period hours/amount for a department), `department_babysitting_income_entries` / `department_babysitting_pay_entries` (legacy babysitting ledgers; UI removed — childcare fee income is on Students enrollments; childcare pay is on Payroll). Budget P&L uses student payments + approved/paid payroll (not donations).

**Department hour logs + payroll approval (migration `171_department_staff_hour_logs.sql` + `187_finance_module_and_payroll_paid.sql` + `188_hour_logs_childcare_event.sql`):** `department_staff_hour_logs` (daily hours by staff for a department — childcare providers may log to any department; optional `childcare_event_id` / `source`); pay entries gain `status` (`draft` | `pending` | `approved` | `rejected` | `paid`), `period_start` / `period_end`, submit/approve fields, and Finance `paid_at`. Budget payroll uses **approved** and **paid** periods. Org payroll queue: `/finance/payroll` (legacy `/workforce?tab=payroll` redirects). Finance module home restore: `192_finance_module_sidebar_restore.sql`.

**Custom pay period keys (migration `172_pay_period_custom_key.sql`):** Relaxes `period_key` check so academic-year ranges like `2026-08-17_2026-08-31` are allowed (not only `YYYY-MM`).

**Department budget periods (migration `173_department_budget_periods.sql`):** `department_budget_periods` stores custom start/end date ranges per department (different each year). Budget list aggregates student payments and approved payroll that overlap each range.

**Enrollment uniqueness per offering (migration `174_enrollment_unique_per_offering.sql`):** Active enrollments are unique on `(organization_id, offering_id, participant_contact_id)` (and child_person equivalent), not per program — so one year program can have many course offerings and a student can enroll in multiple courses.

**Youth registration by person (migration `195_register_participant_person.sql`):** `register_for_program` accepts optional `p_participant_person_id`. Minors enroll as people under the parent Contact (`child_person_id` set, `participant_contact_id` null). Helper `is_registrant_related_person` checks `person_relationships`. **`198_people_grade.sql`** adds optional `people.grade` for roster enrichment (upcoming grade bands). **`242_people_participant_details.sql`** adds `people.allergies`, `people.emergency_contact`, `people.photo_consent` (edited from Participant profile / Contact Family; mirrored into enrollment notes).

**Group membership (migration `135_contact_group_members.sql`):** `contact_group_members` links individuals to group contacts (`group_contact_id`, `member_contact_id`, `status`). Group gifts on group Financial tab; member gifts attributed via `payments.attributed_group_contact_id` (migration **`136_payment_attributed_group.sql`**) roll up for group competition; auto-membership when a group is selected on a gift. UI: group **Group Members** on the contact summary; optional group picker on **Record Payment**. Person profiles do not show group badges or assign-to-group actions (July 2026). Contact profile summary combines financial KPIs + activity; personal info is under actions **View Details**. Server: `lib/contacts/group-members-load-action.ts`, `lib/contacts/group-membership-data.ts`, `lib/contacts/group-member-actions.ts`, `lib/contacts/group-giving-actions.ts`.

**Group giving report (migration `166_group_giving_report.sql`):** RPC `donation_group_giving_report` powers **Donations → Reports → Donors → Group Giving**. Returns only groups with at least one non-voided gift in the date range (direct gift on the group contact or attributed member gift). Columns include group/member gift split, combined total, gift count, last gift, and group-contact pledge status.

**Family households (migration `148_families_and_family_members.sql` + `196_family_members_person.sql`):** `families` + `family_members` are household containers — **not** a separate contact type or parallel profile. The **contact** is canonical (phone/email/address, donations, rentals, events). Family is an extension managed on the contact Family card (name, head, members). Members are adults (**contacts**) and minors (**people** only, no CRM profile). `family_members.contact_id` is optional; `person_id` identifies minors. One active household per person; first adult is head/primary (changeable). **UI:** `/directory/families` household directory; `/directory/families/[id]` household detail; legacy `/contacts/families` redirects there. Auto-sync when kids are added under a parent Contact (`syncHouseholdFromParentContact`). Backfill camp parents: `node scripts/sync-summer-camp-households.mjs --execute` after **196**. `person_relationships` remains the Contact profile Family panel source.

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

Affiliation writes use `sync_contact_affiliations` RPC via `syncContactAffiliations` / `handleDonationAffiliationSync` — not manual `contact_roles` inserts on activity write paths. Profile open may call `refreshContactAffiliations` for reconciliation only; Phase 1 modules do not depend on it. **Sponsor** is a manual `contact_roles` value (not derived); run `scripts/269_directory_sponsor_role.sql` to extend the role CHECK.

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

* programs — optional defaults; `capacity` temporarily = sum of limited offerings (S2 sync; catalog may also read offerings live in S6). S4: staff saves no longer write operational eligibility/capacity/`billing_*` as SSOT. **S5:** `program_type` CHECK adult|youth only (`179_drop_program_type_family.sql`; family backfilled to youth). Obsolete eligibility/capacity columns retained pending RPC cutover. **Status (`199`):** `draft` | `active` | `paused` | `closed` | `archived` — prefer **closed** (stays in department workspace) over **archived**.
* program_offerings — S1 attribute columns; S4 registration panel writes here only. **F1 (`180`):** `inherit_dates`, `inherit_eligibility`, `inherit_enrollment` (existing rows overridden/`false`; new offerings default `true`). **F4 (`181`):** `care_enabled`. **Catalog branding (`191`):** `flyer_url`, `background_color` (placeholder when no flyer). **Sort (`243`):** `sort_order` for staff Offerings list drag-and-drop (lower first). Programs may have **zero** offerings; first created offering is `is_default`. Audience adult|youth. Catalog enrollment display uses offering `capacity_mode` / `capacity` (S6). **Session capacity (`244`):** when the offering has weeks/sessions, limited `capacity` is the **per-session** seat limit (not unique offering headcount); `grant_enrollment_session_access` blocks adding to a full week. **Selected-weeks priority (`245`):** `selected_sessions_open` (default true). When false, only full Camp 1 / Camp 2 packages (all weeks in a camp) enroll immediately; partial selected weeks go to waitlist. Staff toggle opens selected weeks and FIFO-promotes waitlist rows that fit. **`245` also patches `promote_waitlist`:** drops early program-level capacity raise (seats checked in `grant_enrollment_session_access`); prefers `program_waitlist.offering_id` when set, else default offering. App should set waitlist `offering_id` on insert when possible. **Status (`283`):** `draft` | `active` | `closed` | `archived` | `cancelled`. **cancelled** = class called off (not enough registrations); hidden from families; staff Cancel offering is blocked while students are enrolled.
* program_staff_assignments — **`278`:** at most one active offering-level `primary_instructor` per offering (`program_staff_assignments_one_offering_primary`; extras deactivated keeping the newest). Unique active row per contact+offering+role remains from **`031`**.
* program_offering_fee_plan_components — **`200`:** `billing_scope` (`individual` \| `family` flat household). Discount rules: `full_payment` rule type added (`200`); early bird / member-staff tag conditions stored in `conditions` JSONB.
* program_offering_registration_questions — **`201`:** custom registration prompts per offering (`yes_no` \| `text` \| `textarea`, required flag, sort order). **`239`:** adds `select` type + `options` jsonb (drop-down choices).
* program_attendance — **F5 (`181`):** per enrollment/day status (`present`/`absent`/`late`/`excused`); teachers mark from `/my-classes/[offeringId]`.
* program_enrollments — **`183`:** assigned offering staff (via `program_staff_assignments` + `contacts.auth_user_id`) may SELECT enrollments for their offerings so personal-portal teachers can load `/my-classes/[offeringId]` roster (org-member and “own enrollment” policies remain).
* program_capacity_groups — S2 `offering_id` required (`177`); `program_id` retained for queries
* program_schedule_items — S3 `offering_id` required (`178`); weekly class times edited on offering Schedule tab; optional `venue_id` for shared facility calendar/conflicts (`209`)
* departments — RLS repair: `scripts/164_departments_rls_policies.sql` (org members can manage). App writes also authorize then use service role when needed. **`flyer_url` (migration `203`):** optional department flyer column (not shown on department Overview). **`terms_html` + `terms_pdf_url` (migration `241`):** Terms and Conditions on department Settings (rich text + optional PDF in `program-flyers` storage).
* venues — Spaces catalog under Facilities → Settings. **`color` + `flyer_url` (migration `204`):** card branding on Spaces settings (3-column grid like Departments). **Required:** run `scripts/204_venue_color_flyer.sql` in Supabase SQL Editor (includes `NOTIFY pgrst, 'reload schema'`) or color/flyer will not persist. **Per-day hours/rates:** `rental_space_pricing` (from `046`; seed `205`) — Sunday–Saturday open hours + flat/hourly; Spaces edit form replaces peak/non-peak buckets. **Setup/cleanup overrides (`222`):** nullable `venues.setup_minutes` / `cleanup_minutes` (NULL inherits org defaults on `venue_rental_settings`). **Calendar:** Facilities sidebar **Calendar** is `/facilities/calendar` (merged former Space Availability + Schedule); `/facilities/availability` redirects there. Module filtered views use `?sources=` against the same `resource_reservations` (+ program expand). **Overview:** `/facilities/overview` is the Facilities landing (read-only schedule metrics). **Inventory:** `facility_inventory_items` (migrations `207` + `208`) — Facilities → Inventory catalog with category, size/style/color, quantity, location, purchased_at, unit_cost, notes, active, sort_order. **Shared scheduling (migration `209`):** `program_schedule_items.venue_id`; `setup_minutes` / `cleanup_minutes` on `rental_reservations` and `internal_events` expand occupied windows in sync triggers to `resource_reservations`. Run **`scripts/209_shared_scheduling_foundation.sql`** after `208`. **Event location types (`210`):** `internal_events.location_type`, `location_address`. **Multi-venue events (`211`):** `internal_event_venues` junction; sync creates one `resource_reservations` row per venue; `internal_events.venue_id` remains primary. Run **`210`** then **`211`**. If submit fails with ON CONFLICT on resource_reservations, run **`212_fix_internal_event_sync_on_conflict.sql`**.
* internal_event_venues — Facility spaces for an internal event (`211`). Unique `(internal_event_id, venue_id)`. Backfilled from `internal_events.venue_id`.
* internal_events — **`flyer_url` (migration `214`):** optional event flyer on workspace Overview; uploads reuse `program-flyers` storage. Run `scripts/214_internal_event_flyer_url.sql` in Supabase SQL Editor (`NOTIFY pgrst, 'reload schema'`). **`flyer_focal_x` / `flyer_focal_y` (migration `249`):** Community Calendar featured banner crop (object-position %). **`community_calendar_status` (migration `247`):** Community Calendar visibility — UI is **Private** / **Public** (`not_published` | `published`; legacy `community_visible` still accepted). Set on event Overview. Shared Community Calendar at `/community-calendar` also lists Vendor Hub bazaars via `vendor_hub_events.calendar_status`. **Event Workspace redesign (`252`):** `workspace_features` (JSONB toggles), `audience` / `event_tags` (text[]), `coordinator_contact_id`, `estimated_attendance`, `internal_notes`; attendance mode lives in `ticketing_config.attendanceMode`; optional **`ticketing_config.linkedCampaignId`** for Finance tab campaign rollup; optional **`ticketing_config.communications`** for confirmation/reservation email subject + message overrides.
* event_ticket_types — **`252`:** per-offering `visibility`, `min_per_order`, `max_per_order`, `offering_kind`, optional `sales_start_at` / `sales_end_at` (inherit event `ticketing_config.salesOpenAt` / `salesCloseAt` when null).
* event_documents — **`254`:** files attached to an internal event (`title`, `file_url`, `visibility` staff|public). Uploads reuse `program-flyers` storage under `event-docs/{org}/{event}/`. Public rows listed on `/o/[orgSlug]/events/[eventId]`.
* ticket_orders — MAS Dallas historical Eventbrite import (`TICKET_ORDERS_CSV_V1`, August 2026): `scripts/import-ticket-orders-csv.mjs`. **`255`:** `stripe_checkout_session_id`, `stripe_payment_intent_id` for public paid Checkout on the org Connect account. Unique partial indexes when set. If columns are missing, session id is also stored in `ticket_orders.metadata`. Staff refunds write `metadata.stripeRefundId` / `refunded_at`. **`256`:** customer SELECT policy on own orders (`contact_id IN auth_user_contact_ids()`). Portal listing still uses service role after verifying the signed-in contact (also matches purchaser email). **`258`:** `refunded_amount_cents` (integer ≥ 0, default 0). Partial refunds increment this amount and set status `partially_refunded` without voiding seats; when remaining is $0, status is `refunded` and tickets are canceled. Backfill sets the column to `total_cents` for existing fully refunded orders.
* event_expenses — Per-event expense ledger (`252`): `amount_cents`, category, payee, dates; org-scoped RLS. Used by Finance tab + overview net.
* childcare_registrations — **`253`:** `checked_in_at`, `checked_out_at`, `checked_in_by`, `checked_out_by`, `pickup_authorization` for Youth Check-In tab. **`259`:** `waiver_signed_at`, `waiver_signed_by`, `photo_consent` for youth forms / liability waiver workflow.
* tickets — **`253`:** `status` may be `waitlisted` (registration waitlist promote flow on Attendees tab). **`286`:** purchaser/contact email is not stored on `tickets.attendee_email` when it matches `ticket_orders.purchaser_email` (kid seats keep the attendee name only).
* age_groups
* program_sessions — week/session rows under an offering. `capacity` 0 inherits offering limited capacity (`244` `program_session_effective_capacity`).
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
program_schedule_items.offering_id → program_offerings.id
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
program_payment_plans.organization_id → organizations.id (`240_program_payment_plans_organization_id.sql`)
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
* program_applications (`application_answers` JSONB — run `scripts/236_program_application_answers.sql`)

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

program_applications.program_id → programs.id
program_applications.offering_id → program_offerings.id
program_applications.approved_offering_id → program_offerings.id
program_applications.registrant_contact_id → contacts.id
program_applications.participant_contact_id → contacts.id
program_applications.enrollment_id → program_enrollments.id
program_applications.waitlist_id → program_waitlist.id
program_enrollments.application_id → program_applications.id

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
program_waitlist.offering_id → program_offerings.id
program_waitlist.child_person_id → people.id
program_waitlist.lunch_option_id → program_lunch_options.id
```

> **Registration pipeline (July 2026 / August 2026):** Run `scripts/182_program_registration_applications.sql` for `program_applications` and waitlist `offering_id` / offer deadline columns. Run `scripts/236_program_application_answers.sql` for `application_answers` JSONB (applicant form). Run `scripts/237_program_application_updated_by.sql` for `updated_by_user_id`. Run **`scripts/280_program_enrollment_process.sql`** for `programs.enrollment_process` (`direct_registration` | `application_approval`), `evaluation_required`, `seat_activation_rule` (`on_registration` | `after_initial_payment`), expanded application statuses, and `program_enrollments.application_id`. Run **`scripts/281_summer_camp_direct_registration.sql`** so Summer Camp 2026 is Direct Registration (QIL stays Application & Approval). Run **`scripts/282_qil_ajurrumiyyah_partials_to_recitation.sql`** to park QIL partials that were not Al-Ajurrumiyyah onto Recitation Improvement (Al-Ajurrumiyyah stays free). Customer Register on application/approval programs requires an unused approved application for that offering. See [programs-registration-pipeline-design.md](./programs-registration-pipeline-design.md).

---

## Financial Assistance

* program_financial_assistance (customer applications)
* program_financial_assistance_documents
* program_financial_assistance_status_history
* **program_enrollment_fa_awards** (staff Mark financial assistance awards — original fee, assisted fee, plan) — run **`scripts/185_program_enrollment_fa_awards.sql`**

Key relationships:

```text
program_financial_assistance.enrollment_id → program_enrollments.id
program_financial_assistance_documents.financial_assistance_id → program_financial_assistance.id
program_financial_assistance_status_history.financial_assistance_id → program_financial_assistance.id
program_enrollment_fa_awards.enrollment_id → program_enrollments.id
program_enrollment_fa_awards.program_id → programs.id
program_enrollment_fa_awards.offering_id → program_offerings.id
program_enrollment_fa_awards.participant_contact_id → contacts.id
```

---

## Donations, Pledges, and Payments

**Canonical ledger (active writes, June 2026 stabilization):** `payments`, `pledges`, `donors` (+ `contacts` for identity). Staff and customer portal now insert only into these tables.

**Legacy table cleanup (migrations `140`–`141`, June 2026):** Dropped superseded tables after JSON export via `scripts/cleanup-legacy-donation-staging-tables.mjs`:

* Tier 1 (`140`): `donation_payments`, `donation_pledges`, `donation_amount_options`, `donor_import_*`, `contact_import_staging`, `organization_settings`
* Tier 2 (`141`): `payment_import_rows`, `backup_*_2026_05_24` snapshot tables

Import CSV flow writes directly to `payments` + `payment_import_batches` (no row staging table).

**Dev seed:** `scripts/seed-donations-dev.mjs` inserts test data into canonical tables only (see `docs/Features.md` Donations section). Does not use dropped legacy tables. Horizon demo: `scripts/seed-horizon-community-foundation-demo.mjs` (org-locked).

**`payments.source` constraint (patch `131_payments_source_square.sql`):** lowercase channel keys (`cash`, `check`, **`square`**, `zelle`, `venmo`, `paypal`, `stripe`, `import`, `manual`). **`square`** = Square terminal batch deposit on a campaign (no donor/contact). Campaign overview classifies via memo `|batch|square|` or `source = square`. Customer portal normalizes configured payment method display names via `lib/donations/payment-source-channel.ts` before insert.

* campaigns (`goal_amount`, `description`, `start_date`, `end_date`, `status`, `code`, `overview_metric_keys` — migration `134`; `flyer_url` — migration `160` for customer portal campaign cards; `goal_breakdown_enabled` — migration `260`)
* campaign_phases (unused — Goal Breakdown retired; table kept; clear with `270_disable_campaign_goal_phases.sql`)
* campaign_ask_levels (strategy gift chart — migration `261`; `campaign_phase_id` unused)
* campaign_prospects (outreach pipeline for donation and sponsorship asks — migration `262`, ask type/activity/sponsorship link — `284`; unique contact + ask_type per campaign; RLS via donations helpers)
* campaign_groups (campaign fundraising teams — migration `263`; optional org group contact + lead; opaque `public_token`; staff RLS; public pages resolve via service role)
* campaign_wishlist_items (campaign funding priorities — migration `267`; optional fund/department; `campaign_phase_id` unused; opaque `public_token`; staff RLS; public `/donate/w/{token}` via service role)
* sponsorship_packages (campaign packages — migrations `284`/`285`; required `campaign_id`, optional `event_id`; name/amount/order/status; not a Contact role)
* sponsorship_package_benefits (package benefit catalog — `284`/`285`; optional `benefit_type` + `value`; copied onto committed sponsorships)
* campaign_sponsorship_benefits (per-sponsorship benefit snapshot + fulfillment — `285`)
* campaign_prospect_activities (prospect outreach history — `284`)
* campaign_sponsorships (committed sponsorships — `284`; cash/in-kind/mixed; not donations or pledges)
* donors
* donation_categories
* donation_subcategories (`is_active` — migration `161`; when false the fund is closed and hidden from new donation pickers; migration `162` blocks customer portal `payments` inserts to closed funds)
* pledges (`installment_amount`, `total_payments`, `first_payment_date`, `next_payment_date` added in migration `158` for customer portal installment pledges; `campaign_phase_id` — migration `260`; `ask_level_id` — migration `261`; `campaign_prospect_id` — migration `262`; `campaign_group_id` — migration `263`; `wishlist_item_id` — migration `267`)
* payments (`campaign_phase_id` — migration `260`; `campaign_group_id` — migration `263`; `wishlist_item_id` — migration `267`)
* payment_methods
* donor_summary_view
* pledge_status_view (includes `campaign_phase_id` after migration `260`)
* donation_settings (receipt + pledge reminder config per org — migrations `090`, `091`)
* donation_receipts (payment receipts + annual statements — canonical payments only)
* pledge_reminders (pledge collection reminder activity log — migration `091`)
* recurring_donation_plans (ongoing giving schedules — migration `092`; not pledges; `daily` frequency added in migration `155`; `total_payments` / `payments_made` added in migration `156`)
* donation_checkout_sessions (in-flight Stripe Checkout — migration `093`; campaign group attribution — `264`; not a payment ledger)
* payment_processor_events (Stripe webhook audit + idempotency — migration `093`)
* transactional_email_log (operational donation email audit — migration `094`)

**Stripe processor columns on `payments` (migration `093`):** `stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_charge_id`, `refunded_amount`. Unique partial index on `stripe_payment_intent_id`. Online card donations are inserted only via webhook (`source_type = processor`, `source = stripe`).

**Stripe recurring billing (migration `100_stripe_recurring_donations.sql`):** `payments.stripe_invoice_id` (unique partial index). `recurring_donation_plans.stripe_customer_id`. Plan statuses include `pending_setup` and `past_due`. Recurring charges insert `payments` via `invoice.paid` webhook with `recurring_donation_plan_id` set; `pledge_id` remains null.

**Square plan metadata (migration `156_recurring_plan_payment_counts.sql`):** `recurring_donation_plans.total_payments` (expected count from processor export) and `payments_made` (completed count). Populated by `scripts/import-madina-recurring-plans.mjs` from Square recurring plans CSV. **`157_recurring_plan_contact_payment_method.sql`** adds `contact_payment_method_id` (FK to `contact_payment_methods`) for on-file cards on recurring plans.

**Transactional email (migration `094`):** `transactional_email_log` tracks receipt, year-end statement, and pledge reminder sends. Extended in **`266`** with `group_pledge_confirmation` and `prospect_follow_up_reminder`. `donation_receipts.status` includes `failed`. `donation_settings.year_end_statement_email_template` for statement email body.

**RLS hardening (migration `095_donations_rls_hardening.sql`):** Row-level security on canonical ledger tables (`payments`, `pledges`, `donors`) plus donation operational tables (`recurring_donation_plans`, `donation_receipts`, `pledge_reminders`, `donation_checkout_sessions`, `payment_processor_events`, `donation_settings`). Staff policies require `donations.view` / `donations.manage` via `auth_user_can_view_donations` / `auth_user_can_manage_donations` (owner bypass included). Customers may SELECT/INSERT own rows through `auth_user_contact_ids` / `auth_user_donor_ids`. Service role bypass unchanged for webhooks and checkout creation.

**Campaigns RLS (migration `258_campaigns_rls_policies.sql`):** Same permission helpers on `campaigns` (staff SELECT/INSERT/UPDATE/DELETE). Active org members may SELECT `status = active` rows for customer portal campaign pickers. Staff campaign create/edit/delete on `/donations/campaigns` goes through server actions that write with the service role after `donations.manage` checks (selected org cookie).

**Campaign phases (migration `260_campaign_phases.sql`):** `campaign_phases` table (org + campaign scoped) with RLS using `auth_user_can_view_donations` / `auth_user_can_manage_donations`. Nullable `campaign_phase_id` on `pledges` and `payments`. `campaigns.goal_breakdown_enabled`. Recreates `pledge_status_view` / `donor_summary_view` to expose `campaign_phase_id`. Phase metrics are computed in `computeCampaignPhaseMetrics` (Committed / Collected / Outstanding; payments inherit pledge phase when payment phase is null — no double count).

**Campaign ask levels (migration `261_campaign_ask_levels.sql`):** `campaign_ask_levels` (org + campaign scoped, optional phase FK). Nullable `pledges.ask_level_id`. Fundraising Plan → Ask Strategy metrics via `computeCampaignAskLevelMetrics` (target value = ask × count; secured from linked pledges or soft amount match; prospects/asked filled from donation prospects; Asked = stages Asked and Pledged).

**Campaign prospects (migration `262_campaign_prospects.sql`, extended `284_campaign_sponsorship_prospects.sql`):** `campaign_prospects` (org + campaign scoped; FK to contacts, optional ask level / assignee / event / package / converted pledge / converted sponsorship). `ask_type` (`donation` | `sponsorship`; existing rows default donation). Unique `(campaign_id, contact_id, ask_type)`. Nullable `pledges.campaign_prospect_id`. Outreach history: `campaign_prospect_activities`. RLS via donations view/manage helpers.

**Campaign sponsorships (migration `284_campaign_sponsorship_prospects.sql`, extended `285_campaign_sponsorship_packages.sql`):** `sponsorship_packages` (campaign-scoped; optional related event), `sponsorship_package_benefits`, `campaign_sponsorships` (committed sponsor records; optional `prospect_id` / `event_id` / `sponsorship_package_id`), `campaign_sponsorship_benefits` (copied benefits + fulfillment). Separate from `pledges` and `payments`. Cash sponsorship commitments add to campaign `totalCommitted` only — not `totalRaised` (avoids double-counting payments). In-kind is reported separately and is not treated as cash collected. RLS via donations view/manage helpers.

**Campaign groups (migration `263_campaign_groups.sql`):** `campaign_groups` with opaque `public_token`, optional `organizational_group_id` / `lead_contact_id`. `goal_amount` exists but is unused in the UI. Nullable `campaign_group_id` on `pledges` and `payments`. Staff RLS; public `/donate/g/{token}` resolves via service role (no anon table dump).

**Campaign wishlist (migration `267_campaign_wishlist.sql`):** `campaign_wishlist_items` (org + campaign scoped). Optional `fund_id` (donation_subcategories), `department_id`, `campaign_phase_id`. Carry-forward via `carried_from_item_id` / `carried_to_item_id` + `previous_funding_amount` (historical snapshot — not current-campaign collected). Nullable `wishlist_item_id` on `pledges`, `payments`, `recurring_donation_plans`, `donation_checkout_sessions`. Staff RLS via donations view/manage helpers. Public donate `/donate/w/{token}` uses service role. Wishlist targets do not increase `campaigns.goal_amount`.

**Campaign group checkout (migration `264_campaign_group_checkout.sql`):** `donation_checkout_sessions.campaign_group_id` + `attributed_group_contact_id`. Stripe metadata + webhook payment insert carry the same fields.

**Group recurring + FD emails (migration `266_group_recurring_and_fd_emails.sql`):** `recurring_donation_plans.campaign_group_id` + `attributed_group_contact_id`; invoice payments copy group attribution from the plan. `prospect_follow_up_reminder_log` dedupes daily assignee digests. Transactional email template CHECK expanded.

Run after `094_transactional_email.sql`:

```bash
npx supabase db query --linked -f scripts/095_donations_rls_hardening.sql
npx supabase db query --linked -f scripts/258_campaigns_rls_policies.sql
npx supabase db query --linked -f scripts/260_campaign_phases.sql
npx supabase db query --linked -f scripts/261_campaign_ask_levels.sql
npx supabase db query --linked -f scripts/262_campaign_prospects.sql
npx supabase db query --linked -f scripts/263_campaign_groups.sql
npx supabase db query --linked -f scripts/264_campaign_group_checkout.sql
npx supabase db query --linked -f scripts/265_donations_granular_permissions.sql
npx supabase db query --linked -f scripts/266_group_recurring_and_fd_emails.sql
npx supabase db query --linked -f scripts/267_campaign_wishlist.sql
npx supabase db query --linked -f scripts/284_campaign_sponsorship_prospects.sql
npx supabase db query --linked -f scripts/285_campaign_sponsorship_packages.sql
npm run validate:donations-security
```

**Performance indexes (migration `096_donations_performance_indexes.sql`):** org-scoped indexes on canonical ledger + donation operational tables. See Priority 15 in `docs/Features.md`.

**Analytical views (migration `097_donations_views.sql`):** `pledge_status_view`, `donor_summary_view` with `security_invoker = true` (RLS on underlying tables applies). `donor_summary_view` includes `contact_id` (patch `116_donor_summary_view_contact_id.sql`) for payment contact matching.

**Pilot blocker view fixes (migration `119_donations_pilot_blocker_views.sql`):** `pledge_status_view` excludes voided payments from pledge balances; cancelled pledges expose `calculated_status = cancelled` and `balance_remaining = 0`. `donor_summary_view` excludes voided from `total_donations`.

**Pledge payment plans (migration `158_pledge_payment_plan.sql`):** `pledges.installment_amount`, `total_payments`, `first_payment_date`, `next_payment_date`. `pledge_status_view` exposes the new columns. Customer portal **New Pledge** writes only campaign + total; payment plans are added later via **Set Up Payment Plan**. Migration `159_customer_pledge_plan_update.sql` allows customers to UPDATE their own pledges for plan fields.

**Outstanding pledge flag (migration `124_donor_summary_outstanding_pledge.sql`):** `donor_summary_view.has_open_pledge` is true only when `pledge_status_view.balance_remaining > 0`. Backfills `pledges.status` from payment totals; trigger `sync_pledge_status_after_payment_change` keeps status in sync on payment changes.

**Donor giving report RPCs (migration `127_donor_giving_report.sql`, patch `128_donor_giving_report_contact_id.sql`, fix `143_donor_giving_report_type_fix.sql`, patch `144_donor_giving_report_summary_gift_count_cast.sql`, patch `145_donor_giving_report_email_search.sql`, patch `146_donor_giving_report_min_total_given.sql`, patch `150_donor_giving_report_email_phone.sql`, patch `151_donor_giving_report_pledge_status.sql`, patch `152_donor_giving_report_column_filters.sql`, patch `153_donor_giving_report_last_gift_filter.sql`, patch `163_donor_giving_report_contact_name.sql`):** `donation_donor_giving_report` (paginated rows with optional payment date range, column filters for donor name / email / phone / pledge status / **last gift** (`p_last_gift_filter`: all, active_12m, lapsed_12m, lapsed_24m, never), **minimum total given**, outstanding pledge balance, **contact_id**, net payment amounts) and `donation_donor_giving_report_summary` (aggregate donor count / total given / gift count for the same filters). Migration **163** prefers `contacts.full_name` (and contact email/phone) over denormalized `donors` fields so renamed/merged contacts show current names, and backfills stale `donors` rows from linked contacts. Migration **143** casts `payment_date` to `date` and aligns totals with `payment_net_amount`. Migration **144** casts `SUM(donation_count)` to `bigint`. Migration **145** adds email search. Migration **146** adds `p_min_total_given`. Migration **153** replaces `p_lapsed_only` with `p_last_gift_filter`. Used by Reports → Donors (`/donations/reports/donors`).

**People donor filter (migration `129_donor_giving_contact_search.sql`, grants `130_donor_giving_rpc_grants.sql`):** `search_donor_giving_contact_ids` — contacts with at least one non-voided payment (direct or via `donors.contact_id`). Run **`130`** so authenticated app users can call the RPC (without it, People falls back to ~95 affiliation tags). **Link orphan donors to People:** `node scripts/link-orphan-donors-to-contacts.mjs --execute` then `node scripts/sync-donor-affiliations.mjs --execute`.

**Payment refunds / net totals (migration `125_payment_refunds_net_amounts.sql`):** `payment_net_amount(amount, refunded_amount)` helper. Views and dashboard RPCs use net amounts. `refresh_pledge_status` and payment trigger include `refunded_amount`. Status values `partially_refunded` and `refunded` on `payments`.

**Import columns on `payments` (migration `117`):** `import_email`, `import_phone`, `import_batch_id` — CSV match hints and batch audit link. Legacy `payment_import_rows` staging removed in migration `141`.

**Chunked CSV import (migration `118`):** `payment_import_batches.import_seen_keys` holds duplicate keys while a file imports in 100-row server-action chunks; cleared when import completes.


**Dashboard RPCs (migration `098_donations_dashboard_rpcs.sql`):** `donation_org_payment_summary`, `donation_org_pledge_summary`, `donation_monthly_payment_totals`, `donation_payment_source_totals`. Payment sum RPCs updated by `120_donations_pilot_blocker_totals.sql` to exclude voided (aligned with Reports Overview).

**Money received (post-125):** `SUM(payment_net_amount(amount, refunded_amount))` where `LOWER(status) <> 'voided'`. Fully refunded payments contribute $0.

Key relationships:

```text
campaigns.organization_id → organizations.id
campaign_phases.organization_id → organizations.id
campaign_phases.campaign_id → campaigns.id
campaign_ask_levels.organization_id → organizations.id
campaign_ask_levels.campaign_id → campaigns.id
campaign_ask_levels.campaign_phase_id → campaign_phases.id
campaign_prospects.organization_id → organizations.id
campaign_prospects.campaign_id → campaigns.id
campaign_prospects.contact_id → contacts.id
campaign_prospects.ask_level_id → campaign_ask_levels.id
campaign_prospects.assigned_to_contact_id → contacts.id
campaign_prospects.converted_pledge_id → pledges.id
campaign_prospects.event_id → internal_events.id
campaign_prospects.sponsorship_package_id → sponsorship_packages.id
campaign_prospects.converted_sponsorship_id → campaign_sponsorships.id
campaign_prospect_activities.organization_id → organizations.id
campaign_prospect_activities.campaign_id → campaigns.id
campaign_prospect_activities.prospect_id → campaign_prospects.id
sponsorship_packages.organization_id → organizations.id
sponsorship_packages.campaign_id → campaigns.id
sponsorship_packages.event_id → internal_events.id
sponsorship_package_benefits.package_id → sponsorship_packages.id
campaign_sponsorships.organization_id → organizations.id
campaign_sponsorships.campaign_id → campaigns.id
campaign_sponsorships.event_id → internal_events.id
campaign_sponsorships.contact_id → contacts.id
campaign_sponsorships.prospect_id → campaign_prospects.id
campaign_sponsorships.sponsorship_package_id → sponsorship_packages.id
campaign_sponsorship_benefits.organization_id → organizations.id
campaign_sponsorship_benefits.sponsorship_id → campaign_sponsorships.id
campaign_sponsorship_benefits.package_benefit_id → sponsorship_package_benefits.id
campaign_groups.organization_id → organizations.id
campaign_groups.campaign_id → campaigns.id
campaign_groups.organizational_group_id → contacts.id
campaign_groups.lead_contact_id → contacts.id
campaign_wishlist_items.organization_id → organizations.id
campaign_wishlist_items.campaign_id → campaigns.id
campaign_wishlist_items.fund_id → donation_subcategories.id
campaign_wishlist_items.department_id → departments.id
campaign_wishlist_items.campaign_phase_id → campaign_phases.id
campaign_wishlist_items.carried_from_item_id → campaign_wishlist_items.id
campaign_wishlist_items.carried_to_item_id → campaign_wishlist_items.id
donors.organization_id → organizations.id
donors.contact_id → contacts.id

donation_subcategories.category_id → donation_categories.id

pledges.organization_id → organizations.id
pledges.donor_id → donors.id
pledges.campaign_id → campaigns.id
pledges.campaign_phase_id → campaign_phases.id
pledges.ask_level_id → campaign_ask_levels.id
pledges.campaign_prospect_id → campaign_prospects.id
pledges.campaign_group_id → campaign_groups.id
pledges.wishlist_item_id → campaign_wishlist_items.id
pledges.category_id → donation_categories.id
pledges.subcategory_id → donation_subcategories.id

payments.organization_id → organizations.id
payments.donor_id → donors.id
payments.contact_id → contacts.id
payments.pledge_id → pledges.id
payments.campaign_id → campaigns.id
payments.campaign_phase_id → campaign_phases.id
payments.campaign_group_id → campaign_groups.id
payments.wishlist_item_id → campaign_wishlist_items.id
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
recurring_donation_plans.campaign_group_id → campaign_groups.id
recurring_donation_plans.wishlist_item_id → campaign_wishlist_items.id
recurring_donation_plans.category_id → donation_categories.id
recurring_donation_plans.subcategory_id → donation_subcategories.id
recurring_donation_plans.payment_method_id → payment_methods.id
payments.recurring_donation_plan_id → recurring_donation_plans.id

donation_checkout_sessions.organization_id → organizations.id
donation_checkout_sessions.donor_id → donors.id
donation_checkout_sessions.contact_id → contacts.id
donation_checkout_sessions.campaign_id → campaigns.id
donation_checkout_sessions.campaign_group_id → campaign_groups.id
donation_checkout_sessions.wishlist_item_id → campaign_wishlist_items.id
donation_checkout_sessions.attributed_group_contact_id → contacts.id
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
* application_documents (uploaded files; optional `document_kind` for vendor profile categories — migration **`230_vendor_profile_documents.sql`**; storage bucket `application-documents`)

Migrations:

* `scripts/012_applications.sql` — core Applications engine
* `scripts/013_rename_hr_module.sql` — renames HR module display name to People Management
* `scripts/230_vendor_profile_documents.sql` — `application_documents.document_kind` + `application-documents` storage bucket

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
* facility_inventory_items (migrations `207` + `208` — Facilities → Inventory catalog)
* venue_bookings
* venue_rentals / rental_reservations / rental_payments (Venue Rentals workflow)

**`rental_payments` ledger (migration `215`):** Charges and settlements share `rental_payments` rows. Totals (charges / received / credits / balance due) are **derived** in app code — not manually editable caches. Columns: `payment_method`, `reference_number`, `recorded_by`, `receipt_url`; types include installment / cleaning_fee / credit / adjustment / discount; statuses include pending / completed / failed / voided / partially_refunded (legacy paid_* statuses remain). Unique index on `stripe_payment_intent_id` for online idempotency. Completed payments are voided for corrections; pending charges may still be deleted.

**Venue rental calendar sync fix (`218` + `223`):** After multi-venue indexes, `sync_rental_reservation_to_resource` must not use `ON CONFLICT (organization_id, source_type, source_id) WHERE source_id IS NOT NULL`. Run `scripts/218_fix_venue_rental_reservation_sync.sql` if editing rental spaces/dates fails with that Postgres error. **`223`** restores setup/cleanup occupied-window expansion (dropped by `218`) and backfills `rental_reservations.setup_minutes` / `cleanup_minutes` from venue override → org `venue_rental_settings` defaults. Run **`222`** then **`223`**.

**Post-event add-ons (`219`):** Seeds **Extra Cleaning** and **Damage Charge** into `rental_addons` for Financial → Add charge. Run `scripts/219_venue_rental_post_event_addons.sql`.

**Addon catalog cleanup (`225`):** Deactivates legacy **Cleanup Fee** (`cleanup-fee`), duplicate **Gift Table** (`gift-table`; keep `gift-table-setup`), and extra **Chair Covers** rows (keep `chair-covers`). Customer Book a Space also filters post-event staff add-ons, dedupes by name, and sorts A–Z. Run `scripts/225_venue_rental_addon_catalog_cleanup.sql`.

**Request hold backfill (`226`):** Sets `hold_expires_at = created_at + 72 hours` on open `submitted` / `pending` / `awaiting_supervisor_approval` rentals (and matching `temporary_hold` reservations) that were blocking the calendar with no expiry. New submits set this in app code. Run `scripts/226_venue_rental_request_hold_backfill.sql`.

**Venue rental org settings (`220` + `221` + `222` + `223` + `224`):** `venue_rental_settings` (1 row per org) — `security_deposit_enabled` (default false), optional `default_security_deposit_amount`, customer document URLs/names (`policies_document_*`, `pricing_guide_*`), `approval_mode` (`manual` | `auto_after_agreement`), and **`default_setup_minutes` / `default_cleanup_minutes`** (org buffers for new rentals). Storage bucket `venue-rental-docs`. Per-rental: `venue_rentals.policies_sent_at`, `policies_agreed_at`, document URL snapshots. Per-space optional overrides: `venues.setup_minutes` / `cleanup_minutes` (NULL = inherit org). **`224`:** `operational_briefs.chairs_per_table` for customer/staff facility setup (tables = ceil(attendance ÷ chairs)). Run `scripts/220_venue_rental_org_settings.sql`, then `scripts/221_venue_rental_customer_documents.sql`, then **`scripts/222_venue_rental_setup_cleanup_buffers.sql`**. After setting defaults, run **`scripts/223_backfill_venue_rental_setup_cleanup_buffers.sql`** to apply buffers to existing reservations and refresh calendar blocks. Then **`scripts/224_operational_brief_chairs_per_table.sql`**, then **`225`**, then **`226`**.

Key relationships:

```text
schedule_activities.age_group_id → age_groups.id
schedule_activities.category_id → schedule_categories.id
schedule_activities.program_id → programs.id
schedule_activities.session_id → schedule_sessions.id
rental_payments.venue_rental_id → venue_rentals.id
```

---

## Vendor Hub

* vendors
* vendor_categories
* vendor_hub_events — includes `organizer_contact_id`, `organizer_name`, `venue_id` (`scripts/227_vendor_hub_event_organizer_venue.sql`)
* vendor_hub_vendors
* vendor_hub_booths
* vendor_hub_booth_types — org defaults when `event_id` is null + `organization_id` set (`scripts/234_vendor_hub_default_booth_types.sql`); event-scoped types keep `event_id`
* vendor_hub_booth_assignments
* vendor_hub_payments
* vendor_hub_announcements / vendor_hub_announcement_recipients — RLS helpers in `scripts/228_vendor_hub_announcements_rls_fix.sql` (avoids 42P17 recursion)
* vendor_hub_events vendor SELECT — `scripts/229_vendor_hub_events_rls_perf.sql` (avoids statement timeouts after large imports)
* Customer vendor profile — vendors may UPDATE own `applications` (vendor_hub/vendor) and SELECT org `vendor_hub_vendor_types` (`scripts/231_customer_vendor_profile_rls.sql`)
* Vendor role backfill from approved applications — `scripts/232_backfill_vendor_roles_from_applications.sql`
* Vendor inactive after 2 years of no activity — `scripts/233_vendor_inactive_after_two_years.sql`
* Vendor import application cleanup — `scripts/235_fix_vendor_import_application_dates.sql` (submitted_at = earliest payment/event date; clear import notes/tags; clear fake reviewed_at)

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
