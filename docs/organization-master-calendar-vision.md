# Organization Master Calendar — Architecture Vision

**Status:** Planning only — **do not implement yet.**  
**Last updated:** July 2026

This document defines the intended architecture for an organization-wide **Master Calendar**. It is separate from the **Facilities Calendar** (physical space / `resource_reservations`).

---

## Purpose

The Organization Master Calendar is the organization’s central **scheduling and collaboration** calendar.

It is **not** for managing rooms or facilities. It helps departments:

- Coordinate activities across the org
- Avoid competing major events
- Increase visibility of important work

### Examples (often no community-center space)

| Example | Why it belongs on Master Calendar |
|--------|-----------------------------------|
| Fund Development schedules a fundraising dinner at a hotel | Org-wide audience / marketing / leadership impact |
| Quran Institute schedules an online open house | Cross-department awareness |
| Youth plans a large community event | Attendance / staffing / marketing load |
| Administration schedules an all-staff meeting | Leadership and staff commitment |
| Leadership blocks a strategic planning retreat | Availability and planning conflicts |

Even when none of these require a room inside the community center, they should still appear on the Master Calendar so every department can see major organizational activities.

---

## Two calendars, two purposes

| | **Facilities Calendar** | **Organization Master Calendar** |
|--|-------------------------|----------------------------------|
| **Owns** | Physical space | Organizational awareness |
| **Goal** | Prevent room conflicts | Help departments coordinate |
| **Examples** | Room reservations, venue rentals, classroom program sessions, building closures, maintenance, setup/cleanup | Internal/external/online events, major programs, leadership meetings, community initiatives, deadlines, staff training, holidays, org closures |
| **Enforcement** | Hard conflict rules on occupied windows | Soft collaboration; awareness first |
| **Nav home** | Facilities module | Global / main navigation (not under Facilities) |
| **Today’s foundation** | `resource_reservations` + program session expand | *Not built yet* (this doc) |

The two systems should **work together without being tightly coupled**.

---

## Relationship with Facilities

Some activities need facilities; some do not.

| Activity | Master Calendar | Facility Booking |
|----------|-----------------|------------------|
| Parenting workshop at the center | Yes | Yes (one or more space bookings) |
| Fundraising dinner at a hotel | Yes | No |
| Online staff meeting | Yes | No |

**Principle:** Appearing on the Master Calendar must **not** require a facility booking. Creating a facility booking must **not** automatically force Master Calendar visibility (and vice versa)—each path is explicit where it matters.

---

## Calendar sources

The Master Calendar should eventually receive entries from multiple modules, for example:

- Event Management
- Programs (**major milestones / events only**, not every weekly class)
- Venue Rentals (**only when appropriate**)
- Manual calendar entries
- Organization closures
- Future modules as needed

### Opt-in from source modules

**Not every record from every module should automatically appear.**

- A weekly classroom session usually does **not** need org-wide visibility.
- A major summer camp kickoff probably **does**.

Each source module should be able to decide whether a given record appears on the Master Calendar (flag, policy, or explicit “publish to Master Calendar” action). Prefer **reusing source records** over duplicating full domain data.

---

## Department collaboration

The calendar should help answer questions such as:

- Is another department holding a major event that day?
- Are we targeting the same audience?
- Is leadership already committed elsewhere?
- Are we asking marketing to support multiple major events at once?
- Should we reschedule to avoid attendance conflicts?

**Intent:** improve communication and awareness — not enforce hard scheduling rules (v1).

---

## Department calendar views

Every department should have a **filtered view** of the **same** underlying Master Calendar (not a separate calendar store).

Examples: Education, Youth, Quran Institute, Fund Development, Administration.

Typical behavior:

- Primary focus: that department’s own activities
- Also visible: organization-wide items that may affect planning

---

## External and online events

Master Calendar entries must support activities that do **not** occur in organization facilities, including:

- Hotel / park / festival / outreach locations
- Online / Zoom / hybrid sessions
- Conference attendance
- Booths and community partnerships

These appear on the Master Calendar **without** creating facility bookings.

---

## Manual calendar items

Users should create simple entries that are **not** owned by another module, for example:

- Board meeting
- Important deadline / grant submission
- Leadership retreat
- Community holiday
- Staff appreciation day
- Conference

These must **not** require a full Event Management record.

---

## Event visibility

Not every activity should be organization-wide. Support visibility levels such as:

| Level | Intent |
|-------|--------|
| **Private** | Limited to creator / explicit people |
| **Department only** | Visible within one department |
| **Organization-wide** | Visible across the org on Master Calendar views |

Routine departmental work stays uncluttered; major activities stay visible to everyone who needs them.

---

## Future conflict awareness (later)

v1: visibility and collaboration only.

Later (without redesigning the foundation), the system may help identify:

- Overlapping major events
- Shared audience conflicts
- Shared staff conflicts
- Leadership availability
- Major organizational scheduling conflicts

Still framed as **awareness / soft guidance**, not Facilities-style hard blocks—unless product later chooses otherwise for specific item types.

---

## Navigation

- **Organization Master Calendar:** global feature in main application navigation.
- **Not** owned by the Facilities module.
- Facilities keeps its own operational calendar for spaces and room availability.

---

## Implementation principles

1. Keep Master Calendar **independent** from facility scheduling (`resource_reservations` stays Facilities-owned).
2. **Reuse** source data from existing modules; avoid duplicate domain records.
3. Allow **multiple modules** to contribute entries (opt-in per record).
4. Support **external, online, hybrid, and facility-based** activities.
5. Keep **v1 simple**: visibility and collaboration.
6. Design so later conflict detection, approvals, notifications, and cross-department planning can be added **without redesigning the foundation**.

---

## Suggested architectural shape (for when we build)

*Illustrative only — final schema TBD at implementation time.*

### Conceptual model

- **Master calendar entry** (or a thin projection / link table) with:
  - `organization_id`
  - title, start/end (or all-day), timezone
  - location mode: `on_site` | `off_site` | `online` | `hybrid` | `none`
  - optional free-text / URL location (hotel, Zoom, park)—**not** required to be a `venues` row
  - owning `department_id` (nullable for org-wide / admin items)
  - visibility: `private` | `department` | `organization`
  - `source_module` + `source_id` (nullable for manual items)
  - flags such as `show_on_master_calendar` (or equivalent) when sourced from another module
  - optional soft links to facility bookings (IDs only)—never the same table as Facilities schedule

### Views

- Org Master Calendar (organization-wide + permitted items)
- Department filtered views (same store, filtered by department + org-wide overlay)
- Source modules remain authoritative for their full workflows

### Explicit non-goals for v1

- Do not merge into `/facilities/calendar`
- Do not auto-publish every program session or every rental
- Do not require Event Management for simple manual items
- Do not implement hard Master Calendar conflict blocking

---

## Contrast with current Facilities work (context)

As of July 2026, shared **facility** scheduling is centered on `resource_reservations` (rentals, internal events with venues, holds, closures, maintenance) plus expanded program sessions for **room** conflict prevention. That work continues under Facilities / Venue Rentals / Events / Programs.

This Master Calendar vision is a **second layer** for org collaboration and must stay product-separated even if some Event Management records appear in both places when both a facility booking and Master visibility are chosen.

---

## Open questions (resolve at implementation)

1. Where does global nav place Master Calendar (top-level item vs Dashboard child)?
2. Who can create manual items vs publish module records to Master Calendar?
3. Default visibility for Event Management creates?
4. Which Venue Rentals (if any) auto-suggest Master Calendar publish?
5. Programs: which entity is published (offering milestone, one-off event, registration window)?
6. Holidays / org closures: Master-only, Facilities-only, or both with explicit sync?

---

## Related docs

- Facilities shared scheduling notes: `docs/Features.md` (Bookings Calendar / shared scheduling foundation)
- Facilities schema: `docs/Database_Overview.md` (`resource_reservations`, venues, program schedule `venue_id`)
