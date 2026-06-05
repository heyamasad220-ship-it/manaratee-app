# Programs — Staff Setup UI (Quick Create + Edit Program)

Last updated: June 2026

This document describes how staff create and configure programs in the dashboard after the **Phase 2B staff UI refactor**. It complements [programs.md](./programs.md) (module overview) and [programs-phase-2b-charge-ledger.md](./programs-phase-2b-charge-ledger.md) (ledger design).

---

## Design principle: Quick Create vs full Edit

Staff setup is intentionally split into two steps:

| Step | Route | Purpose |
|------|-------|---------|
| **Quick Create** | `/programs/create` | Create a program shell with basics only |
| **Full setup** | `/programs/[id]/edit` | Complete registration, pricing, sessions, and financial assistance |

**Do not duplicate** the full editor on the create page. Fee plans, billing schedule, charge ledger, session editor, registration option mapping, and financial assistance belong on **Edit Program** only.

### Recommended staff workflow

```text
Quick Create  →  Edit Program (tabs)  →  Publish (status = active)
     │                    │
     │                    ├── Registration options
     │                    ├── Pricing (fee plans)
     │                    ├── Sessions (if session registration enabled)
     │                    └── Financial assistance
     │
     └── name, dates, eligibility, capacity, visibility, draft/active
```

After Quick Create, the user is redirected to:

`/programs/[id]/edit?created=1`

Edit Program shows a one-time banner:

> Program created. Complete registration options, pricing, sessions, and financial assistance before publishing.

The `?created=1` query parameter is removed from the URL after the banner appears (refresh will not re-show it).

---

## Quick Create (`/programs/create`)

**File:** `app/(dashboard)/programs/create/create-program-form.tsx`

### Fields collected

| Area | Fields |
|------|--------|
| Basics | Name, program type, department, description |
| Dates | Start/end, enrollment open/close |
| Eligibility | Min/max age (0–99), grade levels, gender |
| Enrollment | Capacity groups (youth/family) or single capacity (adult), status (draft/active), visibility |
| **Not collected** | Waitlist, registration toggles, fee plans, sessions, financial assistance |

### Server behavior

- Calls `createProgram()` in `lib/programs/program-actions.ts`
- Creates default offering via `ensureDefaultOffering`
- Syncs default registration options via `syncRegistrationOptionsFromProgramFlags` with server defaults:
  - `full_program_registration_enabled`: **true**
  - `session_registration_enabled`: **false**
- Saves capacity groups via `replaceProgramCapacityGroups` when configured
- Computes `min_grade` / `max_grade` from selected grade levels
- Validates min age ≤ max age (client + server)
- Sets `visibility` (default `public`)

### Redirect

On success → `/programs/[id]/edit?created=1` (not the program detail page).

### Helper copy

The form explains that registration options, fee plans, sessions, and financial assistance are configured on the edit page after creation.

---

## Edit Program (`/programs/[id]/edit`)

**Orchestrator:** `app/(dashboard)/programs/[id]/edit/edit-program-form.tsx`  
**Page loader:** `app/(dashboard)/programs/[id]/edit/page.tsx`

Edit Program uses a **tabbed layout**. All tabs live inside a single `<form>`. Inactive tab panels remain in the DOM (Radix Tabs), so named form fields submit correctly on **Save Changes**.

### Tabs

| Tab | Sections | Contents |
|-----|----------|----------|
| **Basics** | `ProgramBasicsSection`, `ProgramDatesSection` | Name, type, department, description, dates |
| **Enrollment** | `EligibilitySection`, `EnrollmentSettingsSection` | Ages, grades, gender, capacity groups, waitlist, status, visibility |
| **Registration** | `RegistrationOptionsSection` | Full vs session registration, single session, drop-in |
| **Pricing** | `FeePlansSection` | Fee plans (SSOT), option→plan mapping, components, sibling discounts, schedule preview, link to billing schedule |
| **Sessions** | `SessionsSection` | Session list editor (or disabled notice) |
| **Financial Assistance** | `FinancialAssistanceSection` | FA enable/open/close/instructions |

### What is NOT on Edit Program (legacy removed)

These were removed from the edit UI in favor of Phase 2B pricing:

- Legacy **Billing** card (program-level `billing_type`, tuition, deposit fields)
- Legacy **Program Fees** card (`program_fee_options`)

Pricing source of truth: **offering fee plans** → quote RPC → charge ledger (Phase 2B).

### Save behavior

**Wrapper:** `lib/programs/save-edit-program.ts`

On submit:

1. `updateProgram()` — program row + registration flags
2. `replaceProgramCapacityGroups()` — capacity groups
3. `saveOfferingFeePlans()` — fee plans, components, discounts, option links (when offering exists)

Returns `{ success, error }` instead of throwing (avoids production digest errors).

**Sticky footer:** `EditProgramStickyFooter` — Save Changes applies to the **whole form**, all tabs.

### State architecture

| State | Location | Why parent |
|-------|----------|------------|
| Save status, errors | `EditProgramForm` | Submit handler |
| `minAge`, `maxAge` | Parent + hidden inputs | Controlled selects + FormData |
| `programType`, `gradeLevels`, `capacityGroups`, `totalCapacity`, `programGender` | Parent | Not all fields are native FormData; passed to `saveEditProgram` |
| Registration toggles | Parent | Read in submit handler |
| Fee plan draft | `feePlanStateRef` from `ProgramFeePlanEditor` | Ref callback; not FormData |

Section components under `components/programs/edit/` are mostly presentational. Complex editors (`ProgramCapacityGroupEditor`, `ProgramFeePlanEditor`, etc.) keep internal state.

---

## Shared section components

**Directory:** `components/programs/edit/`

| File | Used by |
|------|---------|
| `edit-section-card.tsx` | Compact section wrapper |
| `program-basics-section.tsx` | Create + Edit |
| `program-dates-section.tsx` | Create + Edit |
| `eligibility-section.tsx` | Create + Edit |
| `enrollment-settings-section.tsx` | Create + Edit (props differ) |
| `registration-options-section.tsx` | Edit only |
| `fee-plans-section.tsx` | Edit only |
| `sessions-section.tsx` | Edit only |
| `financial-assistance-section.tsx` | Edit only |
| `edit-program-sticky-footer.tsx` | Edit only |
| `types.ts`, `utils.ts` | Shared types and helpers |

### Create vs Edit section differences

**`EnrollmentSettingsSection` props:**

| Prop | Quick Create | Edit Program |
|------|--------------|--------------|
| `showWaitlist` | `false` | `true` (default) |
| `allowedStatuses` | `["draft", "active"]` | all statuses |
| `program` | omitted (defaults) | full program row |

**`ProgramBasicsSection` / `ProgramDatesSection`:** `program` prop is optional; Create passes no program (empty defaults).

---

## Eligibility and capacity alignment

Create and Edit share the same eligibility UX:

- Ages **0–99** via `AGE_OPTIONS` in `components/programs/edit/utils.ts`
- Gender labels: **All genders**, **Male only**, **Female only**
- Grade levels via `GradeLevelsMultiSelect`
- Min age ≤ max age validation before save

### Capacity groups

**Editor:** `components/programs/program-capacity-group-editor.tsx`

Rules (gender-split programs):

- **Male** and **Female** groups can use the same grades (parallel capacity pools).
- **Any gender** groups only compete with other any-gender assignments, not with Male/Female-specific groups.
- Gender dropdown defaults to **Male** on new rows (avoids “Any gender” accidentally blocking all grades).
- Empty grade picker shows **Select grades** (not “All grades”).
- Commit requires capacity > 0 and at least grades or gender selected.

---

## Pricing tab (Edit Program only)

**Component:** `FeePlansSection` → `ProgramFeePlanEditor`

Includes:

- Registration option → fee plan mapping table
- Fee plan list with components
- Sibling discount rules
- Live quote schedule preview
- Link to **Manage Billing Schedule** (`/programs/[id]/billing`)

Does **not** include legacy program-level billing fields.

---

## Migrations relevant to staff setup

| Script | Purpose |
|--------|---------|
| `026_program_min_max_age.sql` | `programs.min_age`, `programs.max_age` columns |
| `020`–`023` | Charge ledger foundation + registration integration (Phase 2B backend) |

Run `026` if ages do not persist on save.

---

## Customer-facing display helpers

Compact eligibility on customer program pages uses:

- `lib/programs/program-eligibility-display.ts`
  - `formatProgramAgeRangeShort()` — e.g. `4-14`
  - `formatProgramGradeRangeShort()` — e.g. `PK-8TH`
  - `parseProgramAgeBounds()` — reads `min_age`/`max_age` with `age_groups` fallback

---

## Related files (quick reference)

```text
app/(dashboard)/programs/create/create-program-form.tsx
app/(dashboard)/programs/[id]/edit/edit-program-form.tsx
app/(dashboard)/programs/[id]/edit/page.tsx
components/programs/edit/*
components/programs/program-capacity-group-editor.tsx
components/programs/program-fee-plan-editor.tsx
lib/programs/program-actions.ts          # createProgram, updateProgram
lib/programs/save-edit-program.ts        # edit save wrapper
```

---

## See also

- [programs.md](./programs.md) — full module architecture, RPCs, routes
- [programs-phase-2b-charge-ledger.md](./programs-phase-2b-charge-ledger.md) — charge ledger and payment flow
- [Known_Issues.md](./Known_Issues.md) — open bugs
