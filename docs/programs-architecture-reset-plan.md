# Programs Architecture Reset Plan

Last updated: June 2026  
**Status:** Review only — no implementation in this document.

This plan audits the current Programs module, separates concerns into workflows, maps sources of truth, defines page responsibilities, and recommends a refactor sequence. **Phase 3 (Stripe, checkout, payment collection) is explicitly out of scope** until this reset is reviewed and approved.

Related docs:
- [programs.md](./programs.md) — module overview
- [programs-staff-setup-ui.md](./programs-staff-setup-ui.md) — Quick Create + Edit Program
- [programs-phase-2b-charge-ledger.md](./programs-phase-2b-charge-ledger.md) — charge ledger design

---

## Executive summary

The Programs module works end-to-end for many paths but feels tangled because **three pricing eras coexist**:

1. **Legacy program row billing** (`programs.billing_type`, `tuition_amount`, …)
2. **Legacy program fees / tag discounts** (`program_fee_options`, `program_discounts`)
3. **Current Phase 2A/2B stack** (offering fee plans → quote RPC → charge ledger)

Staff UI has been partially cleaned (Edit Program tabs, Quick Create), but **program detail**, **standalone routes**, and **lib/** still expose legacy paths. Customer registration depends on the quote engine + `register_for_program` RPC — preserve this chain during refactors.

**North star:** One staff setup path, one pricing authority (fee plans), one registration write path (RPC), one ledger for money after registration.

---

## 1. Core workflows

### 1.1 Create Program

| | |
|---|---|
| **Purpose** | Create program shell; default offering + default registration options |
| **Staff entry** | `/programs/create` (not `/programs/new`) |
| **Main tables** | `programs`, `program_offerings` (via `ensureDefaultOffering`), `program_registration_options` (via `syncRegistrationOptionsFromProgramFlags`) |
| **Main functions** | `createProgram`, `replaceProgramCapacityGroups`, `ensureDefaultOffering`, `syncRegistrationOptionsFromProgramFlags` |
| **Main UI** | `create-program-form.tsx`, shared sections in `components/programs/edit/*` |
| **Authoritative data** | Program row: name, dates, eligibility, capacity, visibility, status |
| **Legacy / hidden** | No fee plans, billing schedule, or FA at create time (correct) |
| **After create** | Redirect to `/programs/[id]/edit?created=1` |

---

### 1.2 Configure Program

| | |
|---|---|
| **Purpose** | Full program setup: basics, eligibility, enrollment, visibility, waitlist |
| **Staff entry** | `/programs/[id]/edit` → **Basics**, **Enrollment** tabs |
| **Main tables** | `programs`, `program_capacity_groups` |
| **Main functions** | `saveEditProgram` → `updateProgram`, `replaceProgramCapacityGroups` |
| **Main UI** | `edit-program-form.tsx`, section components |
| **Authoritative data** | `programs.*` for eligibility/enrollment flags; capacity groups table for split capacity |
| **Legacy / hidden** | `programs.billing_*` still passed through unchanged on save (`save-edit-program.ts`) — **should not be edited in UI** |
| **Overlap / confusion** | Same fields also shown read-only on `/programs/[id]` detail page |

---

### 1.3 Configure Registration Options

| | |
|---|---|
| **Purpose** | How customers register: full program vs sessions; single session; drop-in |
| **Staff entry** | `/programs/[id]/edit` → **Registration** tab |
| **Main tables** | `programs` (flags), `program_registration_options`, `program_offerings` |
| **Main functions** | `updateProgram` (flags), `syncRegistrationOptionsFromProgramFlags`, `saveOfferingFeePlans` (option → fee plan links) |
| **Main UI** | `RegistrationOptionsSection`, `RegistrationTypeSelector`, `ProgramRegistrationOptionsEditor` |
| **Authoritative data** | `program_registration_options` per offering; flags on `programs` drive sync |
| **Legacy / hidden** | None in UI if staff uses Edit only |
| **Risk** | Enabling session registration without sessions or fee plan mapping → customer registration fails |

---

### 1.4 Configure Pricing / Fee Plans

| | |
|---|---|
| **Purpose** | Define what registration costs; drive quote engine |
| **Staff entry** | `/programs/[id]/edit` → **Pricing** tab |
| **Main tables** | `program_offering_fee_plans`, `program_offering_fee_plan_components`, `program_offering_discount_rules`, `program_registration_options.fee_plan_id` |
| **Main RPCs** | `quote_program_registration` (customer/staff preview), internal `compute_program_registration_quote` |
| **Main functions** | `saveOfferingFeePlans`, `getFeePlanBundleForOffering`, `getInvalidFeePlanLinksForOffering`, `quoteProgramRegistration` |
| **Main UI** | `FeePlansSection`, `ProgramFeePlanEditor` |
| **Authoritative data** | **Offering fee plans** — sole SSOT for new pricing |
| **Legacy / hidden** | `programs.billing_type` / tuition fields (DB only, passthrough on save); `program_fee_options`; program detail **Discounts** tab (`program_discounts`) |
| **Risk** | Invalid/missing `fee_plan_id` on options blocks customer registration |

---

### 1.5 Configure Billing Schedule

| | |
|---|---|
| **Purpose** | Offering billing periods + participant overrides (Phase 2B schedule layer) |
| **Staff entry** | `/programs/[id]/billing` (linked from Edit → Pricing) |
| **Main tables** | `program_offering_billing_periods`, `program_billing_overrides` (021+) |
| **Main functions** | `getOfferingBillingScheduleBundle`, billing actions in `program-billing-actions.ts` |
| **Main UI** | `program-billing-schedule-view.tsx`, `ProgramBillingScheduleView` |
| **Authoritative data** | Billing periods/overrides for **schedule display and staff adjustments** — not a replacement for fee plan components |
| **Legacy / hidden** | Program-row `payment_due_day` / installment fields |
| **Note** | Distinct from **charge schedule** (`program_charge_schedule`) which is per-enrollment after registration |

---

### 1.6 Customer Registration

| | |
|---|---|
| **Purpose** | Family selects option, sessions, participant; quote preview; submit enrollment or waitlist |
| **Customer entry** | `/customer/programs`, `/customer/programs/[id]`, `/customer/programs/[id]/register` |
| **Main tables** | Read: `programs`, offerings, options, sessions, lunch; Write: via RPC only |
| **Main RPCs** | `quote_program_registration`, `register_for_program` (023+ may create charges) |
| **Main functions** | `registerForProgram` (`program-registration-actions.ts`), contact resolver |
| **Main UI** | Customer program pages, `ProgramRegisterQuotePreview`, session/participant pickers |
| **Authoritative data** | Quote at submit time → stored in `program_enrollments.quote_snapshot`; fee plans resolve via `resolve_fee_plan_for_option` |
| **Legacy / hidden** | Direct enrollment INSERTs; `child_person_id`-only paths |
| **Prerequisites** | Contacts linked to auth user + participants; valid fee plan; enrollment window open |

---

### 1.7 Staff Registration Management

| | |
|---|---|
| **Purpose** | View/filter enrollments and waitlist; lifecycle actions |
| **Staff entry** | `/programs/registrations`, `/programs/registrations/[registrationId]`, `/programs/registrations/waitlist/[waitlistId]` |
| **Main tables** | `program_enrollments`, `program_waitlist`, history tables (018) |
| **Main RPCs** | `advance_enrollment_status`, `cancel_enrollment`, `promote_waitlist`, `remove_waitlist`, `admin_override_enrollment_status` |
| **Main functions** | `program-lifecycle-actions.ts`, `registration-detail-queries.ts` |
| **Main UI** | `registrations/page.tsx`, registration detail, `RegistrationLifecycleActions` |
| **Authoritative data** | Enrollment/waitlist rows + lifecycle RPCs |
| **Legacy / hidden** | Legacy column displays (`child_name`, `payment_status` on old shapes); roster tab on program detail may duplicate registrations list |

---

### 1.8 Charge Ledger Management

| | |
|---|---|
| **Purpose** | Persist charges from quotes; staff view/edit lines; prep for Phase 3 checkout |
| **Staff entry** | Registration detail (`RegistrationChargeEditor`); billing schedule page (related) |
| **Main tables** | `program_charges`, `program_charge_lines`, `program_charge_schedule`, `program_checkouts`, `program_payment_settings`, `program_payment_allocations` |
| **Main RPCs** | `build_program_charge_from_quote`, `create_checkout_for_charges`, `apply_checkout_payment_placeholder`; staff line RPCs (022): `add/adjust/void_program_charge_line`, `recalculate_program_charge_from_lines`, `staff_ensure_enrollment_charge` |
| **Main functions** | `program-charge-actions.ts`, `program-charge-queries.ts` |
| **Main UI** | `registration-charge-editor.tsx`, partial display on registration detail |
| **Authoritative data** | Charge header/lines after registration; quote_snapshot on enrollment is frozen source |
| **Legacy / hidden** | `registration_carts`, `registration_orders`; placeholder checkout payment |
| **Phase 3** | **Do not build** Stripe/checkout until ledger boundaries are clear |

---

### 1.9 Capacity / Waitlist Management

| | |
|---|---|
| **Purpose** | Limit enrollment by program and optionally grade/gender groups |
| **Staff entry** | Edit → Enrollment (configure); program detail → Capacity (read); registrations (operate) |
| **Main tables** | `programs` (`capacity`, `enrolled`, `waitlist`), `program_capacity_groups` |
| **Main RPCs** | Capacity helpers in 018/023: `apply_program_capacity_delta`, `enrollment_status_counts_toward_capacity`; registration RPC checks capacity |
| **Main functions** | `replaceProgramCapacityGroups`, capacity group editor |
| **Authoritative data** | Groups sum → `programs.capacity`; `programs.enrolled` updated by RPCs |
| **Legacy / hidden** | Session-level capacity still evolving |
| **Risk** | Gender/grade group rules are UI-sensitive; co-ed vs split pools must stay documented |

---

### 1.10 Financial Assistance

| | |
|---|---|
| **Purpose** | Program-level FA settings + customer applications |
| **Staff entry** | Edit → **Financial Assistance** tab; `/programs/financial-assistance` (applications hub) |
| **Main tables** | `programs` (FA flags), `program_financial_assistance*`, applications module |
| **Main functions** | `updateProgram` (settings); applications module for review |
| **Main UI** | `FinancialAssistanceSection`; `ModuleApplicationsClient`; customer FA page |
| **Authoritative data** | Program flags for gating; applications table for requests |
| **Legacy / hidden** | None significant |
| **Status** | Partial — DB + settings UI; customer apply flow incomplete |

---

## 2. Source of truth map (quick reference)

```text
                    ┌─────────────────────┐
                    │      programs       │  eligibility, dates, capacity totals,
                    │                     │  enrollment flags, visibility, status
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  program_offerings   │  sellable instance (default per program)
                    └──────────┬──────────┘
           ┌───────────────────┼───────────────────┐
           │                   │                   │
┌──────────▼─────────┐ ┌───────▼────────┐ ┌───────▼──────────────┐
│ program_registration│ │ program_offering│ │ program_sessions     │
│ _options            │ │ _fee_plans (*)  │ │                      │
└──────────┬──────────┘ └───────┬────────┘ └──────────────────────┘
           │                    │
           │    (*) SSOT for     │
           │        pricing      │
           └────────┬───────────┘
                    │
         quote_program_registration
                    │
                    ▼
         program_enrollments.quote_snapshot
                    │
                    ▼
         program_charges / lines / schedule  (Phase 2B)

LEGACY (do not use for new config):
  programs.billing_*, program_fee_options, program_discounts
```

| Data domain | Authoritative | Legacy (hide/deprecate) |
|-------------|---------------|-------------------------|
| Program identity & dates | `programs` | — |
| Eligibility | `programs` + `grade_levels` / min_max age | `age_groups` alone (derived) |
| Capacity | `program_capacity_groups` + `programs.capacity/enrolled` | — |
| Registration modes | `program_registration_options` + program flags | — |
| **Pricing** | **`program_offering_fee_plans` + components + discount rules** | **`programs.billing_*`, `program_fee_options`** |
| Tag discounts | — (not used by quote engine) | **`program_discounts`** |
| Quote at registration | RPC → `quote_snapshot` on enrollment | Client-side price math |
| Post-registration money | `program_charges*` | `registration_orders`, carts |
| Billing calendar | `program_offering_billing_periods` | Program-row installment fields |
| FA | Program flags + `program_financial_assistance` | — |

---

## 3. Page responsibility map

> **Route note:** There is no `/programs/new`. Quick Create is **`/programs/create`**.

### `/programs`

| Current | Recommended |
|---------|-------------|
| Redirects to `/programs/catalog` | Keep as redirect **or** rename catalog to be the canonical list |

**Should do:** Entry to program list only.  
**Should not do:** Configuration.

---

### `/programs/create` (user said `/programs/new`)

**Should do:**
- Quick Create only (basics, dates, eligibility, capacity, status, visibility)
- Create default offering + default registration options (server defaults)
- Redirect to edit with setup banner

**Should not do:** Fee plans, sessions editor, billing, FA applications, registration mapping UI

---

### `/programs/[id]` — Program detail (staff)

**Current problems:** Large multi-tab page (overview, capacity, **discounts**, lunch, notifications, roster); links to billing; duplicates edit data; legacy discount UI.

**Should do:**
- Read-only **operational dashboard**: status, enrollment summary, key dates, setup completeness checklist
- Links: **Edit Program**, **Registrations**, **Billing Schedule**
- Optional read-only capacity summary

**Should not do:**
- Edit eligibility/pricing (→ edit)
- **`program_discounts` management** (→ remove or mark legacy; pricing discounts = fee plan sibling rules)
- Duplicate session CRUD (→ edit Sessions tab)
- Lunch/notifications/roster until each has a clear owner workflow

---

### `/programs/[id]/edit`

**Should do:** Single staff configuration hub (current tab model):

| Tab | Owns |
|-----|------|
| Basics | Name, type, department, description, dates |
| Enrollment | Eligibility, capacity groups, waitlist, status, visibility |
| Registration | Registration type flags + option toggles |
| Pricing | Fee plans, option mapping, components, sibling discounts, link to billing |
| Sessions | Session list (when session registration enabled) |
| Financial Assistance | Program FA settings |

**Should not do:**
- Legacy billing/program fees cards (already removed — keep out)
- Billing period editing (→ `/billing`)
- Charge ledger editing (→ registration detail)

**Save:** One `saveEditProgram` for program + capacity groups + fee plans.

---

### `/programs/[id]/billing`

**Should do:**
- Offering billing periods and overrides
- Schedule preview aligned with fee plan types
- Clear label: “Billing schedule (offering calendar)” — not “program tuition”

**Should not do:**
- Replace fee plan editor
- Stripe/checkout (Phase 3)
- Edit program eligibility

---

### `/programs/registrations`

**Should do:**
- Cross-program enrollment + waitlist queue
- Filters (program, status, payment state where relevant)
- Row actions → lifecycle RPCs

**Should not do:**
- Program configuration
- Fee plan editing

---

### `/programs/registrations/[registrationId]`

**Should do:**
- Single enrollment detail: contacts, option, sessions, quote snapshot summary
- Lifecycle actions (confirm, cancel, advance)
- **Charge ledger** view/edit (lines, schedule) when charge exists
- Link to program and customer context

**Should not do:**
- Program-wide fee plan changes
- Checkout/payment UI (Phase 3)

**Route note:** Waitlist uses `/programs/registrations/waitlist/[waitlistId]` — keep documented.

---

### Customer: `/customer/programs/[id]/register`

**Should do:**
- Eligibility display (compact age/grade)
- Registration option picker
- Session/participant selection
- Live **quote preview** (`quote_program_registration`)
- Submit via `registerForProgram` → RPC
- Handle enroll / waitlist / closed states

**Should not do:**
- Staff configuration
- Direct DB writes
- Payment collection UI (Phase 3 — may show `due_today` read-only only)

---

### Secondary routes (audit)

| Route | Verdict |
|-------|---------|
| `/programs/[id]/sessions` | **Duplicate** of Edit → Sessions — deprecate or redirect to edit |
| `/programs/[id]/discounts` | **Legacy** — hide/redirect; conflicts with fee plan discounts |
| `/programs/catalog` | List + filters — keep |
| `/programs/financial-assistance` | FA applications hub — keep |
| `/programs/settings` | Module settings — keep separate from per-program edit |
| `/programs/schedule` | Cross-program schedule — keep if used |
| `/programs/reports` | Reports — keep |

---

## 4. Refactor recommendation (prioritized sequence)

**Constraints:** Reduce confusion, prevent pricing mistakes, preserve working registration, **no database rewrites**.

### Phase A — Clarify & hide (1–2 weeks, low risk)

**Goal:** Stop staff from using wrong pricing paths.

1. **Publish architecture docs** (this plan + update `programs.md` legacy section).
2. **Program detail page slim-down**
   - Remove or gate **Discounts** tab (`program_discounts`).
   - Add **Setup checklist** on detail: registration options mapped, fee plan exists, sessions if needed, FA if enabled.
   - Make **Edit Program** the obvious primary action.
3. **Redirect duplicates**
   - `/programs/[id]/sessions` → Edit → Sessions tab (or thin wrapper).
   - `/programs/[id]/discounts` → Edit → Pricing tab with “legacy discounts moved” notice.
4. **Stop legacy passthrough noise**
   - Document that `saveEditProgram` still passes `billing_*` unchanged — add comment + eventual removal from `UpdateProgramInput` when safe (no UI depends on it).

**Do not:** Change RPCs, schema, or customer register flow.

---

### Phase B — Setup guardrails (1–2 weeks, low risk)

**Goal:** Prevent publishing broken programs.

5. **Setup completeness validator** (client + server warnings on edit save / status → active):
   - At least one active registration option
   - Each active option has valid fee plan (reuse `getInvalidFeePlanLinksForOffering`)
   - Session registration enabled → ≥1 session
   - Capacity > 0 or explicit “unlimited” policy documented
6. **Pricing tab hardening**
   - Block save with invalid option→plan links (already warned — make blocking optional/configurable).
   - Single “Test quote” preview using real option IDs (already partial in fee plan editor — make prominent).
7. **Catalog ↔ detail alignment**
   - Catalog filters (status + department) — done; add link to edit from card.

**Do not:** Rewrite quote engine.

---

### Phase C — Consolidate staff navigation (1 week, medium risk)

**Goal:** One mental model for staff.

8. **Unified program hub**
   - Detail page = dashboard + checklist only.
   - All configuration in Edit tabs.
   - Billing schedule linked only from Pricing tab + detail dashboard.
9. **Registrations ↔ program detail**
   - Roster tab → link to filtered `/programs/registrations?program=…` instead of embedded partial roster.
10. **lib/programs cleanup (organize, not rewrite)**
    - Folder labels: `legacy/` for `program-fee-actions`, `program-discount-queries`
    - Single `README` or index in docs pointing to SSOT map

**Do not:** Merge billing schedule into edit form (keep separate page — different workflow).

---

### Phase D — Charge ledger clarity (2 weeks, medium risk, no Stripe)

**Goal:** Staff understands money records without Phase 3.

11. **Registration detail as ledger home**
    - Clear sections: Quote snapshot (read-only) → Charge → Lines → Schedule
    - When no charge, button “Ensure charge from snapshot” (existing RPC wrapper)
12. **Document enrollment statuses**
    - `pending_payment` vs `pending` vs `enrolled` on staff UI labels
13. **Smoke test script as release gate**
    - `run-phase2b-smoke-test.mjs` before any ledger UI changes

**Do not:** Build checkout, Stripe, invoices, or payment collection.

---

### Phase E — Financial assistance & capacity polish (ongoing, lower priority)

14. **FA workflow** — connect customer apply page to applications hub; show FA status on registration detail.
15. **Capacity groups** — document gender-split rules in staff UI helper text; optional validation that groups cover eligible grades.
16. **Session capacity** — improve when session-level limits are required (separate from program capacity).

---

### Explicitly deferred: Phase 3

Do **not** start until A–D reviewed:

- Stripe / PaymentIntent / Checkout
- Customer payment gate blocking registration completion
- Checkout expiry cron
- Refunds / autopay
- Wire `register_for_program` UI to checkout flow

---

## 5. Recommended refactor sequence (at a glance)

```text
A1  Document SSOT + legacy map                    [done: this plan]
A2  Slim program detail; remove legacy discounts tab
A3  Redirect duplicate routes (sessions, discounts)
A4  Annotate legacy billing passthrough in save path

B5  Setup completeness checks before active
B6  Pricing tab validation + test quote prominence
B7  Catalog → edit navigation polish

C8  Program detail = dashboard + checklist only
C9  Roster → registrations filter link
C10 lib/programs legacy folder + doc index

D11 Registration detail = charge ledger home
D12 Enrollment status labels for 2B
D13 Phase 2B smoke test as gate

E14 FA end-to-end
E15 Capacity group UX/validation
E16 Session capacity (if needed)

─── STOP LINE: Phase 3 payments ───
```

---

## 6. What NOT to change in this reset

| Preserve | Reason |
|----------|--------|
| `quote_program_registration` + `register_for_program` RPCs | Customer registration depends on them |
| Offering fee plan tables | Phase 2A SSOT |
| Contact-based enrollment columns | Registration resolver |
| Quick Create → Edit flow | Recently aligned |
| Charge ledger schema (020–023) | Phase 3 foundation — extend, don’t replace |
| Migration scripts | No rewrites — only new additive migrations if needed |

---

## 7. Open questions for review

1. **`program_discounts`**: Delete UI only, or migrate any data to fee plan discount rules?
2. **`/programs/[id]` tabs**: Which of lunch / notifications / roster are still needed vs. cut?
3. **Catalog filters**: Require status + department, or allow “all” with performance cap?
4. **Default offering model**: Always one offering per program, or plan for multi-offering UI later?
5. **When to hard-block `status = active`**: Warn vs. prevent save?

---

## 8. Success criteria

After reset (Phases A–D):

- [ ] Staff can describe: Create → Edit tabs → Publish → Customer registers
- [ ] No staff UI edits `programs.billing_*` or `program_discounts` for pricing
- [ ] Invalid fee plan links caught before publish
- [ ] Customer registration path unchanged and smoke-tested
- [ ] Charge ledger visible on registration detail without confusion vs. billing schedule
- [ ] Phase 3 scope document approved separately

---

*End of plan — implementation requires explicit approval per phase.*
