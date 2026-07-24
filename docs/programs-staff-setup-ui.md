# Programs — Staff Setup UI (Quick Create + Detail + Offering Manage)

Last updated: July 2026

This document describes how staff create and configure programs in the dashboard. It complements [programs.md](./programs.md) (module overview) and [programs-phase-2b-charge-ledger.md](./programs-phase-2b-charge-ledger.md) (ledger design).

---

## Design principle: Create → Detail → Offering manage

Staff setup is split across three surfaces:

| Step | Route | Purpose |
|------|-------|---------|
| **Quick Create** | `/programs/create` | Create a program shell with basics + eligibility |
| **Program detail** | `/programs/[id]` | View/edit program publishing basics; list offerings |
| **Offering manage** | `/programs/[id]/offerings/[offeringId]` | Registration, fees, schedule, staff per offering |

**Retired:** `/programs/[id]/edit` (General + Offerings tabs). That URL redirects to program detail or offering manage so bookmarks keep working.

### Recommended staff workflow

```text
Quick Create  →  Program detail  →  Offering manage  →  Publish (status = active)
     │                  │                   │
     │                  │                   ├── Registration
     │                  │                   ├── Fees
     │                  │                   ├── Schedule
     │                  │                   └── Staff
     │                  │
     │                  └── Inline Edit: name, subtitle, flyer, description,
     │                      department, visibility, status
     │
     └── name, dates, eligibility, capacity, visibility (starts Draft)
```

After Quick Create, the user is redirected to:

`/programs/[id]`

---

## Quick Create (`/programs/create`)

**File:** `components/programs/program-form.tsx` (`mode="create"`)  
**Page:** `app/(dashboard)/programs/create/`

### Fields collected

| Area | Fields |
|------|--------|
| Basics | Name, subtitle, flyer, description, department, visibility, status |
| Eligibility | Min/max age, grade levels, gender |
| Enrollment | Capacity / waitlist (create form sections) |
| Draft fee plans | Optional draft fee plan section on create |

### Redirect

On success → `/programs/[id]` (program detail).

---

## Program detail (`/programs/[id]`)

**Client:** `components/programs/program-detail-client.tsx`  
**Basics save:** `lib/programs/program-detail-actions.ts` → `updateProgramBasics`

### Overview

- Read-only summary with flyer, dates, audience, status, department, visibility.
- **Edit** (Overview button or Actions → Edit program) toggles inline `ProgramBasicsSection`.
- Save/Cancel; persists name, subtitle, flyer, description, department, visibility, status while preserving other program fields.
- When not editing, status can still be changed via `ProgramStatusSelect`.

### Offerings

- Table of offerings with **Manage** → offering manage route (shown on the same page as Overview).
- Archived offerings listed below the main table.
- **Add Offering** → `/programs/[id]/offerings` (picks first offering or returns to program detail if none).

---

## Offering manage (`/programs/[id]/offerings/[offeringId]`)

**Client:** `components/programs/offering-manage-client.tsx`

Tabs: Overview (includes Instructors & Staff + Schedule), Enrollment. Shows the offering opened from program detail (switch offerings from the program offerings list). Attendance and Waitlist viewing live under Programs → Reports.

Pricing source of truth: **offering fee plans** → quote RPC → charge ledger (Phase 2B).

---

## Legacy redirects

| Old URL | New destination |
|---------|-----------------|
| `/programs/[id]/edit` | `/programs/[id]` |
| `/programs/[id]/edit?tab=offerings&offering=…` | `/programs/[id]/offerings/[offeringId]` (+ mapped `?tab=`) |
| `/programs/[id]/billing` | Offering Fees tab |

---

## Shared section components

**Directory:** `components/programs/edit/`

| File | Used by |
|------|---------|
| `program-basics-section.tsx` | Quick Create + program detail inline edit |
| `eligibility-section.tsx` | Quick Create |
| `enrollment-settings-section.tsx` | Quick Create |
| `fee-plans-section.tsx` / offering pricing panels | Create draft + offering manage Fees |
| Offering registration / sessions / staff panels | Offering manage |

---

## Capacity group rules

Male/Female parallel pools and grade rules remain as implemented in `ProgramCapacityGroupEditor` / `program-capacity-group-utils` (youth/family). Configured in create flow and offering registration capacity UI where applicable.

---

## Key files

```text
app/(dashboard)/programs/create/
app/(dashboard)/programs/[id]/page.tsx
app/(dashboard)/programs/[id]/edit/page.tsx          # redirect only
app/(dashboard)/programs/[id]/offerings/[offeringId]/page.tsx
components/programs/program-form.tsx                 # create mode
components/programs/program-detail-client.tsx
components/programs/offering-manage-client.tsx
lib/programs/program-detail-actions.ts
lib/programs/program-offering-paths.ts
```
