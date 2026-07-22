# Programs architecture simplification (Program → Offering)

**Status:** S1–S6 in repo (July 2026) — run `176` → `179`. Obsolete program eligibility/capacity columns kept for dual-read; drop later after RPCs fully move off them.  
**Related:** [programs.md](./programs.md), [programs-architecture-reset-plan.md](./programs-architecture-reset-plan.md), [programs-registration-pipeline-design.md](./programs-registration-pipeline-design.md), [programs-flexibility-contract.md](./programs-flexibility-contract.md) (inherit/override + QI / Education / camps matrix — planning)

---

## Decisions (locked)

| # | Topic | Decision |
|---|--------|----------|
| 1 | Program dates | Keep as **optional defaults**; new offerings inherit; offerings can override |
| 2 | Offering Type | **Keep** with simple language (`Type` in UI). Values remain term/shape labels, **not** behavioral controllers |
| 3 | Audience type | **Adult** and **Youth** only — drop **Family** as a program/audience type |
| 4 | Capacity groups | Move to **offering** level |
| 5 | Schedule | **One** schedule system on the **offering** (retire program-primary weekly editor) |
| 6 | Empty programs | Allow **Program with 0 offerings** (catalog container only; e.g. open community listing until offerings exist) |
| 7 | Approach | **Schema migration first** (B), then UI — before deeper registration-pipeline build |

### Core principle

Do **not** invent mutually exclusive program types (Academic year × Adult × Paid × …).

```text
Program     → identity / branding / department / visibility / optional defaults
  └── Offering → independent attributes that combine freely
```

---

## Target ownership

### Program (identity + optional defaults)

Keep:

- name, subtitle, description  
- department_id  
- flyer / cover, background / title / subtitle colors  
- public slug (if present), visibility, status  
- tags / categories (as available)  
- **optional** `start_date`, `end_date`, `enrollment_open_date`, `enrollment_close_date` — defaults for new offerings only  
- optional **default** audience / capacity / attendance / delivery / **waitlist offer deadline (days)** hints that offerings inherit at create time (overridable)

Remove from Program as **authoritative** behavior (migrate off, then stop writing):

- eligibility SSOT (ages, grades, gender, require_*)  
- capacity / waitlist SSOT + capacity groups  
- registration mode flags as SSOT (`full_program_registration_enabled`, `session_registration_enabled`)  
- legacy `billing_*` as SSOT (fee plans already on offering)  
- weekly schedule SSOT (`program_schedule_items` as program-only)

### Offering (operational attributes)

| Attribute | Target model |
|-----------|----------------|
| **Type** (keep) | Simple label: Standard, Academic year, Summer, Season, Recurring — display/filter only |
| **Audience** | Adult \| Youth (no Family); ages; optional grade range; gender when needed; require guardian / emergency contact as flags |
| **Term** | Dates (+ Type label); do not invent separate type systems for Fall/Winter/Spring unless added later as Type options or tags |
| **Registration mode** | Required \| Optional \| None — plus existing option types (full program / sessions / drop-in) where registration applies |
| **Pricing** | Free \| Paid via fee plans (required charges, add-ons, registration fee, installments, discounts) |
| **Capacity** | Unlimited \| Limited (+ amount); waitlist on/off (+ optional waitlist cap); **capacity groups** on offering; catalog program card uses **sum of limited offering capacities** |
| **Schedule** | One area: sessions / occurrences / recurrence on offering |
| **Attendance** | Tracked \| Not tracked (new policy field) |
| **Delivery** | In person \| Online \| Hybrid (new field) |
| **Waitlist offer deadline** | **Customizable** per offering (optional program default for new offerings) — used when a seat opens and an auto-offer is sent |

---

## Schema migration plan

Suggested script series: `176` (S1), `177` (S2), `178_program_schedule_items_offering.sql` (S3), then S4 app-only / later cleanup.

### Phase S1 — Offering attribute columns ✅

Add to `program_offerings` (nullable first, then backfill):

| Column | Purpose |
|--------|---------|
| `audience_type` | `'adult' \| 'youth'` (no family) |
| `min_age`, `max_age` | Bounds |
| `min_grade`, `max_grade`, `grade_levels` | Youth |
| `gender` | Optional restriction |
| `require_guardian`, `require_grade`, `require_emergency_contact` | Flags |
| `capacity_mode` | `'unlimited' \| 'limited'` |
| `capacity` | When limited |
| `enable_waitlist`, `waitlist_capacity` | Waitlist policy |
| `waitlist_offer_deadline_days` | Days to accept a seat offer (customizable; nullable → inherit program default if set) |
| `registration_mode` | `'required' \| 'optional' \| 'none'` |
| `attendance_tracked` | boolean |
| `delivery_format` | `'in_person' \| 'online' \| 'hybrid'` |

Also on `programs`: `waitlist_offer_deadline_days` (optional default for new offerings).

Keep existing: `offering_type`, dates, enrollment window, status, `is_default`.

**Backfill:** For each offering, copy from parent `programs` row (audience, capacity, waitlist, require_*).  
`audience_type`: map `program_type` `adult`/`youth`; map `family` → `youth`.  
`capacity_mode`: `unlimited` if capacity is 0/null; else `limited`.  
`registration_mode`: derive from registration flags (`none` if no options enabled).  
`attendance_tracked`: default `false`.  
`delivery_format`: default `in_person`.

**App (S1):** Types + create/duplicate/year-copy inherit attributes; Registration panel dual-writes program + offering until S4.  
**SQL:** `scripts/176_program_offering_attributes.sql`  
**TS:** `lib/programs/program-offering-attributes.ts`, `program-offering-types.ts`, `program-offering-actions.ts`, `offering-workspace-actions.ts`

### Phase S2 — Capacity groups → offering ✅

- Add `offering_id` to `program_capacity_groups` (required after backfill).  
- Backfill: assign groups to **default offering** of each program (else first active offering).  
- App: `getOfferingCapacityGroups` / replace by `offering_id`; catalog `programs.capacity` synced as **sum of limited offerings**.  
- Duplicate / year-copy / catalog-duplicate copy groups per offering.  
**SQL:** `scripts/177_program_capacity_groups_offering.sql`  
**TS:** `program-capacity-group-actions.ts`, `program-capacity-group-queries.ts`, offering manage page, registration panel.

### Phase S3 — Schedule → offering ✅

- Add `offering_id` to `program_schedule_items` (required after backfill).  
- Backfill: attach existing items to default offering.  
- Offering Schedule tab edits weekly slots via `OfferingWeeklyScheduleEditor` (`program_schedule_items`).  
- `/programs/schedule?program=` redirects to that offering’s Schedule tab; bare `/programs/schedule` keeps the org `schedule_activities` calendar.  
- Sessions remain offering-scoped (unchanged).  
- Duplicate / year-copy copy weekly schedule items.  
**SQL:** `scripts/178_program_schedule_items_offering.sql`  
**TS/UI:** `program-schedule-actions.ts`, `program-schedule-queries.ts`, `offering-weekly-schedule-editor.tsx`, department schedule links.

### Phase S4 — Stop dual writes ✅

- `saveOfferingRegistrationPanel` writes **offering** columns only (no program eligibility/capacity/flags).  
- Program create: **no** auto default offering (0 offerings allowed). First offering becomes `is_default`.  
- Program detail: **Add offering** dialog CTA when empty.  
- `updateProgram` defaults to identity + optional defaults + FA only; does **not** write `billing_*` / waitlist / registration flags.  
- Catalog duplicate explicitly seeds a default offering when copying.  
- Create form: eligibility = optional defaults only; no fee plans at create.  
**No new SQL** — app-only.  
**TS/UI:** `program-actions.ts`, `offering-workspace-actions.ts`, `save-edit-program.ts`, `program-detail-client.tsx`, `program-form.tsx`.

### Phase S5 — Drop Family ✅

- Stop accepting `family` in staff types/APIs (`ProgramType` / `program_type` = adult \| youth).  
- Writes normalize via `normalizeProgramAudienceType` (`family` → `youth`).  
- SQL `179_drop_program_type_family.sql`: backfill + CHECK; `register_for_program` uses offering `audience_type` (fallback program type) and never writes `participant_type = family`.  
- Historical enrollments may still show `participant_type = family` (read-only legacy).  

### Phase S6 — Cleanup ✅

- Catalog cards/table: capacity from **sum of limited offerings** via `getCatalogCapacityByProgramIds`; if none limited → **Unlimited**.  
- Offering manage / program detail / registration panel read capacity (and eligibility) from the **offering**, not `programs.capacity`.  
- Department year / department create still default `offering_type = academic_year` as a **Type label only**.  
- **Deferred:** dropping obsolete program eligibility/capacity columns (keep dual-read until registration RPCs fully use offerings).  
**No new SQL** — app-only.  
**TS/UI:** `program-catalog-capacity.ts`, `program-offering-queries.ts`, catalog page, `offering-manage-client.tsx`, `program-detail-client.tsx`, `offering-registration-panel.tsx`.

---

## UI changes (after schema)

### Program create / detail

- Identity + branding + department + visibility + status.  
- Optional default dates (and optional default attribute presets).  
- Offerings list may be empty; CTA **Add offering**.  
- No requirement to create a default offering on save.

### Offering manage tabs (current)

| Tab | Content |
|-----|---------|
| Overview | Name, **Type**, **Delivery** (in person / online / hybrid), status, term dates, capacity summary |
| Enrollment | Registration options + eligibility + capacity/waitlist; fee plans; sessions + weekly schedule; waitlist queue. **Financial assistance stays on the program.** |
| Staff | Unchanged |
| Attendance | Attendance report + childcare |

Legacy deep links (`?tab=registration|fees|schedule|waitlist|care`) normalize to Enrollment or Attendance.

### Remove / demote

- Treating Type as controlling pricing, capacity, or registration.  
- Program Registration tab that edits program-row eligibility under an offering URL.  
- Family as a selectable audience type.  
- Separate “program schedule builder” as primary path.

---

## Interaction with registration pipeline

The [registration pipeline design](./programs-registration-pipeline-design.md) assumes offering-level capacity, waitlist, and registration mode. **Complete S1–S4 (or at least S1–S2 + registration_mode)** before building apply → approve → register against the wrong owner.

Suggested order:

1. This simplification migration (S1–S4)  
2. Reports: Registrations + Payment transactions tabs  
3. Registration pipeline (apply / evaluate / waitlist / FA / register)

---

## Risks

| Risk | Mitigation |
|------|------------|
| RPCs still use `programs.capacity` / enrolled | Dual-write offering → program aggregates during transition; update RPCs in same release as S2 |
| Programs with multiple offerings share one capacity today | Backfill to default offering; staff must re-check capacity per offering after migrate |
| Empty programs break customer links | Public program page: “no offerings yet” vs hide from catalog when visibility requires an active offering |
| Family enrollments in the wild | Normalize carefully; don’t delete historical enrollments |

---

## Open for implementation kickoff

1. ~~Catalog card capacity~~ → **Sum of limited offerings** (S6 catalog display live from offerings).
2. ~~Waitlist offer deadline~~ → **Customizable** per offering (+ program default).
3. ~~SQL file number~~ → **`176`–`179`**. Migration phases complete through S6 (column drop deferred).

---

## Success criteria

- Staff can configure two offerings under one program with **different** audience, capacity, registration mode, and schedule without fighting Program-level fields.  
- Type is a simple label only.  
- Adult/Youth only in new UI.  
- Program can exist with **zero** offerings.  
- One schedule editor, on the offering.  
- Capacity groups scoped to offering.
