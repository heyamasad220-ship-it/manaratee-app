# Programs Module

Last updated: June 2026

The Programs module lets organizations create and manage programs (camps, classes, seasons), configure offerings and fee plans, accept customer registrations, and manage enrollments, waitlists, and lifecycle status. This document covers architecture, schema, migrations, routes, server logic, and current status.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Migration Run Order](#migration-run-order)
4. [Database Schema](#database-schema)
5. [RPCs and Security](#rpcs-and-security)
6. [Fee Plans and Quote Engine (Phase 2A)](#fee-plans-and-quote-engine-phase-2a)
7. [Registration Lifecycle (Phase 018)](#registration-lifecycle-phase-018)
8. [Customer Registration Flow](#customer-registration-flow)
9. [Staff Routes and UI](#staff-routes-and-ui)
10. [Staff Setup UI (Quick Create + Edit)](#staff-setup-ui-quick-create--edit)
11. [Customer Portal Routes](#customer-portal-routes)
12. [TypeScript Library (`lib/programs`)](#typescript-library-libprograms)
13. [Components](#components)
14. [Permissions](#permissions)
15. [Contacts Integration](#contacts-integration)
16. [Legacy vs Current Patterns](#legacy-vs-current-patterns)
17. [Known Issues and Gaps](#known-issues-and-gaps)
18. [Phase 2B — Charge Ledger](#phase-2b--charge-ledger-designed-not-wired-to-ui)
19. [Not Yet Implemented (Phase 3+)](#not-yet-implemented-phase-3)

---

## Overview

| Area | Status |
|------|--------|
| Program CRUD (staff) | Working |
| Program sessions | Working |
| Offerings + registration options | Working (016+) |
| Contact-based enrollments | Working (016+) |
| Customer browse + register UI | Working |
| Live quote preview | Working (019+) |
| Fee plan editor (staff) | Working (019+); offering manage Fees tab |
| Quick Create + program detail + offering manage | Working — see [programs-staff-setup-ui.md](./programs-staff-setup-ui.md) |
| Registration RPC (`register_for_program`) | Implemented; end-to-end submission may need data/debugging |
| Lifecycle RPCs (cancel, advance, waitlist) | Working (018) |
| Financial assistance (customer + admin UI) | Partial — DB complete, workflows in progress |
| Payments / charges / Stripe | **Phase 2B schema ready** — Phase 3 checkout |

### Core concepts

- **Program** (DB: `programs`) — Top-level program container (name, dates, eligibility defaults, capacity metadata). Staff UI label: **Program** (formerly Year/Season).
- **Offering** (DB: `program_offerings`) — A sellable class/instance customers register for (e.g. “Beginner Tajweed — Centre”). Staff UI label: **Offering**. Sessions and registration options belong to an offering row. Shared label helpers: `lib/programs/program-display-labels.ts`.
- **Registration option** — How a customer registers: `full_program`, `selected_sessions`, `single_session`, or `drop_in`.
- **Fee plan** — Offering-scoped pricing configuration (tuition, lunch, extended care, discounts). Drives the quote engine.
- **Enrollment** — A registration record linking registrant/participant **contacts** to a program offering.
- **Waitlist** — Holds customers when capacity is full (if waitlist enabled).

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Staff Dashboard                          │
│  /programs/*  — catalog, edit, sessions, fee plans, registrations│
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                     lib/programs/* (actions/queries)             │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│              Supabase (RLS + SECURITY DEFINER RPCs)              │
│  quote_program_registration  │  register_for_program            │
│  advance_enrollment_status   │  cancel_enrollment / promote_*   │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                     Customer Portal                              │
│  /customer/programs/*  — browse, detail, register + quote preview│
└─────────────────────────────────────────────────────────────────┘
```

**Important design decisions:**

- Customers register via **Contact + Participant**: adult/self uses contacts; youth minors use `child_person_id` (people under the parent Contact) with `participant_contact_id` null.
- Customers do **not** write enrollments directly; they call `register_for_program` RPC (017+).
- Pricing is computed server-side via `quote_program_registration`; internal `compute_program_registration_quote` is locked down (019A/019B).
- Sessions for registration are resolved by `resolve_registration_session_ids` (full program vs selected sessions vs drop-in).

---

## Migration Run Order

Apply in Supabase SQL Editor in this order:

| Script | Purpose |
|--------|---------|
| `001_create_tables.sql` / `001_create_multi_tenant_schema.sql` | Base `programs`, `program_sessions`, enrollments |
| `002_program_capacity_groups.sql` | Grade/gender capacity groups |
| `003_program_capacity_groups_genders.sql` | Capacity group gender support |
| `004_program_registration_types.sql` | Full vs session registration flags on programs |
| `016_program_registration_contacts_phase0_1.sql` | Offerings, registration options, contact columns on enrollments |
| `017_customer_program_registration_rpc.sql` | Customer RLS + `register_for_program` RPC |
| `018_program_lifecycle_foundation.sql` | History tables, lifecycle RPCs, capacity helpers |
| `019_program_fee_plans_quote_engine.sql` | Fee plans, quote engine, updated register RPC |
| `019a_program_quote_stabilization.sql` | Quote fixes: session resolution, addons, monthly schedule, lock compute RPC |
| `019b_lock_quote_engine_and_verify.sql` | Idempotent patch + verification if 019A partially applied |
| `026_program_min_max_age.sql` | `programs.min_age`, `programs.max_age` for staff eligibility UI |

**Verification after 019B:** Run the `SELECT` at the bottom of `019b_lock_quote_engine_and_verify.sql`. Expect:

- `quote_snapshot_column_exists = true`
- `resolve_fn_exists = true`
- `anon_can_execute_compute = false`
- `authenticated_can_execute_compute = false`
- `authenticated_can_execute_quote = true`
- `authenticated_can_execute_register = true`

---

## Database Schema

### Core program tables

| Table | Purpose |
|-------|---------|
| `programs` | Program master record |
| `departments` | Optional department link |
| `program_sessions` | Sessions/weeks; linked to `offering_id` |
| `program_schedule_items` | Weekly class times per **offering** (`offering_id`; S3) |
| `program_lunch_options` | Lunch add-ons (org-scoped) |
| `program_capacity_groups` | Capacity by grade/gender groups |

### Offerings and registration (016+)

| Table | Purpose |
|-------|---------|
| `program_offerings` | Sellable offering per program (`standard`, `summer`, etc.) |
| `program_registration_options` | Registration types per offering; optional `fee_plan_id` (019) |
| `program_registration_session_access` | Which sessions an enrollment can access |

**Registration option types:** `full_program`, `selected_sessions`, `single_session`, `drop_in`

### Enrollments and waitlist

| Table | Purpose |
|-------|---------|
| `program_enrollments` | Main enrollment record |
| `program_waitlist` | Waitlist entries |
| `program_enrollment_sessions` | Legacy session link table (being consolidated into session access) |

**Key enrollment columns (016+):**

- `offering_id`, `registration_option_id`
- `registrant_contact_id`, `participant_contact_id`, `payer_contact_id`
- `participant_type`, `registrant_type`
- `quote_snapshot` (JSONB, 019+) — frozen quote at registration time
- Lifecycle: `cancelled_at`, `withdrawn_at`, transfer IDs (018)

**Enrollment statuses:** `pending`, `enrolled`, `active`, `completed`, `cancelled`, `withdrawn`, `transferred`

**Waitlist statuses:** `waiting`, `offered`, `accepted`, `declined`, `expired`, `removed`

### Lifecycle history (018)

| Table | Purpose |
|-------|---------|
| `program_enrollment_status_history` | Audit trail for enrollment status changes |
| `program_waitlist_status_history` | Audit trail for waitlist status changes |
| `program_registration_lifecycle_events` | General lifecycle event log |

### Fee plans and quoting (019)

| Table | Purpose |
|-------|---------|
| `program_offering_fee_plans` | Plan header (`free`, `one_time`, `deposit_balance`, `monthly`, `installments`, `per_session`) |
| `program_offering_fee_plan_components` | Line items (tuition, lunch, extended care, etc.) |
| `program_offering_discount_rules` | Sibling, multi-session, early bird, custom discounts |

### Financial assistance

| Table | Purpose |
|-------|---------|
| `program_financial_assistance` | Application records |
| `program_financial_assistance_documents` | Uploaded documents |
| `program_financial_assistance_status_history` | Status audit |

Program-level settings: `financial_assistance_enabled`, `financial_assistance_open`, `financial_assistance_close_date`, `financial_assistance_instructions`

### Legacy / cart tables (partially used)

| Table | Notes |
|-------|-------|
| `program_fee_options` | Legacy fee options; superseded by offering fee plans for new work |
| `program_discounts` | Program-level discounts linked to discount tags |
| `program_expenses` | Internal expense tracking |
| `program_extended_care` | Per-enrollment extended care (legacy path) |
| `program_payment_plans` | Per-enrollment payment plans (legacy path) |
| `registration_carts`, `registration_cart_items`, `registration_orders` | Cart/checkout model — not fully wired to Phase 2A quote flow |

### Program fields (eligibility and registration)

From `lib/programs/program-types.ts`:

- **Eligibility:** `program_type` (`adult` \| `youth` \| `family`), age/grade ranges, `gender`, flags (`require_guardian`, `require_grade`, `require_emergency_contact`)
- **Registration:** `session_registration_enabled`, capacity/waitlist settings
- **Legacy billing fields on program row:** `billing_type`, `tuition_amount`, etc. — prefer offering fee plans for new pricing

### Program status

`draft` → `active` → `paused` → `archived` (see `lib/programs/program-status.ts`)

---

## RPCs and Security

### Customer-facing (granted to `authenticated`)

| RPC | Purpose |
|-----|---------|
| `quote_program_registration(...)` | Returns pricing quote for current selections |
| `register_for_program(...)` | Creates enrollment or waitlist entry; stores `quote_snapshot` |

### Internal / staff-only

| RPC | Purpose |
|-----|---------|
| `compute_program_registration_quote(...)` | Low-level quote computation — **REVOKE from anon/authenticated** (019A/019B) |
| `resolve_registration_session_ids(...)` | Internal session resolution — **not callable by clients** |

### Lifecycle (staff, 018)

| RPC | Purpose |
|-----|---------|
| `advance_enrollment_status` | Forward transitions: pending→enrolled→active→completed |
| `cancel_enrollment` | Cancel with reason |
| `admin_override_enrollment_status` | Admin override |
| `promote_waitlist` | Convert waitlist to enrollment (status `pending`) |
| `remove_waitlist` | Remove waitlist entry |

### Access model

- **Staff:** `organization_members` RLS on most tables.
- **Customers:** `contacts.auth_user_id = auth.uid()` for read access to offerings, options, own enrollments.
- **Registration writes:** Customers use RPC only (017+), not direct INSERT on `program_enrollments`.

---

## Fee Plans and Quote Engine (Phase 2A)

### Plan types

`free`, `one_time`, `deposit_balance`, `monthly`, `installments`, `per_session`

### Components

Each plan has components with:

- `component_type`: tuition, registration_fee, materials, lunch, extended_care, custom
- `pricing_model`: flat, per_session, per_month, percent_of_tuition
- `quantity_mode`: fixed, session_count, month_count, addon_selected
- `addon_key` / `session_price_source` for lunch and extended care

### Discount rules

Types: `sibling`, `multi_session`, `early_bird`, `custom` — applied by priority on the offering.

### Quote flow

1. Customer selects registration option, sessions, participant, lunch, extended care.
2. Client calls `quoteProgramRegistration()` → RPC `quote_program_registration`.
3. RPC calls internal `compute_program_registration_quote` (service role / definer context).
4. Returns: `line_items`, `subtotal`, `discounts`, `total`, `due_today`, `scheduled_payments`, `resolved_session_ids`.
5. On submit, `register_for_program` recomputes quote and stores `quote_snapshot` on enrollment.

### TypeScript types

- `lib/programs/program-fee-plan-types.ts` — plan/component/discount types
- `lib/programs/program-quote-types.ts` — quote response + `mapQuoteErrorMessage()`

### Staff UI

- `components/programs/program-fee-plan-editor.tsx` — embedded in program edit form
- Wired via `lib/programs/program-fee-plan-actions.ts` and `program-fee-plan-queries.ts`

### Quote error codes (user-facing mapping)

| Code prefix | Meaning |
|-------------|---------|
| `quote:no-fee-plan` | No fee plan configured for option/offering |
| `quote:invalid-fee-plan` | Option references missing/inactive plan |
| `quote:invalid-session` | Session selection invalid for option type |
| `quote:invalid-lunch` | Lunch option not found |
| `quote:unauthorized` | Customer lacks org access via contacts |

---

## Registration Lifecycle (Phase 018)

### Forward enrollment transitions (staff)

```text
pending → enrolled → active → completed
```

Terminal states: `cancelled`, `withdrawn`, `transferred`

TypeScript helpers: `lib/programs/program-lifecycle-types.ts`

- `nextForwardEnrollmentStatus()`
- `canCancelEnrollmentStatus()`
- `canPromoteWaitlist()`

### Server actions

`lib/programs/program-lifecycle-actions.ts` wraps RPCs:

- `cancelEnrollmentRpc`
- `advanceEnrollmentStatusRpc`
- `promoteWaitlistRpc`
- `removeWaitlistRpc`
- `adminOverrideEnrollmentStatusRpc`

### Capacity

- `apply_program_capacity_delta` — updates program `enrolled` count
- `enrollment_status_counts_toward_capacity` — which statuses consume capacity
- Session-level capacity via `grant_enrollment_session_access` / `release_enrollment_session_capacity`

---

## Customer Registration Flow

### Routes

| Route | Purpose |
|-------|---------|
| `/customer/programs` | List programs for active org |
| `/customer/programs/[id]` | Program detail |
| `/customer/programs/[id]/register` | Registration form |
| `/customer/programs/[id]/financial-assistance` | FA application (partial) |

### Registration page flow

1. Resolve active organization (cookie / org switcher).
2. Load program, default offering, registration options, sessions, lunch options.
3. Load family participants via contacts (`lookupContactsByPersonIds`).
4. User picks option, sessions (if applicable), participant, lunch, extended care.
5. **Quote preview** (`ProgramRegisterQuotePreview`) calls `quoteProgramRegistration` live.
6. Submit → server action `registerForProgram()` in `program-registration-actions.ts`:
   - Validates enrollment window and capacity mode (enroll / waitlist / closed)
   - Verifies participant in registrant's family
   - Calls `register_for_program` RPC

### Prerequisites for successful registration

- Customer must have a **contact** record with `auth_user_id` linked to their login.
- Each participant must have a **contact** linked to their `person_id` in the org.
- Program must have an active **registration option** and **fee plan** (for paid programs).
- Sessions must exist for `full_program` options.

### Contact resolver

`lib/programs/registration-contact-resolver.ts`:

- `getCustomerContactForUser()` — logged-in customer's contact
- `lookupContactByPersonId()` — participant contact lookup
- `verifyParticipantInRegistrantFamily()` — family relationship check

---

## Staff Routes and UI

### Sidebar navigation (`components/layout/sidebar.tsx`)

Programs module (Catalog first). **Departments** is under **HR** (`/workforce/departments`), not Programs.

| Nav item | Route | Permission |
|----------|-------|------------|
| Catalog | `/programs/catalog` | `programs.view` |
| Schedule | `/programs/schedule` | `programs.view` |
| Financial Assistance | `/finance/financial-assistance` (legacy `/programs/financial-assistance` redirects) | `applications.view` / `finance.view` — Overview / Submissions / Templates + FA report + Payment Plans tabs |
| Reports | `/programs/reports` | `reports.view` — Overview / Registrations / Attendance / Waitlist. Payment transactions → **Finance → Transactions**; expenses → department workspace |
| Settings | Per-department **Settings** on the department workspace (`/workforce/departments/[id]?tab=settings`) — not in the Programs sidebar | `staff.view` / department head |

### Program management routes

| Route | Purpose |
|-------|---------|
| `/programs` | Redirect / landing |
| `/programs/catalog` | Program list |
| `/programs/create` | **Quick Create** — basics + eligibility; redirects to `/programs/[id]` after save |
| `/programs/[id]` | Program detail home (Overview inline edit + Offerings; Catalog → Edit) |
| `/programs/[id]/offerings` | Redirects to first non-archived offering manage page (or program detail if none) |
| `/programs/[id]/offerings/[offeringId]` | **Offering manage** (orphan years). Department-linked years use `/workforce/departments/[id]/programs/[programId]/offerings/[offeringId]` instead. |
| `/programs/[id]/edit` | **Retired** — redirects to detail or offering manage (legacy deep links) |
| `/programs/[id]/billing` | Redirects to offering Enrollment tab (fees) |
| `/programs/[id]/car-tags` | Printable car dismissal name tags (staff operations) |
| `/programs/[id]/sessions` | Session management (standalone route; also in offering Schedule) |
| `/programs/[id]/discounts` | Program discounts |
| `/programs/instructors` | Instructor assignments |
| `/programs/registrations` | Registration balances (Fee / Received / Balance; status Paid / Open / Refunded) |
| `/programs/registrations/[type]/[id]` | Enrollment or waitlist detail |
| `/programs/schedule` | Cross-program schedule view |
| `/programs/reports` | Reports |
| `/programs/settings` | Redirects to `/workforce?tab=departments` (settings live on each department) |
| `/programs/settings/service-needs` | Redirects to `/workforce?tab=departments` |

### Staff setup flow

See **[programs-staff-setup-ui.md](./programs-staff-setup-ui.md)** for Quick Create → program detail → offering manage flow, shared section components, and capacity group rules.

**Summary:**

- **Quick Create** — name, dates, eligibility, capacity, visibility, draft/active.
- **Program detail** — inline edit for publishing basics; offerings list.
- **Offering manage** — Overview (staff + schedule), Enrollment (registration + fees; waitlist toggle). Attendance & Waitlist under Reports.

---

## Customer Portal Routes

See [Customer Registration Flow](#customer-registration-flow).

Organization context comes from `active_organization_id` cookie and `getMyOrganizations()`. Customer portal role label maps legacy `viewer` → "Customer" (`lib/customer/customer-portal-role-label.ts`).

---

## TypeScript Library (`lib/programs`)

| File | Responsibility |
|------|----------------|
| `program-types.ts` | `Program` interface |
| `program-status.ts` | Status enum + labels |
| `program-queries.ts` / `program-actions.ts` | Program CRUD (`createProgram`, `updateProgram`) |
| `save-edit-program.ts` | Edit form save wrapper (program + capacity groups + fee plans) |
| `program-session-types.ts` / `-queries.ts` / `-actions.ts` | Sessions |
| `program-offering-types.ts` / `-queries.ts` / `-actions.ts` | Offerings |
| `program-registration-option-types.ts` / `-queries.ts` / `-actions.ts` | Registration options |
| `program-registration-session-access.ts` | Session access helpers |
| `program-fee-plan-types.ts` / `-queries.ts` / `-actions.ts` | Fee plans (019) |
| `program-quote-types.ts` / `program-quote-actions.ts` | Quote RPC wrapper |
| `program-registration-actions.ts` | Customer `registerForProgram` server action |
| `program-lifecycle-types.ts` / `program-lifecycle-actions.ts` | Lifecycle RPC wrappers |
| `program-capacity-group-*` | Capacity groups |
| `program-schedule-*` | Schedule items |
| `program-discount-queries.ts` / `program-fee-actions.ts` | Legacy discounts/fees |
| `program-offering-queries.ts` | Default offering lookup |
| `registration-contact-resolver.ts` | Contact ↔ person resolution |
| `registration-display-helpers.ts` | UI formatting helpers |

---

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `edit/*` section components | `components/programs/edit/` | Shared Create + Edit sections (basics, dates, eligibility, enrollment, etc.) |
| `program-fee-plan-editor.tsx` | `components/programs/` | Fee plan CRUD (Edit → Pricing tab) |
| `program-sessions-editor.tsx` | `components/programs/` | Session list editor |
| `program-registration-options-editor.tsx` | `components/programs/` | Registration option picker/editor |
| `program-capacity-group-editor.tsx` | `components/programs/` | Capacity groups by grade/gender |
| `registration-type-selector.tsx` | `components/programs/` | Registration type UI |
| `grade-levels-multi-select.tsx` | `components/programs/` | Grade picker |
| `program-eligibility-display.ts` | `lib/programs/` | Compact age/grade display helpers |
| `program-register-session-fields.tsx` | `components/customer/` | Customer session picker |
| `program-register-quote-preview.tsx` | `components/customer/` | Live quote preview |
| `program-form.tsx` | `components/programs/` | Create / edit program form |
| `program-detail-client.tsx` | `components/programs/` | Program detail + inline basics edit |
| `offering-manage-client.tsx` | `components/programs/` | Offering manage workspace |

---

## Permissions

| Key | Typical use |
|-----|-------------|
| `programs.view` | Browse catalog, schedule, program details |
| `programs.manage` | Edit programs, registrations, settings, invites |

Configured in org roles via Settings → Roles & Permissions.

---

## Contacts Integration

Programs registration is **contact-centric**:

- Customer login maps to `contacts.auth_user_id`.
- Enrollments store `registrant_contact_id` and `participant_contact_id`.
- Missing contact links cause "Contact record missing" on the registration form — staff must ensure family members are linked in the Contacts module before customers can register.

Do not break Contacts module when changing registration logic.

---

## Legacy vs Current Patterns

| Legacy | Current (preferred) |
|--------|---------------------|
| `program_enrollments.child_person_id` | `participant_contact_id` |
| Legacy program billing fields on edit form | Offering **fee plans** on Edit → Pricing tab |
| `program_fee_options` on program | `program_offering_fee_plans` on offering |
| Monolithic create + edit forms | Quick Create + program detail + offering manage ([programs-staff-setup-ui.md](./programs-staff-setup-ui.md)) |
| `program_enrollment_sessions` | `program_registration_session_access` |
| `schedule_sessions` | **Do not use** — use `program_sessions` |

---

## Known Issues and Gaps

From `docs/Known_Issues.md` and recent work:

1. **Customer registration submission** — UI works; end-to-end save may fail if contacts/participants/fee plans are misconfigured. Verify `register_for_program` RPC errors in Supabase logs.

2. **Participant contact missing** — Participants need `contacts.person_id` linked in the org. Registration form disables participants without contacts.

3. **019A partial apply** — If quote engine behaves oddly, run `019b_lock_quote_engine_and_verify.sql` and confirm verification SELECT passes.

4. **Program edit save** — Uses `saveEditProgram` wrapper; ensure migration `026_program_min_max_age.sql` is applied for age persistence.

5. **Session enrollment tracking** — Session-level `enrolled` counts and capacity enforcement still improving.

6. **Customer programs membership lookup** — Customer portal org access depends on `organization_members` + `contacts` alignment.

---

## Phase 2B — Charge Ledger (designed, not wired to UI)

**Migration:** `scripts/020_program_charge_ledger_foundation.sql`  
**Design doc:** [programs-phase-2b-charge-ledger.md](./programs-phase-2b-charge-ledger.md)

Phase 2B creates the ledger Phase 3 checkout will use. **No Stripe in 2B.**

### Tables

| Table | Purpose |
|-------|---------|
| `program_payment_settings` | Org policy: pay-at-registration, expiry, unpaid handling |
| `program_checkouts` | Multi-registration checkout session + `checkout_status` |
| `program_charges` | Charge header: `due_today`, `payment_required`, `quote_snapshot` |
| `program_charge_lines` | Line items from quote |
| `program_charge_schedule` | Future installments / monthly / balance |
| `program_payment_allocations` | One payment → many charges (Phase 3) |

### Registration payment flow (target)

1. Customer registers → enrollment `pending_payment` when `due_today > 0`
2. `build_program_charge_from_quote()` materializes charge + lines + schedule
3. `create_checkout_for_charges()` bundles one or more charges (Zack + Ihab)
4. Phase 3 collects `due_today` via Stripe
5. Success → `apply_checkout_payment_placeholder()` → `enrolled` (Phase 3 replaces placeholder)

### due_today by plan type

| Plan | due_today |
|------|-----------|
| free | $0 |
| one_time / per_session | total |
| deposit_balance | deposit |
| monthly | registration fee + first month |
| installments | first installment |

### TypeScript

`lib/programs/program-charge-types.ts`

---

## Not Yet Implemented (Phase 3+)

- Stripe Checkout / PaymentIntent
- Customer UI payment gate (block completion until paid)
- Wire `register_for_program` to create charges + `pending_payment`
- Checkout expiry cron
- Refunds / autopay
- **Registration pipeline** (apply → evaluate/approve → waitlist/FA → register → reports) — **in progress** (SQL `182`, customer apply, DH Applications queue; waitlist/register gate next): [programs-registration-pipeline-design.md](./programs-registration-pipeline-design.md)
- **Program → Offering attributes migration** — **S1–S6 in repo** (`176`–`179`); catalog Unlimited when no limited offerings — [programs-offering-attributes-migration.md](./programs-offering-attributes-migration.md)

Legacy cart tables (`registration_carts`, `registration_orders`) remain unused; prefer `program_checkouts`.

---

## Related Documentation

- [programs-offering-attributes-migration.md](./programs-offering-attributes-migration.md) — **Program identity vs Offering attributes (schema-first plan)**
- [programs-registration-pipeline-design.md](./programs-registration-pipeline-design.md) — **apply / approve / waitlist / FA / register + reports (implementation started)**
- [programs-staff-setup-ui.md](./programs-staff-setup-ui.md) — Quick Create + program detail + offering manage UI
- [programs-architecture-reset-plan.md](./programs-architecture-reset-plan.md) — **workflow audit & refactor sequence (review before Phase 3)**
- [programs-phase-2b-charge-ledger.md](./programs-phase-2b-charge-ledger.md) — charge ledger design
- `docs/Features.md` — high-level feature list

---

## Quick Reference: Registration Option → Sessions

| Option type | Session selection |
|-------------|-------------------|
| `full_program` | All active sessions on offering (via `resolve_registration_session_ids`) |
| `selected_sessions` | Customer picks one or more sessions |
| `single_session` | Exactly one session |
| `drop_in` | Exactly one session (drop-in pricing) |

---

## Quick Reference: Staff Lifecycle Actions

| Action | RPC | Result |
|--------|-----|--------|
| Confirm enrollment | `advance_enrollment_status` → `enrolled` | pending → enrolled |
| Mark active | `advance_enrollment_status` → `active` | enrolled → active |
| Mark completed | `advance_enrollment_status` → `completed` | active → completed |
| Cancel | `cancel_enrollment` | → cancelled |
| Promote waitlist | `promote_waitlist` | Creates enrollment (pending) |

Waitlist promotion does **not** auto-confirm; staff confirms via `advance_enrollment_status`.
