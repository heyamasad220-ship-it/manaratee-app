# Programs flexibility contract

**Status:** F1–F6 complete; **F7 polish** in repo (July 2026). Run SQL **`180`** and **`181`**.  
**Goal:** One Programs module that fits Quran Institute (Ladies), Education (after-school / weekend), recreational camps, and future department shapes — without separate products per department.

**Related:** [programs-offering-attributes-migration.md](./programs-offering-attributes-migration.md), [programs.md](./programs.md), [programs-architecture-reset-plan.md](./programs-architecture-reset-plan.md)

---

## Decisions locked (July 2026)

| # | Decision |
|---|----------|
| 1 | **Explicit inherit toggles** per group (not null-means-inherit) |
| 2 | Customize groups: **dates**, **eligibility**, **enrollment types + waitlist**. Schedule, staff, fees, capacity/groups, delivery stay offering-only |
| 3 | Program defaults edited on **Program detail → Settings → General** |
| 4 | **Existing offerings = overridden** (`inherit_* = false`) so current values stay; no surprise re-inheritance |
| 11 | After F1 helpers: build **program defaults + slim offering create** (F2/F3) before teacher page / reports |
| 12 | **Program kinds:** `academic` (year + offerings) vs `seasonal` (camp/season as one product). Same Programs menu; different create + settings chrome. SQL **`193`**. |
| 13 | **Department is home** for dept-linked years/seasons: manage at `/workforce/departments/[id]/programs/[programId]/offerings/[offeringId]` so HR → Departments stays selected; legacy Programs-module URLs redirect. |

## Decisions locked (August 2026) — Academic vs Seasonal product modes

Shared Programs domain + registration/payment infra; two modes with distinct create/config/features/validation/terminology/reports. Hide + reject incompatible options by kind.

| # | Decision |
|---|----------|
| A1 | Seasonal may have **multiple offerings** (age/gender bands) |
| A2 | Gate by `program_kind` (not separate feature packs) for now |
| A3 | Org entitlement: `organizations.program_kinds` = `academic` \| `seasonal` \| `both` (SQL **`246`**, default `both`) |
| A4 | **Hard API validation** (not UI-only) via `lib/programs/program-kind-policy.ts` |
| A5 | Terminology per mode via `getHierarchyLabels` / `getReportHierarchyLabels` (**Phases 2 + 5**); **no DB rename** yet |
| A6 | Reports: shared engine + **Type** filter, kind-aware labels, and URL presets `?kind=` (**Phases 2–4**); not two report systems |

**Phase 2 create chrome:** Department Programs catalog uses separate **Add Year** / **Add Season** CTAs (kind locked in dialog). Academic year → Add offering locks kind. `/programs/create?kind=` locks the create wizard.

**Phase 3 report Type filters (Aug 2026):** Enrollments, Add-ons, and org Transactions join Registrations + Payment Summary — each has Type (Academic/Seasonal), kind-scoped Year/Season + Offering/Program option lists, and kind-aware column labels. Transactions hide donation rows (`programKind === null`) when a Type is selected.

**Phase 4 report presets (Aug 2026):** Type filter syncs to `?kind=academic|seasonal` (`useProgramKindReportPreset`); Programs report nav preserves the preset across tabs. Attendance + Waitlist gain the same Type filter + kind-aware offering labels.

**Phase 5 terminology polish (Aug 2026):** Known-kind staff surfaces use `getHierarchyLabels` — program create/edit form, year configure dialog, year defaults settings, offerings section, program detail header actions, registration detail, department year breadcrumb.

**Phase 6 packaging UI (Aug 2026):** Org entitlement `organizations.program_kinds` editable from Platform Admin → Organizations → Modules under **Programs** (independent Academic and Seasonal toggles; at least one required) and tenant **Billing** (org super-admin dropdown card). API `PATCH /api/platform/organizations/[id]/program-kinds`. Run SQL **`246`**.

**Policy defaults:** Academic → full-program registration only; monthly / semester-style fee plans. Seasonal → full-program + selected sessions + day pass (+ drop-in); one-time / deposit / per-session / installments — **no monthly academic tuition**.

Inherit columns (F1): `inherit_dates`, `inherit_eligibility`, `inherit_enrollment` on `program_offerings`.  
New offerings default `true`; migration backfills existing rows to `false`. Seasonal programs hide inherit toggles (leaf is the top-level product UI).

**Resolution:** `effective = offering.inherit_X ? program.default : offering.value`

---

## Locked principles

1. **Program** = year/season identity + **defaults** (who can join, when registration is open).  
2. **Offering** = class / track / camp week (when it meets, who teaches, seats, price).  
3. **Inherit by default; override when needed** — staff should not re-enter the same eligibility/dates for every offering.  
4. **One module, feature packs** — show camp capacity groups when used; hide them for simple adult classes.  
5. **Empty programs allowed** — Education can exist with 0 offerings until ready.  
6. **Three surfaces:** admin setup · reports · teacher class page (roster / attendance; grading later).

```text
Department
  └── Program (year / season / camp series)
        ├── Defaults: dates, eligibility, enrollment types, waitlist, packs
        └── Offerings (0..n)
              ├── Always: name, status, schedule/sessions, staff, fees
              ├── Optional override: dates, eligibility, enrollment types, waitlist
              └── Packs: capacity groups · care · attendance · delivery
```

**Resolution rule (target):** for each inheritable field group,

`effective = offering.override_enabled ? offering.value : program.default`

Registration, capacity checks, and customer UI must use **effective** values.

---

## Department scenarios (reference)

| Scenario | Example | Typical pattern |
|----------|---------|-----------------|
| **Quran Institute – Ladies** | Academic year 2026–2027, many classes | Program holds gender, ages, year dates, enrollment window. Offerings = levels/times/teachers. Overrides rare (e.g. one-month intensive). |
| **Education** | After-school + weekend | Program holds season/year and shared enrollment types. Offerings often **differ by age/grade**. Overrides of eligibility are **common**. |
| **Recreational camps** | Multi age-pool camps | Program holds camp dates and registration model. Offerings = weeks/tracks. **Capacity groups** (age/grade × gender) are first-class. Sessions matter. |

---

## Ownership legend

| Code | Meaning |
|------|---------|
| **P** | Set on **program** (defaults / policy). Copied into new offerings; remains source when offering inherits. |
| **O** | Set on **offering** only (not inherited). |
| **O\*** | On offering, but **inherits from program** until Customize / override is on. |
| **Pack** | Feature pack — available to all; prominent only when enabled or when data exists. |

---

## Field matrix

Columns **QI / Edu / Camp** = how often that layer is the *primary* place staff edit the field for that scenario (`●` primary, `○` sometimes, `–` rare/hidden).

### A. Identity & navigation

| Field / group | Owner | QI | Edu | Camp | Notes |
|---------------|-------|----|-----|------|-------|
| Department | P (via program) | ● | ● | ● | Org structure; not a second programs engine |
| Program name, description, flyer, visibility | P | ● | ● | ● | Catalog identity |
| Offering name, status, type label | O | ● | ● | ● | Class / track / week label; Type is display-only |
| Delivery (in person / online / hybrid) | O | ○ | ○ | ○ | Separate offerings when online vs on-site |

### B. Term & enrollment window

| Field / group | Owner | QI | Edu | Camp | Notes |
|---------------|-------|----|-----|------|-------|
| Program / season dates (`start`–`end`) | P → O\* | ● | ● | ● | QI/Education: year/season. Camps: camp run. One-month offering = override dates. |
| Enrollment opens / closes | P → O\* | ● | ● | ● | Same inherit/override pattern |
| Registration status (Open/Closed) | Derived | ● | ● | ● | From effective enrollment window (not a stored enum for this purpose) |

### C. Eligibility

| Field / group | Owner | QI | Edu | Camp | Notes |
|---------------|-------|----|-----|------|-------|
| Audience (adult / youth) | P → O\* | ● | ● | ● | Adult QI vs youth camps/after-school |
| Min / max age | P → O\* | ● | ○ | ○ | QI: usually program-wide. Education/camps: often per offering |
| Grade levels | P → O\* | – | ○ | ● | Youth; camps + Education |
| Gender restriction | P → O\* | ● | ○ | ○ | Ladies QI: program default. Others as needed |
| Require guardian / emergency contact | P → O\* | ○ | ○ | ● | Derived/policy; youth-heavy |

### D. Enrollment types & waitlist

| Field / group | Owner | QI | Edu | Camp | Notes |
|---------------|-------|----|-----|------|-------|
| Enrollment types (Entire / Selected sessions / Single) | P → O\* | ● | ● | ● | Multi-select. Drop-in not in primary UI |
| Waitlist on/off (+ optional waitlist cap) | P → O\* | ● | ● | ● | Cap may stay with capacity UI |
| Waitlist offer deadline (days) | P → O\* | ○ | ○ | ○ | Seat-offer pipeline |

### E. Capacity

| Field / group | Owner | QI | Edu | Camp | Notes |
|---------------|-------|----|-----|------|-------|
| Simple capacity (unlimited / limited N) | O | ● | ● | ○ | Typical for a single class |
| Capacity groups (grade/age × gender pools) | O (**Pack**) | – | ○ | ● | Camps primary; optional for Education multi-pool |
| Currently enrolled | Derived | ● | ● | ● | Per offering (and per group when groups used) |

### F. Schedule & sessions

| Field / group | Owner | QI | Edu | Camp | Notes |
|---------------|-------|----|-----|------|-------|
| Weekly class times | O | ● | ● | ○ | QI + Education class page |
| Sessions / weeks / occurrences | O | ○ | ○ | ● | Camps + session registration |
| Before & after care → **Childcare** (feature pack) | O (**Pack**) | – | – | ○ | Long-day camps / optional |

### G. Staff, fees, FA

| Field / group | Owner | QI | Edu | Camp | Notes |
|---------------|-------|----|-----|------|-------|
| Instructors / counselors | O | ● | ● | ● | Drives teacher class-page access |
| Fee plans / pricing | O | ● | ● | ● | Always sellable-instance scoped |
| Financial assistance | P (program-level) | ● | ● | ○ | Keep FA at program (current decision) |

### H. Attendance & teacher workspace

| Field / group | Owner | QI | Edu | Camp | Notes |
|---------------|-------|----|-----|------|-------|
| Attendance tracked (policy) | P → O\* | ● | ● | ○ | Enables class page attendance |
| Teacher class page: roster | Surface | ● | ● | ● | Offering-scoped; no setup forms |
| Teacher class page: attendance | Surface | ● | ● | ○ | When tracked |
| Basic grading / notes | Future surface | ○ | ○ | – | Same class page later; not blocking v1 |

### I. Reports (office)

| Report | Scope | QI | Edu | Camp | Notes |
|--------|-------|----|-----|------|-------|
| Enrolled students | Department Rosters (+ year/season & program filters) | ● | ● | ● | Roster across classes; was year/season Reports |
| Capacity / fill / waitlist | Program + offering | ● | ● | ● | Groups matter for camps |
| Payments / FA | Program (existing) | ● | ● | ○ | Stay on current FA / billing paths |

---

## Scenario cheat sheets

### Quran Institute – Ladies

| Set once on program | Per offering | Override when |
|---------------------|--------------|---------------|
| Academic year dates, enrollment window | Name, weekly times, teacher, capacity, fees | Short intensive with different dates |
| Female + age rules, enrollment types, waitlist defaults | Delivery if online section exists | Rare eligibility exception |

### Education – after-school / weekend

| Set once on program | Per offering | Override when |
|---------------------|--------------|---------------|
| Season/year dates, enrollment types | Name, days/times, teacher, capacity, fees | **Different age/grade band** (common) |
| Shared waitlist defaults | Optional capacity groups if multi-pool | Different enrollment window for a late-start track |

### Recreational camps

| Set once on program | Per offering | Override when |
|---------------------|--------------|---------------|
| Camp date range, enrollment window/types | Week/track name, sessions, **capacity groups**, fees, staff | Junior vs senior eligibility; partial-week offering |

---

## UI contract (when we implement)

1. **Program settings** — one place for defaults (dates, eligibility, enrollment types, waitlist, attendance pack).  
2. **Add offering** — minimal: name, schedule, staff, capacity/fees; badge **Using program defaults**.  
3. **Customize** — expands inheritable groups only for that offering.  
4. **Feature packs** — Capacity groups / Care / Attendance visible when on or when data exists.  
5. **Teacher class page** — roster + attendance only; never Eligibility/Fees editors.  
6. **Do not** build separate Quran / Education / Camp modules.

---

## Implementation phases (after this contract is accepted)

| Phase | Work | Outcome |
|-------|------|---------|
| **F1** | Define inherit/override flags + effective-value helpers (read path) | **Done** — run `180`; helpers in `program-offering-inherit.ts` |
| **F2** | Program defaults settings UI + seed new offerings from defaults | **Done** — Program detail → **Settings → General**; `saveProgramEnrollmentDefaults` + `syncInheritingOfferingsFromProgram` |
| **F3** | Slim offering create/edit + Customize toggles | **Done** — Add offering inherit switches; Enrollment tab Customize (use program …) |
| **F4** | Feature-pack visibility (capacity groups, care, attendance) | **Done** — Overview packs: `attendance_tracked`, `care_enabled`; care panel gated; youth capacity groups unchanged (auto) |
| **F5** | Teacher class page (roster → attendance) | **Done** — `/my-classes/[offeringId]` roster + attendance when tracked (`program_attendance`, SQL `181`); assigned-staff enrollment SELECT via **`183`** |

**SQL:** `180` (inherit flags), `181` (care pack + `program_attendance`), **`183`** (assigned staff roster RLS).

**Key F2–F6 files:** `program-defaults-settings-panel.tsx`, `program-detail-client.tsx`, `my-class-detail-client.tsx`, `program-attendance-queries.ts`, `program-attendance-actions.ts`, department Rosters (`department-participants-panel.tsx` — enrollments report merged from year/season Reports), offering Overview feature packs.

**F7 polish (July 2026):** Department Add offering inherit toggles; customer registration uses effective inherit dates; program detail `?tab=settings|offerings` (Reports enrollments → department Rosters); class attendance marks viewed under **Programs → Reports → Attendance** (`OfferingClassAttendancePanel`).

---

## Open decisions (resolve in F1)

~~1–4, 11~~ — **Locked July 2026** (see [Decisions locked](#decisions-locked-july-2026) above).

Remaining (defer to F4–F5 unless needed earlier):

- Catalog/customer display when all offerings inherit the same eligibility
- Program-level capacity group templates (v1 = offering-only)
- Feature pack on/off (auto + optional toggle)
- Teacher access & class page URL / F5 scope

---

## Acceptance

This document is the flexibility contract. Code changes to enrollment/eligibility ownership should follow the matrix above and the scenario cheat sheets — not ad-hoc per-department forms.
