# Programs Phase 2B — Charge Ledger Design

Last updated: June 2026

Phase 2B introduces the **charge ledger** that sits between the Phase 2A quote engine and Phase 3 checkout (Stripe). It does **not** implement payment collection.

---

## Goals

1. Persist authoritative pricing from `quote_snapshot` / quote RPC into charge records.
2. Expose **`due_today`** and **`payment_required`** for checkout.
3. Support **pay-at-registration** as the default org behavior.
4. Support **multi-registration checkout** (one checkout, many charges, one payment split via allocations).
5. Leave **Stripe / payment processor** integration for Phase 3.

---

## Default registration + payment flow (target)

```text
Customer submits registration
        │
        ▼
Quote engine computes due_today, total, schedule
        │
        ▼
Enrollment created (pending_payment if payment required & due_today > 0)
        │
        ▼
Charge header + lines + schedule created from quote
        │
        ▼
Checkout session opened (Phase 3) — customer must pay due_today
        │
   ┌────┴────┐
   │         │
 success    fail / expire
   │         │
   ▼         ▼
 enrolled   expired OR remain pending_payment (org setting)
             (soft capacity hold released on expire)
```

### Enrollment statuses (Phase 2B adds)

| Status | Meaning |
|--------|---------|
| `pending_payment` | Registration saved; payment not completed |
| `pending` | Legacy / staff-review queue (no payment gate, or payment already satisfied) |
| `enrolled` | Payment satisfied (if required) and/or staff confirmed |
| `expired` | Checkout window elapsed without payment (when org policy = expire) |
| `active`, `completed`, `cancelled`, `withdrawn`, `transferred` | Unchanged from Phase 018 |

**After successful payment (Phase 3):** `pending_payment` → `enrolled` (and charge → `paid`).

---

## due_today rules (from quote engine)

| Fee plan type | `due_today` |
|---------------|-------------|
| `free` | $0 — no payment gate |
| `one_time` | Full `total` |
| `per_session` / drop-in | Full `total` |
| `deposit_balance` | Deposit portion |
| `monthly` | Registration fee + first month |
| `installments` | First installment (from schedule) |

`payment_required = (due_today > 0 AND org.require_payment_at_registration)`.

---

## Schema overview

### Organization settings — `program_payment_settings`

Per-org registration payment policy:

- `require_payment_at_registration` (default **true**)
- `unpaid_registration_policy`: `expire` | `keep_pending_payment`
- `hold_capacity_on_pending_payment` (default **true** — soft hold)
- `checkout_expiry_minutes` (default **30**)

### Checkout session — `program_checkouts`

Header for Phase 3 multi-item checkout:

- Totals: `subtotal`, `discount_total`, `total`, **`due_today`**
- **`payment_required`**, **`checkout_status`** (`draft` → `open` → `processing` → `paid` / `failed` / `expired` / `cancelled`)
- Payer / registrant contacts
- `expires_at`, `paid_at`
- Placeholder Stripe IDs (nullable, Phase 3)

### Charge header — `program_charges`

One charge per registration (extensible to add-ons):

- Links: `enrollment_id`, `program_id`, `offering_id`, `registration_option_id`, `fee_plan_id`
- **`due_today`**, **`payment_required`**, **`charge_status`**, **`checkout_status`**
- Frozen **`quote_snapshot`**
- **`checkout_id`** when bundled into multi-registration checkout

### Charge lines — `program_charge_lines`

Mirror of quote `line_items` (tuition, lunch, extended care, etc.).

### Charge schedule — `program_charge_schedule`

Mirror of quote `scheduled_payments` (deposit balance, monthly, installments).

### Payment allocations — `program_payment_allocations`

Phase 3: one payment → many charges / schedule rows.

- `payment_id` (future `program_payments` table)
- `checkout_id`, `charge_id`, optional `charge_schedule_id`
- `amount`, `allocation_type`

### Enrollment extensions

- `charge_id` → primary registration charge
- `payment_required`, `capacity_hold_type` (`none` | `soft` | `firm`)
- `checkout_expires_at`
- Status constraint includes `pending_payment`, `expired`

---

## Capacity policy

| `hold_capacity_on_pending_payment` | Behavior |
|-----------------------------------|----------|
| **true** (default) | `pending_payment` uses **soft** hold — counts temporarily, released on expire/cancel |
| **false** | No capacity increment until payment → `enrolled` |

Implementation note: Phase 2B adds `capacity_hold_type` on enrollment. Phase 3 checkout completion promotes soft → firm. Expire/cancel releases soft hold via `release_enrollment_capacity_hold()`.

Current `register_for_program` still increments capacity immediately — **Phase 3 will update registration RPC** to respect payment settings.

---

## Multi-registration checkout (Phase 3)

```text
program_checkouts (1)
  ├── program_charges (Zack registration)
  ├── program_charges (Ihab registration)
  └── due_today = sum(charges.due_today)

program_payment_allocations
  ├── payment $X → charge Zack due_today
  └── payment $Y → charge Ihab due_today
```

One Stripe PaymentIntent / Checkout Session maps to one `program_checkouts` row. Allocations split captured amount across charges.

---

## SQL migration

Run after `019b_lock_quote_engine_and_verify.sql`:

**`scripts/020_program_charge_ledger_foundation.sql`**

Includes:

- Tables + RLS
- Status helper updates
- `build_program_charge_from_quote()` — materialize charge from quote JSON
- `create_checkout_for_charges()` — bundle charges (no Stripe)
- Verification SELECT

**No Stripe.** No changes to customer UI payment flow yet.

---

## TypeScript

Types in `lib/programs/program-charge-types.ts` mirror ledger tables for Phase 3 app work.

---

## Phase 3 checklist (not in 2B)

- [ ] Stripe Checkout / PaymentIntent integration
- [ ] Block registration success UI until checkout paid (when required)
- [ ] Webhook: payment success → `apply_checkout_payment()`
- [ ] Cron: expire stale checkouts per `checkout_expiry_minutes`
- [ ] Admin UI for payment settings

---

## Registration → charge ledger auto-wire (023)

Run after `022_program_charge_line_admin.sql`:

**`scripts/023_register_for_program_charge_ledger.sql`**

When a customer registers (enrollment path), `register_for_program` now:

1. Computes quote (unchanged)
2. Resolves `due_today`, `payment_required`, initial status (`pending` vs `pending_payment`)
3. Sets `capacity_hold_type` (`soft` for unpaid pending_payment when org policy holds capacity)
4. Inserts enrollment with `quote_snapshot`
5. Calls `build_program_charge_from_quote()` → `program_charges`, lines, and schedule rows
6. Links `enrollment.charge_id`

Staff backfill for existing enrollments:

```sql
SELECT public.staff_backfill_enrollment_charges('your-org-uuid'::uuid, 200);
```

Or use **Create Charge Ledger from Quote** on a registration detail page (legacy rows).

---

## Phase 2B billing calendar & admin overrides (021)

Run after `020_program_charge_ledger_foundation.sql`:

**`scripts/021_program_billing_schedule_and_overrides.sql`**

### Late enrollment proration

Monthly tuition uses the **offering billing calendar** (Sep–May), not “N months from registration date.”

Example: offering runs Sep–May at $150/month. Participant joins in November → charges for Nov, Dec, Jan, Feb, Mar, Apr, May only (7 months), not 9 months starting in November.

**Exception months (August 2026):** Staff uncheck months on Billing Schedule (e.g. Ramadan). Those periods use `period_status = skipped` and are excluded for all enrollments. Billing day is the day-of-month from the offering start date. Run **`scripts/238_offering_billing_calendar_summary.sql`**.

Implemented via:

- `count_offering_billing_months_from_date(start, end, join_date)` / `count_active_offering_billing_periods` (238)
- `program_offering_billing_periods` — canonical month rows per offering
- Quote engine uses `participant_month_count` for `per_month` tuition quantity
- `build_monthly_quote_schedule()` labels rows by period (e.g. “November 2025 tuition”)

### Charge schedule model

Each scheduled charge is its own row in `program_charge_schedule`:

| Field | Purpose |
|-------|---------|
| `due_date` | When the charge is due |
| `amount` | Current charge amount |
| `original_amount` | Pre-adjustment amount |
| `status` | `scheduled`, `due`, `paid`, `waived`, `void`, `adjusted`, `past_due` |
| `admin_notes`, `adjustment_reason` | Staff documentation |
| `created_by`, `updated_by` | Audit |
| `billing_period_id` | Link to offering billing calendar month |

### Admin overrides

`program_billing_overrides` supports offering-wide or per-enrollment:

- Skip / waive a month
- Adjust a month’s amount
- Add one-time fees (book, materials, childcare)
- Bulk apply to all participants in an offering

Staff RPCs (no payment processing):

- `waive_charge_schedule_item`
- `adjust_charge_schedule_item`
- `add_enrollment_schedule_fee`
- `create_offering_billing_override`

### Admin UI

**`/programs/[id]/billing`** — Billing Schedule view:

- All monthly billing periods for the default offering
- Participant balances and period matrix
- Waive / adjust per row
- Override form (one participant or all)
- Add one-time fee form

Registration detail also shows **Charge Schedule** with link to program billing.

### Still not in Phase 2B

- Stripe / payment gateway
- Auto-charge
- Invoices
- Marking schedule rows `paid` from real payments (Phase 3 allocations)

---

## Related

- `docs/programs.md` — module overview
- `scripts/019_program_fee_plans_quote_engine.sql` — quote engine
- `lib/programs/program-quote-types.ts` — quote shape consumed by charge builder
