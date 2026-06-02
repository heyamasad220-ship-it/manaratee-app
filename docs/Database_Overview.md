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
* profiles
* customer_profiles
* platform_admins
* platform_settings
* organization_settings

Key relationships:

```text
organization_members.organization_id → organizations.id
organization_members.role_id → organization_roles.id
organization_roles.organization_id → organizations.id
role_permissions.organization_id → organizations.id
role_permissions.role_id → organization_roles.id
customer_profiles.organization_id → organizations.id
organization_settings.organization_id → organizations.id
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

---

## CRM / Contacts / People

* people
* contacts
* contact_notes
* contact_roles
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
person_relationships.organization_id → organizations.id
person_relationships.person_id → people.id
person_relationships.related_person_id → people.id
person_tags.organization_id → organizations.id
person_tags.tag_id → discount_tags.id
discount_tags.organization_id → organizations.id
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

* campaigns
* donors
* donation_categories
* donation_subcategories
* donation_amount_options
* donation_pledges
* donation_payments
* pledges
* payments
* payment_methods
* donor_summary_view
* pledge_status_view

Key relationships:

```text
campaigns.organization_id → organizations.id
donors.organization_id → organizations.id
donors.contact_id → contacts.id

donation_subcategories.category_id → donation_categories.id
donation_amount_options.category_id → donation_categories.id
donation_amount_options.subcategory_id → donation_subcategories.id

donation_pledges.organization_id → organizations.id
donation_pledges.contact_id → contacts.id
donation_payments.organization_id → organizations.id
donation_payments.contact_id → contacts.id
donation_payments.pledge_id → donation_pledges.id

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

Import tables:

* contact_import_staging
* donor_import_batches
* donor_import_rows
* payment_import_batches
* payment_import_rows

Backup tables:

* backup_donation_payments_2026_05_24
* backup_donation_pledges_2026_05_24
* backup_donors_2026_05_24
* backup_payments_2026_05_24
* backup_pledges_2026_05_24

These appear to be operational or historical tables and should not be modified without review.

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
