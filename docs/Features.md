# FEATURES.md

# Feature Documentation

This document contains implementation notes and feature history for major Manaratee modules.

---

# Authentication

## Login Page

Status: Complete

### Improvements

* Increased logo size
* Removed footer links
* Improved mobile branding
* Kept responsive layout

### OAuth

Implemented:

* Google OAuth

Planned:

* Apple OAuth

### OAuth Flow

Uses:

* Supabase Authentication
* OAuth callback route
* Google Cloud OAuth credentials

### Password reset

* Route: `/forgot-password` — request reset email
* Route: `/auth/set-password` — set new password after email link
* Route: `/auth/confirm` — server-side `token_hash` exchange for recovery (see `docs/Known_Issues.md` for Supabase email template)

---

# Roles, Permissions & Access Control

Status: Complete

## Architecture

Platform Owner:

* owner role reserved for platform owner

Organization Roles:

* organization_roles
* custom role names
* organization-specific permissions

Organization Members:

* organization_members.role
* organization_members.role_id

Permissions:

* role_permissions

---

## Features

Completed:

* Users page rebuilt
* Roles & Permissions page rebuilt
* Permission matrix
* Server-side protection
* Unauthorized page
* Permission-aware sidebar
* **Tiered staff navigation (July 2026):** Primary sidebar (`180px`, icon + label). **Manaratee logo** sits at the top of the sidebar (upper left, large). Organization logo on the far right of the header bar. Sidebar nav starts below the logo band + breadcrumb spacer so **Dashboard** aligns with the breadcrumb row (`Dashboard > …`). Breadcrumb path sits on the row below the header. **Department workspace (July 2026):** `/workforce/departments/[id]` appends the department name on the **header** trail (`Dashboard > Programs/ Events > Departments > Education`) via `Header` `breadcrumbExtras` — no second in-page breadcrumb. **Page breadcrumbs (July 2026):** In-page trails (above page titles) use the same chevron style as the header (`Education > Program Name`) via shared `PageBreadcrumbs` (`components/navigation/page-breadcrumbs.tsx`). Parent segments are clickable so staff can step back to department, list, or module roots. Applied on Vendor Hub / Event Management shells, employee/group detail pages, and similar detail surfaces. **Offering manage** uses `Header` `breadcrumbExtras` (same pattern as department workspace) — single header trail only. Clicking a module opens a slide-out drawer with expandable groups; choosing a destination navigates and closes the drawer. **Module order (August 2026):** Dashboard → Contacts → **Programs/ Events** → Membership → Donations → Venue Rentals → Vendor Hub → **Community Calendar** (shared top-level when Vendor Hub and/or Event Management is enabled; `/community-calendar`) → **Facilities** (module slug `spaces`; formerly Bookings / Facility Manager) → Billing → Settings. **Facilities submenu:** Overview, Reservation Center, Calendar, Inventory, **Settings** (tabs: Spaces, Setup Styles at `/facilities/settings/*`). **Spaces cards (July 2026):** metric cards and filters removed; venues show in a 3-column card grid with color, flyer upload, description, capacity/location, and rentals badge (status removed from UI). Run **`scripts/204_venue_color_flyer.sql`**. **Per-day hours & rates (July 2026):** Edit Venue uses a Sunday–Saturday table (open toggle, start/end, flat, hourly) stored in `rental_space_pricing`; toggle label **Available for rental**. Optional seed from legacy peak/non-peak: **`scripts/205_seed_venue_day_pricing.sql`**. Membership is already implemented (`/membership`); if missing from the rail, enable it for the org (repair SQL `scripts/165_ensure_membership_sidebar.sql`, or Platform Admin → Organizations → modules). Flat list (no People/Operations regrouping). Shared chrome heights: `lib/layout/staff-dashboard-chrome.ts`. **Event Management visibility (July 2026):** Org-enabled modules always appear in the staff rail (sub-nav still permission-gated). Loader recovers missing `modules` embeds, normalizes slugs, and keeps product modules even if `is_active` was flipped off. Org **Super Admin** gets full sidebar permissions. Enabling a product module seeds Admin/Super Admin permissions. Repair script: `scripts/138_ensure_event_management_sidebar.sql`. Key files: `components/layout/sidebar.tsx`, `lib/organizations/load-organization-sidebar-modules.ts`, `lib/organizations/sidebar-nav-context.ts`, `lib/modules/organization-module-access.ts`.
* **Sidebar merge (August 2026):** Main sidebar top-level items **HR**, **Finance**, **Programs**, and **Event Management** are merged into one rail item **Programs/ Events**. Drawer order: **Departments** → **Program Catalog** → **Event Management** (nested **Events** + **Master Calendar**) → **Ticketing** → **Financial Assistance** → **Workforce** → **Reports** → **Settings**. **Departments** (`/workforce/departments`). **Program Catalog** (`/programs/catalog` — active offerings; no Calendar tab; offering flyer falls back to parent program flyer). **Schedule Builder** lives under **Department → Schedule → Activity planner** (`?tab=schedule&section=activity-planner`); **Class times** is the offering weekly rollup (shows booked **Space** from `venue_id`). Schedule CTAs: **Check space availability** → Facilities Calendar; **View Master Calendar** → Events Master Calendar (department-filtered). Legacy `/programs/schedule` and `/programs/calendar` redirect (schedule: `?program=` → offering Schedule / bare → Departments; calendar → `/facilities/calendar`). **Event Management** drawer group: **Events** (`/event-management`) + **Master Calendar** (`/event-management/calendar`) — no in-page section tabs. **Ticketing** / **Settings** (former Event Management group removed). **Reports** tabs: **Registration** | **Enrollments** | **Transactions** | **Add-ons** | **Payment Summary** | **Waitlist** | **Attendance** | **Child Care** | **Payroll**. **Workforce** tabs: **Employees** | **Volunteers** | **Childcare Providers**. Key files: `components/layout/sidebar.tsx` (`collapseProgramsAndEventsNavItems`, `buildProgramsAndEventsChildren`), `components/programs/programs-reports-nav.tsx`, `lib/navigation/sidebar-nav.ts` (`alsoMatchPrefixes`, `excludeMatchPrefixes`), `lib/hr/hr-module-label.ts`.
* Subscription-aware modules
* **Roles & Permissions subscription filter (June 2026):** Settings → Roles & Permissions only lists permission rows for modules enabled on the org (`lib/permissions/permission-definitions.ts`, filtered via `loadOrganizationEnabledModuleSlugs`). Core modules (Settings, Contacts) always appear; product modules (e.g. Donations only for MAS Dallas) gate their permission groups. **Facility Manager** and **Facility Coordinator** roles are hidden unless the org has **Facilities** (`spaces`) or **Venue Rentals** (`bookings`) enabled (`filterOrganizationRolesForOrganization` in `lib/permissions/facilities-access.ts`).
* **Event check-in permission (August 2026):** `events.checkin` lets door staff scan tickets and check attendees/youth in or out without `events.manage`. Manage / ticketing-manage still include check-in. Refunds, add attendee, transfer, promote, and settings stay manage-only. Door-staff roles should have **View Events** + **Check in attendees**. SQL **`257_events_checkin_permission.sql`**. Keys: `event-access.ts`, `permission-definitions.ts`.

* **Bookings Calendar merge (July 2026):** Under **Facilities** (module slug `spaces`; sidebar label **Facilities**), **Space Availability** and **Schedule** are a single sidebar item **Calendar** → `/facilities/calendar` (ops master calendar: full titles, blocks, event planning). **Shared scheduling foundation (July 2026):** Venue Rentals, internal Events, and Program sessions all feed one schedule — stored rows in `resource_reservations` (rentals/events/holds/closures/maintenance) plus **per-session expand** of `program_schedule_items` (not one long program block). Module calendars are filtered views of the same data via `?sources=` (`venue_rental`, `internal_event`, `program_facility`); Facilities Calendar (no filter) shows everything. Redirects: `/bookings/calendar` → Facilities `?sources=venue_rental`. **Events → Master Calendar** (`/event-management/calendar`) is the read-only department events calendar (+ **Create event** CTA to Facilities)—it does **not** redirect to Facilities Calendar. Legacy `/workforce/departments/calendar` redirects here. Programs sidebar **Calendar** removed (Aug 2026) — `/programs/calendar` redirects to Facilities. **Setup/cleanup:** `setup_minutes` / `cleanup_minutes` on `rental_reservations` and `internal_events` expand the occupied window written to `resource_reservations` (migration **`209_shared_scheduling_foundation.sql`**). Org defaults + optional per-space overrides for new rentals: migration **`222_venue_rental_setup_cleanup_buffers.sql`** (Venue Rentals → General + Facilities → Spaces). **Event location types (July 2026):** `internal_events.location_type` (`facility` | `online` | `external`) + `location_address` (migration **`210_internal_event_location_type.sql`**); online/external do not write facility calendar rows. **Programs ↔ venues:** optional `program_schedule_items.venue_id`; conflict checks on save use the shared facility schedule. **Basic vs advanced Facilities:** enabling Venue Rentals, Events, or Programs implies `spaces` (calendar + space settings + conflict checking); Overview / Reservation Center / Inventory stay advanced (shown when Venue Rentals is enabled). Shared venue picker: `components/reservations/facility-venue-select.tsx`. Separate rental / event / program forms preserved — no combined generic form. **Overview:** `/facilities/overview` is a **read-only** facilities landing for facility staff — **Confirmed rentals** + **Setup briefs needing review**. Approvals/payments stay in Venue Rentals. **Double-booking prevention:** rental submits, event creates, and program schedule saves check `resource_reservations` plus program sessions (prefer `venue_id`, fallback location name match). **Inventory:** `/facilities/inventory` — run **`207`** then **`208`**. **Setup Styles:** Facilities → Settings → Setup Styles. **Event Types:** Venue Rentals → Settings → Event Types. **Organization Master Calendar (planning only):** separate org-wide collaboration calendar (not Facilities). Vision doc: `docs/organization-master-calendar-vision.md` — do not implement until requested.

* **Ticketing reports (July 2026):** Real ticket analytics under **Event Management → Ticketing → Reports** (`/event-management/ticketing/reports`) — always-on KPIs plus a **View** filter (**Days** / **Events** / **Customers**) and date range; CSV export matches the active view. Data from `ticket_orders` + `tickets` (no mock data). Event Management module-level **Reports** removed — childcare registrations live under **Programs/ Events → Reports → Childcare**. Key files: `lib/tickets/ticketing-reports-queries.ts`, `components/tickets/ticketing-reports-client.tsx`.
* **Event workspace ticket types (August 2026):** Event → **Registration** tab (formerly Ticketing): sales open/close as separate **date** + **time**; registration offerings are Name / Price / Quantity. Enter/Tab on Quantity adds another row. Save via `updateInternalEventModules`.
* **Event workspace Attendees tab (August 2026):** Event → **Attendees** lists seats with counters (Registered / Checked in / Not checked in / Canceled / Waitlisted), filters, check-in / undo (`setEventTicketCheckIn`), **Promote** for waitlisted tickets when waitlist is enabled (`promoteWaitlistedTicket`), **Add attendee** manual registration (`addManualEventAttendee`), **Mark paid** for pending orders (`completePendingEventTicketOrder`), **Refund** (full remaining or partial) for completed / partially refunded paid orders (`refundEventTicketOrder`), and **View orders**. Auto-waitlist when capacity is full on `createTicketOrder` if waitlist toggle is on. Requires SQL **`253_event_youth_checkin_waitlist.sql`** for `waitlisted` ticket status. Key: `internal-event-attendees-tab.tsx`, `internal-event-add-attendee-dialog.tsx`, `ticket-order-queries.ts`, `ticket-order-actions.ts`.
* **Event workspace Registration offerings (August 2026):** Per-offering **Visibility** (public / unlisted / private), **Min / Max per order**, and optional **Sales start / end** dates on Registration tab (`event-ticketing-fields.tsx`, `ticket-types.ts`, migration **`252`**). Empty offering dates inherit the event sales window. `getTicketOfferingSaleStatus` enforces windows when `createTicketOrder({ enforceSaleWindows: true })` (public checkout path).
* **Event workspace Attendees — check-in & comms (August 2026):** **Scan / enter code** card checks in by ticket code (`checkInEventTicketByCode`) for staff with `events.checkin` or manage. Row actions: **Transfer** / **Resend** / **Refund** stay manage-only. Attendees tab prop fix: registration offerings no longer shadow the filter dropdown (`registrationOfferings` vs `ticketTypeFilterOptions`).
* **Event workspace Finance — campaign link (August 2026):** Optional **linked donations campaign** in `ticketing_config.linkedCampaignId`; Finance tab picker + pledge/gift summary (`event-finance-queries.ts`, `updateEventLinkedCampaign`, `internal-event-finance-tab.tsx`).
* **Event workspace Vendors — Vendor Hub (August 2026):** When the event is linked to a Vendor Hub bazaar, a banner shows hub links (`getVendorHubLinkForInternalEvent`, `vendor-hub-internal-event-queries.ts`).
* **Event workspace Reports — activity (August 2026):** **Recent activity** card on Reports and Overview (check-ins, new registrations, staff confirmations) via `buildEventRecentActivity` in `event-recent-activity.ts`.
* **Event workspace Overview — sharing & net (August 2026):** Community Calendar card shows **Copy link**, **Download QR**, and **Open page** when visibility is Public (`internal-event-community-calendar-card.tsx`). Overview **Event net** KPI includes linked campaign gifts when `ticketing_config.linkedCampaignId` is set.
* **Public event registration (August 2026):** Signed-in visitors complete registration on `/o/[orgSlug]/events/[eventId]` (`createPublicEventRegistration`, `public-event-registration-form.tsx`). Enforces per-offering sale windows, visibility, min/max per order, and waitlist. Free tickets complete immediately and send a confirmation email. Paid tickets: if the org Stripe Connect account is ready, redirect to Stripe Checkout (`startTicketStripeCheckout`); webhook `checkout.session.completed` with `metadata.manaratee_module=ticketing` marks the order completed and emails confirmation. If Connect/Stripe/app URL is missing, seats stay `pending` (pay at event) with a reservation email. Stripe success/cancel return to `/customer/tickets?checkout=…`. Private offerings stay off the public page. SQL **`255_ticket_order_stripe.sql`**. Keys: `ticket-stripe.ts`, `ticket-confirmation-email.ts`.
* **Customer My Tickets (August 2026):** Customer portal `/customer/tickets` lists the signed-in contact’s event orders with ticket codes, QR, status, **Complete payment** for pending paid orders (`resumeCustomerTicketCheckout`), and **Cancel reservation** for unpaid holds (`cancelCustomerPendingTicketOrder`, restores inventory). Fully refunded orders hide QR codes and show a “no longer valid” note. Partially refunded orders stay valid and show the refunded amount. Active tickets include **Download QR** (PNG file). Shown when Event Management or Ticketing is enabled. Stripe Checkout returns here. SQL **`256_customer_ticket_order_rls.sql`** (customer SELECT). Keys: `customer-ticket-queries.ts`, `customer-tickets-client.tsx`.
* **Event ticket Stripe refunds (August 2026):** Staff **Refund** on Attendees (completed or partially refunded paid orders) and Ticketing **Cancel/refund** call `refundEventTicketOrder`. Dialog supports **Full refund** (remaining balance) or **Partial refund** (custom amount). Stripe Connect charges refund that amount on the org account (`createStripeTicketRefund`); pay-at-event / staff **Mark paid** orders are refunded in the database only. Partial refunds keep tickets valid (`partially_refunded`). Refunding the remaining balance sets `refunded`, voids tickets, and restores inventory. Purchaser email uses `partial_refund` vs `refunded`. Webhook `charge.refunded` applies `charge.amount_refunded` (full or partial). Finance, overview, and ticketing reports use net remaining (`ticket_orders.refunded_amount_cents`). If Checkout completes after the order was already canceled, the charge is refunded instead of completing the order. SQL **`258_ticket_order_refunded_amount.sql`**. Keys: `ticket-stripe.ts`, `ticket-order-actions.ts`, `ticket-refund-math.ts`, `internal-event-refund-dialog.tsx`.
* **Event documents (August 2026):** Settings tab **Event documents** uploads PDFs/images (`event_documents`, SQL **`254_event_documents.sql`**, `program-flyers` storage). **Public** files appear on the community event page. Key: `event-document-actions.ts`, `internal-event-documents-card.tsx`.
* **Event communications overrides (August 2026):** Event Settings → **Communications** stores optional confirmation/reservation subject + extra message on `ticketing_config.communications`. Applied by `sendEventOrderConfirmationEmail` (public registration, Stripe complete, Mark paid, Resend). Keys: `internal-event-settings-workspace.tsx`, `ticket-confirmation-email.ts`, `ticket-types.ts`.
* **Event operational status (August 2026):** Derived phase (Draft, Scheduled, Registration open, Registration closed, In progress, Completed, Cancelled) from dates + sales window + workflow status — shown on workspace header badge and Overview KPI (`event-operational-status.ts`, `event-overview-metrics.ts`).
* **Event Workspace redesign (August 2026):** Tabs use progressive disclosure: **Overview | Registration | Attendees | Staff & Volunteers | Youth | Vendors | Finance | Reports | Settings** (hidden when module off). Features in `workspace_features` + Settings toggles; attendance mode in `ticketing_config.attendanceMode` (`paid` | `free` | `paid_and_free` | `open_public`). Overview is a command center (KPIs, attention alerts, ops cards). Finance = ticket revenue + `event_expenses` ledger. Reports = attendee CSV + financial summary. SQL **`252_event_workspace_redesign.sql`**. Keys: `event-workspace-features.ts`, `event-overview-metrics.ts`, `internal-event-overview-dashboard.tsx`, `internal-event-registration-workspace.tsx`, `internal-event-finance-tab.tsx`, `internal-event-reports-tab.tsx`, `internal-event-features-settings.tsx`.
* **Event workspace Settings tab (August 2026):** **Event features** toggles + **Visibility & access** metadata (primary coordinator, audience, event tags, estimated attendance, internal notes) + registration checkout/questions/promos when registration requires offerings. Tasks + volunteer sign-ups moved to **Staff & Volunteers**. Overview shows coordinator name when set. Requires SQL **`252`**. Key: `internal-event-features-settings.tsx`, `internal-event-meta-settings.tsx`, `updateEventWorkspaceMeta`, `internal-event-settings-workspace.tsx`.
* **Event Youth tab groups (August 2026):** Event workspace **Youth** tab (`?tab=youth`; legacy `?tab=childcare` still opens it) configures **Childcare** or **Field trip** groups — offering, min/max age, gender, capacity on one row. Shared **registration deadline**, **youth questions**, and optional **Require liability waiver** apply to all groups. Press Enter/Tab on Capacity to add another row; choose **Field trip** in Offering for venue name + address. Stored in `service_requirements.childcare.groups` (`offering`: `childcare` | `field_trip`) with legacy `ageGroups` kept in sync; `requireWaiver` on childcare config. Key: `event-service-requirements.ts`, `event-service-requirements-fields.tsx`.
* **Youth waivers / forms (August 2026):** Customer Opportunities childcare signup collects allergies, photo consent, and (when required) liability waiver. Staff Youth → Children shows **Forms** status + **Forms** dialog to record the same fields. Check-in is blocked until required forms are complete. SQL **`259_youth_waiver_forms.sql`** (`waiver_signed_at`, `waiver_signed_by`, `photo_consent`). Keys: `youth-forms.ts`, `childcare-registration-actions.ts`, `internal-event-childcare-tab.tsx`, `opportunities-client.tsx`.
* **Event Youth tab UI (August 2026):** Youth workspace body uses summary KPIs (Total Youth, Childcare, Field Trip, Capacity Remaining, Missing Forms, Checked In) plus sub-tabs **Children | Offerings | Staff/Providers | Check-In**. Children = searchable roster; Offerings = read-only group summary (edit via Youth offerings panel above); Staff/Providers = provider panel + log hours; **Check-In** = check in/out confirmed children with pickup authorization (`setChildcareRegistrationCheckIn`). Requires SQL **`253_event_youth_checkin_waitlist.sql`**. Key: `internal-event-childcare-tab.tsx`, `childcare-registration-actions.ts`.
* **Event workspace Vendors tab (August 2026):** **Vendors** tab summary cards (Applications, Pending, Approved, Booth slots) plus sub-tabs **Applications | Approved | Booth slots** (`internal-event-vendors-tab.tsx`). Vendor settings panel remains above when staff can manage.
* **Per-ticket-type attendee questions (August 2026):** On event **Settings**, attendee questions can target specific ticket types (empty = all types). **Add youth question pack** presets age, grade, emergency contact, allergies, photo consent for selected kids ticket types. Questions stay available even when buyer fields use the org default. Helpers: `questionAppliesToTicketType`, `expandAttendeeQuestionSlots`. Key: `attendee-questions-editor.tsx`, `ticketing-checkout-ui-types.ts`.
* **Internal event delete guards (July 2026 / August 2026):** Delete lives on Event Management catalog and event workspace (not Ticketing Overview). Server blocks delete when the event has **any** ticket orders/tickets (financial activity), **any** volunteer/vendor/childcare-provider sign-ups, or **any** childcare/youth registrations. Key files: `getInternalEventDeleteBlockers` in `lib/events/internal-event-actions.ts`, `components/events/internal-event-card-actions.tsx`.
* **Event workspace Draft / Published (August 2026):** Workspace status control is **Draft** or **Published** only (legacy Approved/Confirmed/etc. display as Published; publishing writes `approved`). Status badge next to the title removed. Edit pencil removed on workspace — click **Event details** to open the schedule/location editor. Key: `internal-event-status.ts`, `internal-event-status-select.tsx`, `internal-event-workspace.tsx`.
* **Event workspace Staff & Volunteers (August 2026):** **Staff & Volunteers** (`?tab=staff`) — tasks/shifts/sign-ups at top (description, staff/volunteer allowed, multiple shifts); summary cards (paid, volunteers, open, scheduled/actual hours, payroll estimate); **Paid staff** and **Volunteers** with shift picker, checkboxes, **Mark as paid** / **Send certificates**, edit/remove. Meta in `assignment_meta` includes shiftId/shiftLabel (SQL **`250`** + **`251`**). Key: `internal-event-staff-tab.tsx`, `event-service-requirements.ts`.
* **Department workspace Events (July 2026):** Programs/ Events → **Departments** → **Events** (`?tab=activity`) lists that department’s `internal_events` with open/edit/delete (manage permission). CTAs: **View Master Calendar** → Events Master Calendar filtered by department; **Check space availability** → Facilities Calendar; **Create event** → Facilities create drawer with department locked. Panel: `components/departments/department-events-panel.tsx`.
* **Events Master Calendar (July 2026 / August 2026):** Master Calendar lives under **Programs/ Events → Event Management → Master Calendar** (`/event-management/calendar`) as a **sidebar menu item** (not an in-page tab). Events list is **Event Management → Events** (`/event-management`). Shows all `internal_events` for the month (facility, online, external) with department filter; not the Facilities room grid. Legacy `/workforce/departments/calendar` redirects here. **Facility schedule** deep-links Facilities `?sources=internal_event` for space conflicts. Key files: `internal-events-calendar-client.tsx`, `internal-event-calendar-queries.ts`, `event-management-section-path.ts`.
* **Events overview list (August 2026):** `/event-management` layout: KPI cards (no Draft; counts only, not links) → **All events** table → **Attention required**. Removed Today's Schedule and catalog filters/cards. Period filter defaults to **All Events**; also Today / This Week / This Month / Past Events — scopes KPIs + list (upcoming soonest-first; Past most-recent-first). Columns: Event, Location (Center / Online / External), Date, Time, Space (venues comma-separated; Online `—`; External venue name). Row opens event workspace. Key: `event-management/page.tsx`, `event-management-dashboard-panels.tsx`, `filterEventsForDashboardPeriod`.
* **Event location types (July 2026 / August 2026):** Create/Edit event form: **Center** (venue(s) + Facility setup + calendar block), **Online** (optional **Meeting link** → stored in `location_address`; `location_label` stays `Online`), or **External Venue** (name + address). Facility setup only for Center. Master Calendar Upcoming panel shows the meeting link for online events. Migration **`210_internal_event_location_type.sql`** (`location_type`, `location_address`; sync skips calendar when `venue_id` is null). Optional comment clarify: **`248_internal_event_online_meeting_link_comment.sql`**. Legacy rows stay unset until edited.
* **Multi-venue facility events (July 2026):** Facility create/request/edit allow **one or more venues** via checkbox dropdown (`FacilityVenueMultiSelect`); menu stays open while checking, closes on **Done** or outside click. Junction table `internal_event_venues` (migration **`211_internal_event_multi_venues.sql`**); `internal_events.venue_id` stays the primary (first) venue. Calendar sync writes one `resource_reservations` row per linked venue. Run **`210`** then **`211`** in Supabase SQL Editor.
* **Unified Facilities event request drawer (July 2026 / August 2026):** One side drawer on **Facilities → Calendar** for Center / Online / External Venue. **Center** submits as **awaiting approval** (facility coordination). **Online** and **External Venue** confirm immediately on submit (no facility approval). Prefills department + requester name. Supports daily/weekly/monthly recurrence + exceptions (materializes one `internal_events` row per occurrence with shared `recurrence_config.seriesId`). **EM Master Calendar is read-only** with CTA **Create event** → Facilities. Department workspace **Create event** / **View Master Calendar** follow the same model. Legacy `/event-management/create` and `/request` redirect to Facilities. **Edit** from event cards / workspace (`/event-management/[id]/edit`) opens the **same drawer** (not the old full-page form). Drawer is **booking-only** (date/time/location/venue/setup/recurrence) — registration, staff, youth, and vendors are configured on the **event workspace** tabs. **Flyer** and **Description** edit inline on workspace Overview (`internal_events.flyer_url` / `description`; flyer migration **`214_internal_event_flyer_url.sql`**, reuses `program-flyers` bucket); Overview layout: left **Flyer** + **Description**, right **Event details** + **Community Calendar**, above KPIs/ops cards. Staff Tools keeps `/customer/staff/events/request` (same drawer). Venue rental booking stays separate. Removed unused mock `NewBookingRequestDrawer` / `AddEventForm`. Key files: `facility-event-request-drawer.tsx`, `facility-event-edit-page-client.tsx`, `internal-event-module-setup-panel.tsx`, `internal-event-flyer-card.tsx`, `internal-event-description-card.tsx`, `event-recurrence.ts`, `reservation-calendar.tsx`.
* **Fix event submit ON CONFLICT (July 2026):** After multi-venue indexes (`211`), the calendar sync trigger must not use `ON CONFLICT (organization_id, source_type, source_id)` for internal events. The live trigger calls **`sync_internal_event_reservation`** (not `sync_internal_event_to_resource`). Run **`scripts/213_fix_internal_event_reservation_trigger.sql`** if submit fails with that Postgres error.
* **Fix venue rental edit ON CONFLICT (August 2026):** Same index change broke `sync_rental_reservation_to_resource` (and legacy `sync_venue_booking_reservation`) when staff edit spaces/dates on a rental. Run **`scripts/218_fix_venue_rental_reservation_sync.sql`** — replaces ON CONFLICT with delete+insert, matching the internal-event fix. **Setup/cleanup expansion restore + backfill (August 2026):** `218` omitted buffer expansion from `209`. Run **`scripts/222_venue_rental_setup_cleanup_buffers.sql`**, set org/space defaults, then **`scripts/223_backfill_venue_rental_setup_cleanup_buffers.sql`** to restore sync expansion and stamp existing `rental_reservations` (calendar blocks refresh via trigger).

* **Venue rental Google Form import (July 2026):** Dry-run/execute script `scripts/import-venue-rental-form-responses.mjs` loads Form Responses CSV into `venue_rentals` + `rental_reservations` (calendar via sync trigger). **Scope:** Banquet Hall and/or Youth Lounge only; both → two slots. End time missing/`Option 1`/invalid → start+4h (America/Chicago). Dedupe email+date+venues (keep latest). Contacts via `find_or_create_contact_for_org` + membership in contact group **Venue Rental**. Status map: Approved→`approved_pending_payment`, Deposit Received→`confirmed`, Complete→`completed`, Cancelled→`cancelled_before_payment`, blank→`completed` if past else `submitted`. **Type of Event** maps to `venue_rental_event_type_id` (match/create in `venue_rental_event_types`). Payments not imported (separate later). Report: `scripts/reports/venue-rental-form-import-*.json`. Backfill for rentals imported before FK was set: `scripts/backfill-venue-rental-event-types.mjs` (parses `Event type:` from notes). **Keep-from-month cleanup (July 2026):** `scripts/cleanup-imported-venue-rentals-keep-month.mjs` deletes Google Form imports (`VENUE_RENTAL_GOOGLE_FORM_V1`) whose event start is **before** the cutoff month (default July 2026 America/Chicago) and keeps that month plus all later; **contacts are never deleted**.

* **Venue Rentals Settings (July 2026 / August 2026):** Settings tabs: **General** | **Notifications** | **Event Types** | **Add-ons** | **Discounts** (`/bookings/settings/general`, …; legacy `/bookings/settings/policies` redirects to General). **General:** (1) **Security deposit** — per-org `venue_rental_settings.security_deposit_enabled` (default off). When off: approve/record payment hide security deposit; post-event **Mark completed**. When on: security deposit on approve + inspection → refund. (2) **Customer documents** — upload Policies & procedures + Pricing guide PDFs to storage bucket `venue-rental-docs`; stamped on submit (`policies_sent_at` + URL snapshots). (3) **Approval after agreement** — `approval_mode` `manual` (staff approve after customer agrees) or `auto_after_agreement` (approve on agree; deposit = quoted total). (4) **Setup & cleanup buffers (August 2026)** — org defaults `default_setup_minutes` / `default_cleanup_minutes` (hours in UI) applied to new `rental_reservations`; occupied calendar window = event − setup … event + cleanup. Optional per-space override on Facilities → Spaces (`venues.setup_minutes` / `cleanup_minutes`, NULL = inherit). Conflict checks expand the candidate window the same way. SQL: **`scripts/222_venue_rental_setup_cleanup_buffers.sql`**; stamp existing bookings + restore sync expansion: **`scripts/223_backfill_venue_rental_setup_cleanup_buffers.sql`**. Customer portal: agree checkbox on rental detail; staff approve blocked until agreed (bypass checkbox for exceptions). SQL: `scripts/220_venue_rental_org_settings.sql`, `scripts/221_venue_rental_customer_documents.sql`. Add-ons catalog (`rental_addons`) supports create/edit/delete (deactivate if already used on a rental) with name, price, description, and active flag. List order is set by **drag-and-drop** (persists `sort_order` via `reorderRentalAddons`). Seed/update defaults (Table Covers $10, Chair Covers $2, Plate Chargers $1, Gift Table Setup $50): run `scripts/216_venue_rental_addon_catalog.sql`. **Post-event fees (August 2026):** also seed **Extra Cleaning** and **Damage Charge** via `scripts/219_venue_rental_post_event_addons.sql`. Financial → **Add charge** uses this catalog (quantity × unit price) instead of generic charge types. Facilities and EM event-types routes redirect to Venue Rentals Event Types for now; Event Management will get a separate catalog later. **Nav stability (July 2026):** middleware no longer bounces signed-in users to `/login` on transient `getUser()` failures when Supabase auth cookies are present; dashboard access guard no longer clears the org cache on every pathname change (those two were causing refresh/login thrash that looked like an infinite loop when opening Venue Rentals → Settings).

* **Venue Rentals Dashboard vs Requests (July 2026):** `/bookings/overview` shows **confirmed upcoming** rentals only (KPI cards: upcoming / this week / next 30 days / balance due) plus **View all requests**. `/bookings/requests` is the **intake queue** (Submitted / Pending / Approved) with KPI cards (**Submitted**, **Approved** — tinted tones) and Status filter: **All | Submitted | Pending | Approved | Confirmed | Completed | Cancelled | Declined**. **Confirmed** (deposit received) is hidden from the default All queue like Completed / Cancelled / Declined — ongoing work lives on **Payments** (`/bookings/payments`); use Status → Confirmed only for history. Staff badge for `approved_pending_payment` is **Approved** (deposit due); a completed money payment (deposit / final / installment / add-on / cleaning / adjustment — not discount/credit/security alone) auto-moves to **Confirmed**. Opening **Requests** runs `reconcileApprovedVenueRentalsWithPayments` so stuck Approved+paid rows leave the queue without opening each detail page. **Auto-complete (July 2026):** Confirmed rentals become **Completed** after the latest reserved slot `end_at` passes — hourly cron `GET|POST /api/cron/venue-rental-auto-complete` plus on load of Requests/Overview. Queue row click opens the rental; actions menu (Approve | Pending) only when reviewable. **Queue columns (July 2026):** Customer | **Date / Spaces** (event date/time bold on top, space name under) | Event type | Status — sorted by **earliest event start ascending** (soonest first). Request/submitted timestamp is shown on the rental detail page (`Requested …`), not as a list column. **Row actions (August 2026):** Click a row to open the rental and approve / mark pending there. The Requests ⋮ action menu was removed. **Editable Customer card (August 2026):** On `/bookings/rentals/[id]`, staff with manage permission use **Edit** on the Customer section to change spaces, date/time, event type, and notes in place (no separate form page). Saves via `updateVenueRentalRequestDetails` (conflict-checked; Google Form import metadata in notes is preserved). Contact name/email/phone stay linked to the contact record. **Add booking (July 2026):** staff with manage permission get a **Create New Rental Request** button that opens a dialog to create a `submitted` rental for any contact (one or more spaces via checkboxes, shared date/time, setup style from Facilities → Settings → Setup Styles, optional event type/notes, **add-ons with quantities**). Dialog shows live **Total fee** (space rate × hours + add-ons). Selected add-ons persist via `rental_selected_addons` (`createStaffVenueRentalRequest`). Uses `createStaffVenueRentalRequest`. **Queue conflict checks (July 2026):** list/dashboard conflict flags use one batched `resource_reservations` range query (`loadRentalConflictFlags`) instead of per-reservation round-trips — needed after bulk Google Form import (~150 rentals).

* **Venue Rentals Settings → Discounts (July 2026):** `/bookings/settings/discounts` — optional catalog of rental discount policies (`venue_rental_discount_policies`). Each policy is **fixed $** or **percent** off the space fee, with conditions: **multi-venue** (min venues, default 2+) and/or a **Contacts discount tag** (non-profit, top donor, etc.). Tags stay under Contacts → Settings; rental policies only reference them. When multiple policies match, the **largest dollar savings** wins (no stacking). Applied on Payments Total Charges and rental Financial quote. Add-ons remain $0 until staff update them. **SQL:** `scripts/217_venue_rental_discount_policies.sql`. Key files: `venue-rental-discounts-client.tsx`, `venue-rental-discount-actions.ts`, `venue-rental-discount-policies.ts`.

* **Venue Rentals Payments (July 2026):** Sidebar **Payments** → `/bookings/payments` — financial ledger / receivables (not a duplicate of Requests). **Default list:** Hides **Declined**, **Cancelled (before payment)**, and **Hold expired** when no payment was received — nothing to collect. **Cancelled after payment** stays so staff can keep, refund, or partially refund the deposit. Summary cards: **Total Charges**, **Payments Received**, **Outstanding Balance**, **Past Due**. **Total Charges** = space fee for requested slots from venue day pricing (**flat price for that date** when set, else hours × hourly) in America/Chicago; **add-ons forced to $0** for now (staff can update later). Payment status is never auto-**Complimentary** (zero charges → No Charges). **Received** / credits from payment ledger; **Balance Due** = charges − received − credits. Table: Customer (column filter), Event/Space, Event Date, money columns, **Payment Status** / **Next Action** (column filters). Row click opens the rental Financial section (no row action menu). Rental detail **Financial** panel uses the same quoted charges basis. **Apply Discount (August 2026):** Financial actions include **Apply Discount** (fixed $ or % of current total charges) separate from **Apply Credit**; writes a completed `discount` ledger row via `applyVenueRentalDiscount` (notes no longer say “Staff discount”). Reusable auto rules remain under Settings → Discounts. **Edit transactions (August 2026):** Transactions table **Edit** updates method, date, reference, notes, and receipt URL (`updateVenueRentalTransactionDetails`); pending charges can also change amount. Completed amounts still require Void + re-record. **Add charge (August 2026):** dropdown lists active Settings → Add-ons (quantity × unit price); Extra Cleaning / Damage Charge map to cleaning/adjustment ledger types; quoted total + these extras update balance due. **SQL:** run `scripts/215_venue_rental_payment_ledger_fields.sql` and `scripts/219_venue_rental_post_event_addons.sql`. Requests remains operational (approve/schedule/cancel).

* **Venue rental payments import (July 2026):** `scripts/import-venue-rental-payments.mjs` matches `Venue Rental Payments.csv` to existing `venue_rentals` by billing-contact email/phone (or email in Google Form notes). Unmatched payments skipped. Writes `rental_payments` (`deposit` / `remaining_balance` / `refund`; `paid_manually` or `refunded`). Idempotent via notes tag `VENUE_RENTAL_PAYMENTS_V1`. Reports: `scripts/reports/venue-rental-payments-import-*.json`. **Cleanup (July 2026):** `scripts/cleanup-imported-venue-rental-payments.mjs` deletes rows tagged `VENUE_RENTAL_PAYMENTS_V1`, sets past non-cancelled rentals to `completed`, and resets future rentals that were bumped to `deposit_paid` by the import back to `approved_pending_payment`.

* **Organization audit log (June 2026):** Settings → **Audit Log** (`/settings/audit-log`) — append-only history of donation ledger edits (payment update/void/refund/allocate, pledge update/payment/cancel) and permission changes (member role assignment, role permission toggles). Table: `organization_audit_logs` (migration `142_organization_audit_logs.sql`). Writes via service role in `lib/audit/organization-audit-log.ts`; reads via RLS for staff with `settings.users.view`, `settings.roles.view`, `donations.view`, or `donations.manage`. Permission toggles route through `setOrganizationRolePermissionAction` so changes are logged server-side.
* **Org billing view (June 2026):** `/billing` (sidebar **Billing**, pinned to the bottom of the icon rail; `/settings/billing` and `/settings/subscription` redirect here) — plan price, persona bundle, plan limits, enabled modules, payment methods on file, and billing history (`lib/organizations/organization-billing-actions.ts`, `organization-subscription-summary.ts`). Visible to platform support sessions, `organization_members.role` of `super_admin`/`owner`, or org role name **Super Admin**. Apply migration `121_organization_billing.sql` for payment methods and invoice history tables.
* **Subscription terms (June 2026):** Platform admin → Organizations → **Billing** tab sets `subscription_start_date`, optional **3 months free** (`complimentary_months`), and optional **first year special rate** (`first_year_special_monthly_rate`). Org `/billing` shows start date, complimentary period, effective rate, and first-year pricing notice (standard rate after year one; owner may adjust pricing). Migration `123_organization_subscription_terms.sql`. API: `PATCH /api/platform/organizations/[id]/billing-terms`.
* **Platform admin nav loop (August 2026):** Clicking **Organizations** (or other `/admin/*` sidebar items) refetched the current page forever. The platform sidebar delayed rendering links until after mount, which retriggered Next.js 16 viewport prefetch of the active route. Sidebar now renders immediately with `prefetch={false}`. Organizations detail sheet mounts only when an org is selected; plan/role Selects no longer use an empty string value (Radix loop). Login for platform admins goes to `/admin/organizations` instead of `/admin`.

---

## Current Issue

User Invitations

File:

app/api/organizations/invite-user/route.ts

Status:

Working — requires Supabase email + redirect URL configuration (see `docs/Known_Issues.md`)

---

# Customer Portal

Status: Partial

## Module-aware navigation (June 2026)

Customer sidebar and dashboard only show areas enabled for the active organization (`organization_modules`), matching the staff sidebar.

| Customer area | Required module slug |
|---------------|----------------------|
| Venue Rentals | `bookings` |
| Donations | `donations` |
| My Transactions | any of `donations` / `programs` / `bookings` / `membership` |
| Programs | `programs` |
| My Bazaars (approved vendors only) | `vendor-hub` |
| Opportunities | `membership` |
| Dashboard / Profile | always visible |

Key files: `lib/customer/customer-portal-modules.ts` (client-safe), `lib/customer/customer-portal-modules-server.ts` (server loaders/guards), `components/customer/customer-nav.tsx`, `app/(customer)/layout.tsx`. Disabled module routes redirect to `/customer/dashboard`. **Dashboard** (`/customer/dashboard`): KPI overview cards only (Profile, Venue Rentals, Donations, Pledges, Programs as enabled). **My Transactions** (`/customer/transactions`): customer read-only mirror of contact **Financial** (KPIs, Financial by Module, Recent Transactions, Financial Summary / open balances) via `ContactFinancialPanel` `variant="customer"` + `loadCustomerMyTransactionsSummaryAction`. Visible when donations, programs, bookings, or membership is enabled. Giving UI lives under **Donations → Giving Opportunities**; donations tab **Giving history** lists donation payments. Customer sidebar branding uses the active org `logo_url` with **organization name** in bold below the logo (falls back to name-only or Manaratee logo). **Profile** submenu (Family, Notification Preferences, Applications) appears only after the donor opens Profile. **Notification Preferences** (`/customer/profile/notifications`) shows toggles only for org-enabled modules (`lib/customer/customer-notification-preferences.ts`); Donations module includes payment completed, payment charges, failed transactions, pledge reminders, and SMS payment reminders, plus org-wide newsletter.

For a donations-only org (e.g. MAS Dallas on the **Nonprofit** bundle), ensure only `donations` is enabled in platform admin → organization modules (or assign bundle `nonprofit`).

**Portal switcher (July 2026):** User menu **Switch portal** appears only when the same login has a **personal (customer) portal** and at least one staff-side portal (Admin Dashboard, Staff Tools, or Teaching). **My Classes** (teaching) is reached only via Switch portal — not duplicated in the personal-account sidebar. Staff-only accounts (e.g. `admin@org` with admin + staff-tools permissions but no personal/customer account) do not see the switcher. Key: `shouldShowPortalSwitcher` in `lib/auth/resolve-portal-permissions.ts`, `components/portal/portal-switcher.tsx`.

**Donor join deep-link (June 2026 / August 2026):** Settings → Users exposes two links: general customer join and **Donor signup and give**. Copied URLs always use **https://app.manaratee.com** (`getShareableAppBaseUrl`), not localhost. The donor link is `/join/{org-slug}?next=/customer/donation?give=one-time` (encoded in the URL). After signup or sign-in, the user is routed to `/customer/donation` and the **Donate** dialog opens (one-time by default). Requires donations module + org Stripe Connect (Donations → Settings → Online Payments). Key files: `lib/organizations/join-organization-url.ts`, `lib/app/get-app-base-url.ts`, `lib/auth/sanitize-customer-redirect-path.ts`, `components/customer/organization-join-client.tsx`, `components/settings/organization-join-link-card.tsx`.

## Customer Venue Rentals (pilot — Phase 1 UX)

Status: Pilot preparation (June 2026)

**Intended staff process (July 2026):**
1. Customer submits → **Submitted** (just received)
2. Admin marks **Pending** while in review / waiting for more info, or **Approve** / **Decline**
3. **Approved** (`approved_pending_payment`) — deposit requested with hold deadline; customer notified to pay
4. Deposit received → automatically **Confirmed**
5. Event date passes → **Completed** automatically (latest reservation `end_at`; cron + Requests/Overview load)
6. **Cancelled** if the rental must be cancelled; **Declined** if the request is turned down

Statuses updated to match: submit lands on `submitted`; new `pending`; staff label for approved-awaiting-deposit is **Approved**; `deposit_paid` / `security_deposit_paid` treated as confirmed. Run **`scripts/206_venue_rental_status_process.sql`**. Key files: `lib/bookings/venue-rental-status.ts`, `venue-rental-actions.ts`, `venue-rental-auto-complete.ts`, `venue-rental-detail-client.tsx`, `venue-rental-requests-queue.tsx`. Cron: `app/api/cron/venue-rental-auto-complete/route.ts` (hourly in `vercel.json`).

Routes: `/customer/rentals`, `/customer/rentals/new`, `/customer/rentals/[id]`. Customer detail **Status timeline**: Request submitted → Request approved → Deposit paid → Reservation confirmed → Full balance paid (due 14 days before event) → Event completed (no Agreement signed — policies acknowledged on submit; no security deposit paid/refunded steps). On submit, a **72-hour temporary hold** blocks the requested space/time on the calendar (`temporary_hold` + `hold_expires_at`); approval resets a fresh 72h payment hold. Remaining balance `due_at` is set to **event start − 14 days**. **Book a Space** (`/customer/rentals/new`): click the centered date header to open the month calendar (no sidebar calendar). Click an open grid slot to open the request dialog with **From / to** time selects (30-minute steps within space hours). **Facility setup is required** (expected attendance, **chairs per table**, setup style from Facilities → Setup Styles). App shows **tables needed** = ceil(attendance ÷ chairs per table). Add-on quantities: plate chargers / chair covers × attendance; table covers × tables; other add-ons flat. Live **Total charges** (space fee + add-ons) shown before submit. When org has uploaded Policies / Pricing guide (Venue Rentals → Settings → General), the request form shows download links and requires a **I have read…** checkbox before submit (records `policies_agreed_at` at submit). Customer add-ons exclude post-inspection fees (**Cleanup Fee**, **Extra Cleaning**, **Damage Charge**), collapse duplicate catalog names (e.g. Chair Covers / Gift Table vs Gift Table Setup), and list A–Z. SQL: **`scripts/224_operational_brief_chairs_per_table.sql`**, catalog cleanup **`scripts/225_venue_rental_addon_catalog_cleanup.sql`**. Grid hours/rates come from each space’s admin day schedule (`rental_space_pricing` / Spaces settings).

**Phase 1 Deliverable #3 (payment UX honesty):** Customer payment and contract-signing flows clearly state that **staff will email payment instructions** and handle agreement follow-up. Disabled “Pay deposit” / “Sign agreement” buttons removed; informational callouts replace them. Payment architecture unchanged — `rental_payments` ledger and future Stripe checkout (Phase 6) remain the target path.

**Phase 1 Deliverable #1 (cancel rental staff UI):** Staff can cancel active rentals from `/bookings/rentals/[id]` via `cancelVenueRental`. Eligible statuses: awaiting approval, awaiting payment, partial payment, confirmed. Blocked during refund workflow and terminal states. Releases `rental_reservations` (calendar sync), appends cancellation to rental notes, writes `reservation_override_logs`. After-payment cancellations require confirmation when payments are recorded.

**Phase 1 Deliverable #2 (hold expiry automation):** Unpaid holds expire automatically via scheduled cron. Targets **submitted / pending / awaiting_supervisor_approval** (72h request hold from submit) and **approved_pending_payment / deposit_paid / security_deposit_paid** (fresh 72h window on approve) when `hold_expires_at` has elapsed. Sets rental → `hold_expired`, `rental_reservations` → `expired` (calendar release via existing sync). Multi-tenant safe: service-role job processes all organizations with org-scoped updates; staff `expireVenueRentalHolds` remains for single-org manual runs. Cron: `GET|POST /api/cron/venue-rental-hold-expiry` (Bearer `CRON_SECRET`; dev open when unset). Vercel schedule: hourly (`0 * * * *`). Backfill open requests without expiry: **`scripts/226_venue_rental_request_hold_backfill.sql`**.

**Live-safe validation:** `node scripts/validate-venue-rental-hold-expiry.mjs` — read-only dry-run (SELECT only; no cron invocation). Requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Production also requires `CRON_SECRET`. Report: `scripts/reports/venue-rental-hold-expiry-validation.json`.

**Phase 1 Deliverable #4 (force-book override UI):** Authorized staff (`BOOKINGS_MANAGE` or `PROGRAMS_MANAGE` + finance visibility) can force-book pre-confirmation rentals from `/bookings/rentals/[id]` via `forceBookVenueRentalWithOverride`. Exception-only UI with amber warning card, required override reason, confirmation dialog, conflict visibility, and outstanding-payment acknowledgement. Sets rental → `confirmed` without marking payments paid; writes `reservation_override_logs` (`action: force_book`) with previous/next status and override metadata. Blocked for confirmed, terminal, and refund workflow states.

Key files:

* `lib/bookings/customer-rental-process-guidance.ts` — customer-facing copy for staff-mediated payment and contract review
* `components/customer/rentals/customer-rental-process-guidance-callout.tsx` — shared callout UI
* `components/customer/rentals/customer-rental-next-action-panel.tsx`, `customer-rental-payments-section.tsx`, `customer-rental-documents-section.tsx`
* `components/bookings/venue-rental-detail-client.tsx` — staff cancel + force-book UI
* `lib/bookings/venue-rental-status.ts` — `canStaffCancelVenueRental`, `canStaffForceBookVenueRental`, `summarizeOutstandingRentalPayments`
* `lib/bookings/venue-rental-hold-expiry.ts` — `expireVenueRentalHoldsForScope`, `runVenueRentalHoldExpiryJob`
* `app/api/cron/venue-rental-hold-expiry/route.ts` — cron entry point
* `vercel.json` — hourly hold-expiry schedule

Tests: `lib/bookings/customer-rental-process-guidance.test.ts`, `lib/bookings/customer-venue-rental-experience.test.ts`, `lib/bookings/venue-rental-cancel.test.ts`, `lib/bookings/venue-rental-force-book.test.ts`, `lib/bookings/venue-rental-hold-expiry.test.ts` (included in `npm run test:conflicts`).

**Phase 1 Deliverable #5 (pilot readiness validation):** Read-only harness `node scripts/validate-venue-rental-pilot-readiness.mjs` checks deliverables, workflow actions, env vars, unit tests, hold-expiry dry-run (`eligibleCount = 0`), and audit log readability. Full staff/customer E2E still requires manual walkthrough — no live mutations during validation. Pilot assumes **external payment collection** and **staff-mediated email** for payment instructions (no Stripe checkout for venue rentals in Phase 1).

## Pilot Data Cleanup — Vendor Hub (June 2026)

Status: **Vendor import cleanup complete** (MAS Dallas pilot org)

Removed **255** legacy imported rows from `public.vendors` (May 2026 CSV import). These were standalone directory records with no `contact_id` — not part of the contact-centric Vendor Hub model (`lib/vendor-hub/contact-centric-model.ts`).

**Bazaar create/edit organizer + space (August 2026):** Create/Edit Bazaar Event drawer uses real CRM contacts (`HrContactPicker` + quick-add) and Facilities venues instead of mock dropdowns. Persists `organizer_contact_id`, `organizer_name`, and `venue_id` on `vendor_hub_events`. Run **`scripts/227_vendor_hub_event_organizer_venue.sql`**.

**Vendor Hub Reports — live data (August 2026):** `/vendor-hub/reports` no longer uses hardcoded sample vendors/revenue. Overview, Vendor Sales, and Booth Performance aggregate real `vendor_hub_booth_assignments`, `vendor_hub_payments`, and `vendor_hub_booths` (optional `?eventId=` filter). Empty states when there are no assignments/payments. Key files: `lib/vendor-hub/vendor-hub-reports-queries.ts`, `components/vendor-hub/vendor-hub-reports-client.tsx`.

**Bazaar event Vendors tab (August 2026):** Event workspace tabs are **Overview | Vendors | Evaluations | Messages**. Former **Reservations** and **Payments** tabs removed (old URLs redirect to Vendors). Vendors lists participating vendors from `vendor_hub_participant_status`, booth assignments, and `vendor_hub_payments`. Route: `/vendor-hub/events/[eventId]/booths`. Key: `lib/vendor-hub/event-participating-vendors-queries.ts`, `components/vendor-hub/events/bazaar-event-vendors-client.tsx`, `lib/vendor-hub/vendor-hub-nav.ts`.

**Bazaar event Overview layout (August 2026):** Metric cards are booth occupancy / revenue / evaluations (booth reservations card removed). Flyer is compact, auto-saves on select/remove (no Save button / format hint). Public share link sits under the flyer; **Quick actions** on the right: Copy, Cancel, Delete. Delete blocked when the event has booth reservations or payment activity (`getBazaarEventDeleteBlockers`). CSV import description line hidden on Overview. Bottom nav shortcut buttons (View vendors / Message / Onboarding / Evaluations) removed — use workspace tabs instead. Key: `components/vendor-hub/events/bazaar-event-overview-client.tsx`, `bazaar-event-flyer-share-panel.tsx`, `bazaar-event-quick-actions.tsx`, `lib/vendor-hub/vendor-hub-event-actions.ts`.

**Vendor org application intake (August 2026):** Customers apply at `/customer/apply/vendor` (also listed under Profile → Applications). Fields are driven by `lib/vendor-hub/vendor-application-fields.ts` (toggle/add definitions to grow the form later). Staff share **Copy apply link** and review at **Vendor Hub → Network → Onboarding** (`/vendor-hub/network/onboarding`) — colorful status cards (Total / Pending / Approved / Rejected), status dropdown filter (no All/Pending/Approved/Rejected pill tabs), and one Submissions table. Columns: Applicant, Business Name, Business Type, Email, Submitted, Status (no Type/Actions). Rows open `/applications/[id]`. Approval grants the vendor role → Vendor Network. Apply is blocked only by an **approved or pending application** — a `vendor` contact role alone does not block re-apply (`hasApprovedOrgVendorApplication`). **One-time import cleanup (org-scoped script, not product default):** `node scripts/delete-imported-vendor-applications.mjs --org-id <uuid>` (dry-run) / `--execute` deletes that org’s approved vendor_hub vendor applications while keeping contacts, vendor roles, and participation history. Key: `components/customer/vendor-apply-client.tsx`, `vendor-application-form.tsx`, `app/(customer)/customer/apply/vendor/page.tsx`.

**Customer vendor profile (August 2026):** Approved vendors edit business name, type, products, social (Facebook/Instagram/website), and contact details at `/customer/profile/vendor` (also **Edit vendor profile** on My Bazaars). Updates the linked CRM contact + approved vendor `applications.form_data` — no duplicate contact. Imported vendors should log in with the same email to claim their contact. Run **`scripts/231_customer_vendor_profile_rls.sql`** for customer UPDATE on own vendor apps + SELECT on vendor types (actions also use service role after ownership check). Key: `lib/vendor-hub/customer-vendor-profile-actions.ts`, `components/customer/customer-vendor-profile-client.tsx`.

**Vendor Hub dashboard layout (August 2026):** `/vendor-hub` is **organization-level** (not event-scoped). Four equal colorful KPI cards: Onboarding pending, Active vendors (Vendor Network last activity within 2 years), Revenue collected (all events), Outstanding balance (all events). Below: Upcoming events (today + future, sorted by date — click into event workspace) and org Quick Actions (Create Vendor Event, Network, Onboarding, History, Calendar, Reports). Event overview KPIs: Booth occupancy, **Booth registrations** (distinct vendors registered for the event), Revenue collected, Evaluations pending. Key: `getVendorHubOrgDashboard`, `getVendorHubDashboardMetrics`, `components/vendor-hub/vendor-hub-dashboard-client.tsx`, `bazaar-event-overview-client.tsx`.

**Community Calendar (August 2026):** Shared top-level nav **Community Calendar** → `/community-calendar` (staff). Shown when the org has **Vendor Hub and/or Event Management**. Lists **Public** (`published`) bazaar events (`vendor_hub_events.calendar_status`) and Event Management events (`internal_events.community_calendar_status`; SQL **`247`**). Visibility UI is **Private** / **Public** only (legacy `community_visible` still readable; saving as Public writes `published`). Featured block shows organization name, full date, day/time, and location with address; staff can **drag the featured flyer** to set crop (`flyer_focal_x` / `flyer_focal_y`, SQL **`249`**). Publish from bazaar create/edit or event Overview → Community Calendar card. Legacy `/vendor-hub/community-calendar` redirects. **Public (no-login) browse:** `/o/[orgSlug]/community-calendar` — featured nearest upcoming + flyer, category circles from org **event types**, Browse tabs All / Today / This weekend, 4-column cards (flyer, name, day/time, location, Free or ticket prices). Ticketed cards → `/o/[orgSlug]/events/[eventId]` (view + buy tickets via join/sign-in). Copy public link from staff Community Calendar or Settings → Users. Key: `lib/community-calendar/*`, `public-community-calendar-view.tsx`, `community-featured-flyer.tsx`, `internal-event-community-calendar-card.tsx`.

**Vendor Network count sync (August 2026):** Dashboard “Approved Vendors” previously counted application rows; Vendor Network listed contacts with `vendor` role — those could diverge after CSV import/merge. Opening Vendor Network (and loading dashboard metrics) now backfills missing `contact_roles` from approved vendor applications; both surfaces use distinct vendor-role contacts. Run **`scripts/232_backfill_vendor_roles_from_applications.sql`** once if needed. Key: `lib/vendor-hub/vendor-network-sync-actions.ts`.

**Vendor inactive after 2 years (August 2026):** Vendor Active/Inactive is based on **Last Activity** only (`contacts.last_activity_at`, else `created_at`) — older than 2 years = Inactive. Vendor Network Status filter uses that date (not the raw status field alone). Opening Vendors also syncs `contacts.status` to match. Optional SQL: **`scripts/233_vendor_inactive_after_two_years.sql`**. Key: `lib/vendor-hub/vendor-activity.ts`, `ensureVendorInactiveStatusForCurrentOrg`.

**Add vendor to event (August 2026):** On the event Vendors tab, **Add vendor** searches the **Vendor Network** only. If the vendor is missing, **Create new vendor** searches Contacts (or creates a contact), then creates the vendor profile + `vendor` role. After selection, enter business name, vendor type, optional booth, fee/payment, products/services, and notes for the event. Click a participating vendor row to **edit** booth/fee/type/notes for that event, or **remove** them with an optional fee refund (records `payment_type=refund`, cancels assignment/participant). Key: `components/vendor-hub/vendor-picker.tsx`, `components/vendor-hub/events/create-vendor-dialog.tsx`, `components/vendor-hub/events/add-event-vendor-dialog.tsx`, `components/vendor-hub/events/edit-event-vendor-dialog.tsx`, `lib/vendor-hub/vendor-search-actions.ts`, `lib/vendor-hub/add-event-vendor-actions.ts`.

**Bazaar vendors CSV import (August 2026):** Historical `BazaarVendors.csv` → contact-centric Vendor Hub (no legacy `vendors` table). Dry-run default; `--execute` writes contacts, one approved org vendor application per email (affiliation sync), `vendor_hub_events` by name+date, `vendor_hub_participant_status`, and `vendor_hub_payments` when fee > 0 (no booth numbers in CSV). Idempotent via notes tag `BAZAAR_VENDORS_CSV_V1` + `importKey`. Script: `node scripts/import-bazaar-vendors-csv.mjs` / `--execute` / `--csv` / `--limit`. Reports: `scripts/reports/bazaar-vendors-import-dry-run.json`, `bazaar-vendors-import-execute.json`.

**Vendor directory update CSV (August 2026):** `vendorUpdate.csv` (Full Name, Email, Phone, Business Name, social, products/services) upserts Vendor Network contacts by email — create/update contact + approved org vendor application `form_data` (`business_name`, `social`, `selling`). No events/payments. Tag `VENDOR_UPDATE_CSV_V1`. Script: `node scripts/import-vendor-update-csv.mjs` / `--execute` / `--csv`. Reports: `scripts/reports/vendor-update-import-dry-run.json`, `vendor-update-import-execute.json`.

**Vendor duplicate merge (August 2026):** Phone/email duplicate scan for vendor-role contacts via `node scripts/find-merge-vendor-duplicates.mjs` (`--execute` merges). Merge CLI now dedupes `contact_roles` and reassigns Vendor Hub participation/payments (`scripts/merge-donor-contacts.mjs`). MAS Dallas scan found 2 phone pairs (Alchemyst Gharbieh/Gharbia; Taco King Ahmad/Ahmad Khatib) — merged; kept canonical names **Ahmad Gharbieh** / **Ahmad Khatib**.

**Vendor Hub announcements RLS fix (August 2026):** Messages tab hit `42P17` infinite recursion between `vendor_hub_announcements` and `vendor_hub_announcement_recipients` policies. Run **`scripts/228_vendor_hub_announcements_rls_fix.sql`** (SECURITY DEFINER helpers). Soft-fail in `getEventVendorAnnouncements` until applied.

**Vendor Hub events RLS performance (August 2026):** After bazaar vendor import, staff updates (e.g. `ensureBazaarShareToken`) timed out because the permissive vendor SELECT policy scanned large participation/payment tables on every query. Run **`scripts/229_vendor_hub_events_rls_perf.sql`**. Share token ensure/regenerate uses service role after `requireVendorHubManage`.

**Bazaar Events list (August 2026):** `/vendor-hub/events` uses a table (Event name, Date, Venue, Booths) instead of cards. Event name is a primary-color link to the event workspace. Row actions: Edit (drawer), Copy event, Delete (confirm). Venue prefers linked Facilities venue name, else free-text location. Imported events set to **MAS Dallas Islamic Center** via `node scripts/set-bazaar-events-mas-dallas-venue.mjs --execute`.

**Vendor Network vendors table (August 2026):** `/vendor-hub/network/vendors` uses a vendor-focused layout (`vendorNetworkLayout` on `ContactsListView`): Contact (name, email, phone), Business Name, Vendor Type, Status, Last Activity. Column header filter icons on Contact, Business Name, Vendor Type, and Status (top search box and All Status dropdown removed). **Last Activity** has a sort icon (Newest first / Oldest first; default newest). Default Status filter is **Active**. **Add Vendor** opens contact search → create contact if missing → vendor profile + `vendor` role (`CreateVendorDialog`). Pagination over filtered vendor-role contacts.

**Vendor Network Participation History (August 2026):** `/vendor-hub/network/history` shows one row per vendor: Business Name (link to vendor profile), Vendor Type, total Events, Last Event, Last Event Date, Last Amount Paid (latest non-refund payment). Event counts include participation + payments. Sorted by last event date. Key: `lib/vendor-hub/participation-history-queries.ts`, `components/vendor-hub/network/participation-history-client.tsx`.

**Vendor Hub Settings tabs (August 2026):** Payments, Public Page, and Vendor Applications settings live under the **General** tab as stacked cards. Applications tab removed; Application Deadline and Auto-Approve Returning Vendors removed. Remaining tabs: General, Booths, Notifications, Email Templates, Vendor Types. **Notifications** tab shows Vendor notification settings inline (staff/customer toggles); `/vendor-hub/settings/notifications` redirects to `?tab=notifications`. Vendor Types table: Name (click to sort A→Z / Z→A), Default fee, Actions — Status and Sort columns removed.

**Vendor Hub default vs event booth settings (August 2026):** `/vendor-hub/settings?tab=booths` is **organization defaults** (pricing UI, default booth types, attributes, templates) — no event picker. Event workspace **Settings** tab at `/vendor-hub/events/[eventId]/settings` holds event booth pricing + booth types only (no attributes). Use **Copy from defaults** to clone org default booth types (and attribute links) onto the event. Defaults = `vendor_hub_booth_types` rows with `event_id IS NULL` + `organization_id`. Run **`scripts/234_vendor_hub_default_booth_types.sql`**. Key: `BoothTypesSettingsPanel`, `lib/vendor-hub/default-booth-type-actions.ts`, `components/vendor-hub/events/bazaar-event-settings-client.tsx`.

**Vendor profile page (August 2026):** `/vendor-hub/network/vendors/[contactId]` — editable overview (business name → contact name fallback; primary contact = CRM contact), vendor type from Settings catalog (`applications.form_data.vendor_type_id`), participation history, documents (fixed kinds: food license / insurance / sales tax / other). Storage bucket `application-documents` + `application_documents.document_kind` via **`scripts/230_vendor_profile_documents.sql`**. Overview **Social / website** (view mode) parses free-text into clickable links (`http(s)`, `www.`, Instagram `@handles`) via `lib/vendor-hub/vendor-social-links.ts`. Vendors list: **row click** → vendor profile; contact name is bold (not a link) — open CRM via **Primary contact** on the vendor profile. Contact Financial: Vendor Hub in by-module chart + summary from `vendor_hub_payments`. Key: `lib/vendor-hub/vendor-profile-queries.ts`, `vendor-profile-actions.ts`, `components/vendor-hub/network/vendor-profile-client.tsx`.

**Legacy vendor stub pages (August 2026):** Cleared hardcoded sample applications from `/events/vendors` and `/resources/vendors` (empty tables). Prefer Vendor Hub for real vendor workflows.

**App-wide UI mock seed cleanup (August 2026):** Emptied hardcoded sample rows/KPIs across Event Management (internal + external/venue stubs), Resources, People/Customers lists, Ticketing settings promo/check-in stubs, Sign-ups/Bookings consumers of `lib/mock-data.ts`, and related detail stubs. `lib/mock-data.ts` keeps types + form option labels (`businessTypes`, `ageGroups`, `childcareServices`) and `DEFAULT_ORG_CHECKOUT_FIELDS` templates; all sample table/list arrays and overview stats are empty/zero. Stub pages show empty states — real CRM/Vendor Hub/Facilities data paths are unchanged.

**Preserved:** vendor catalog/config (`vendor_categories`, `vendor_hub_vendor_types`, booth attributes/types, booths, events), applications engine (`application_type_definitions` includes `vendor`), auth, profiles, contacts, memberships, permissions, module configuration.

**Backup:** `scripts/backups/vendor-cleanup/vendors-2026-06-16.json` (255 rows). Reports: `scripts/reports/vendor-cleanup-pre-2026-06-16.json`, `scripts/reports/vendor-cleanup-post-2026-06-16.json`.

**Tooling:** `node scripts/vendor-cleanup-pilot.mjs` (inventory + export); `node scripts/vendor-cleanup-pilot.mjs --execute` (FK-safe operational delete).

**Pending pilot cleanup (separate approval):** donations stress/seed data, experimental venue rental chain — see `scripts/reports/pilot-cleanup-execution-preview.json`.

**MAS Dallas `contact_import_staging` cleared (June 2026):** 4,651 staging rows deleted. Backup: `scripts/backups/contact-import-staging/contact_import_staging-mas-dallas-2026-06-16.json`. Tool: `node scripts/clear-mas-contact-import-staging.mjs --execute`.

**MAS Dallas contacts cleaned (June 2026):** Removed `DONATIONS_DEV_SEED_V1` test contacts; only pilot contact Heyam Asad retained. Removed erroneous `member` membership/role from Heyam (kept `employee` via active staff record). Tool: `node scripts/clean-mas-contacts-pilot.mjs`.

**Directory module (August 2026):** User-facing **Contacts** sidebar is now **Directory**. Canonical table remains `contacts` (one person/organization record, many roles). Flyout: Overview, People, Families, Organizations, then populated role views, then Reports and Settings. Most role views appear only when the current tenant has records. **Service Providers** (plumbers, pest control, and other contractors the organization uses — not Vendor Hub event vendors) is always listed at `/directory/role/service-providers`. Legacy `/resources/service-providers` redirects there. Role views include lightweight lookup columns (department/position, lifetime giving, membership type, household/children, vendor type, rental history) without loading full operational records. Donor amount columns require `donations.view`. **Sponsor** is a manual role on the same contact (`scripts/269_directory_sponsor_role.sql`) — not a separate identity table. `/directory` Overview has global search, People/Families/Organizations counts, and Active Directory Categories. People / Organizations / Families moved out of Reports. Giving groups (`contact_type = group`) live only under Fund Development (Group Giving), not Directory. Campaign fundraising teams stay on Campaign → Groups. Reports are analytics (growth, overlapping role distribution, completeness, possible duplicates). Universal **+ Add** creates Person, Organization, or Family and can assign multiple roles. Membership **Add member** searches Directory first. Legacy `/contacts/...` list URLs redirect. Profile links use `/directory/[id]`. Key: `lib/directory/*`, `components/directory/*`, `components/layout/sidebar.tsx`. Optional SQL: `scripts/268_directory_module_label.sql`. Sponsor CHECK: `scripts/269_directory_sponsor_role.sql`.

**Directory People list (`ContactListRow is not defined`, August 2026):** `/directory/people` showed a red error box and an empty table because the client imported TypeScript types from `lib/contacts/contact-list-actions.ts` (`"use server"`). Next.js 16 treated `ContactListRow` as a missing runtime export. List types now live in `lib/contacts/contact-list-types.ts`; client components import types from that file and only import `fetchContactsList` / `fetchContactListStats` from the server-actions module. Same pattern for Directory reports and role views.

**Giving groups moved out of Directory (August 2026):** CRM `contact_type = group` records are Fund Development only — they track donations attributed to a department, committee, or other collective (members’ individual gifts roll up). Directory no longer lists Groups; `/directory/groups` and `/directory/groups/[id]` redirect to **Reports → Donor Giving → Group Giving** (`/donations/reports/donors?view=group`) and the giving workspace (`/donations/groups/[id]`). **Add Group** is on the Group Giving table section. Membership Groups stay at `/membership/groups`. Campaign Groups stay on Campaign → Groups.

**Donor Giving report columns (August 2026):** Individual, Household, and Group Giving tables on `/donations/reports/donors` no longer show **Pledge** or **Outstanding Balance**. Pledge status and balances stay on **Pledges**. Individual CSV/PDF export matches (no pledge columns).

**Contacts list UI (June 2026):** Removed **All Contacts** (`/contacts` redirects to `/contacts/people`). Sidebar lists **People**, **Organizations**, **Reports**, and **Settings** (**Families** removed from the sidebar July 2026 — household directory lives under **Reports → Families**). User-facing **Affiliation** terminology replaced with **Roles** in Contacts → Settings automatic-role rules (contact profiles no longer show an editable Roles card — roles sync from activity only). Discount tags: **Employee / Staff / Member / Volunteer / Full-Time Employee** are system-managed (auto from Workforce or Membership; not pickable on profile). **Donor** and custom tags remain manually assignable on **individual and organization** Overview → Edit. Sync preserves system tags when staff change a manual tag. Key: `lib/discount-tags/discount-tag-assignment.ts`. People/Organizations/Groups lists: search + add only (role/status dropdown filters removed); table columns **Contact** (name styled as link), **Email**, **Phone**, **Created by** (not stored yet — shows —), **Last modified**, **Status** (Active/Inactive only). No **Actions** column — edit, merge, delete, and **View Details** live on the contact profile sticky header actions menu. Removed intro banners and stat cards on type-specific list pages. Removed Teams column and team filter from `ContactsCrmList`. Team assignment remains on individual contact profiles where HR teams are enabled. **Organizations list (July 2026):** first column renamed **Organization** with column **sort** + **filter** (name); **Primary Contact** moved between organization name and Email; top search bar removed (use column filter); server-side sort via `fetchContactsList` (`sortBy`, `nameFilter`). **Groups list (July 2026):** same pattern — **Group** column with sort/filter, Primary Contact after name, no top search bar. **Individual name casing (July 2026):** ALL CAPS / all-lowercase individual contact names can be rewritten to proper case (`ABEER ZOUBI` → `Abeer Zoubi`) via `node scripts/proper-case-individual-contact-names.mjs` (dry-run; add `--execute` to apply). Organizations and groups are skipped. Create/update of individual contacts also applies the same rule. Helper: `lib/contacts/proper-case-name.ts`.

**List pagination (July 2026):** Shared `ListPagination` (`components/ui/list-pagination.tsx`) — “Showing 1 to 20 of N entries”, first/prev/page numbers/next/last, and page-size selector (10/20/50/100). Applied on Contacts People/Organizations, Contact Directory + Families, Program Registrations, Members, Employees, Volunteers, and Donors report. Helpers: `lib/ui/list-pagination.ts`.

**Contacts Reports — Phase 1 (June 2026):** Sidebar **Reports** (above Settings). Hub at `/contacts/reports`; **Contact Directory** at `/contacts/reports/directory`. **Directory tabs (July 2026):** under summary cards — **Individuals**, **Organizations**, **Families**. Contact tables show **Contact**, **Email**, **Phone**, **Roles**, **Last activity** (Type / Status / Teams columns removed). Roles are CRM affiliations (Donor, Volunteer, Employee, Member, Customer, Programs, Vendor, etc.) synced from activity — not household family roles. Families tab reuses the household directory (`components/contacts/contacts-families-directory-panel.tsx`); `/contacts/families` redirects to `?tab=families`. Summary cards: total contacts, individuals, organizations, families. Column-header filters on Contact search + Roles; CSV export for Individuals/Organizations tabs. Requires `contacts.view`. Donor giving totals remain under **Donations → Reports → Donors** (hub links there). Key files: `lib/contacts/contact-report-actions.ts`, `lib/contacts/contact-report-csv.ts`, `components/contacts/contacts-directory-report-panel.tsx`.

**Group giving attribution (June 2026 / July 2026):** When recording a payment (Donations → Payments, contact **Receive Payment**, or pledge payment), staff can optionally pick a **Group**. The gift stays on the individual contact; `payments.attributed_group_contact_id` counts it toward the group total. The picker lists **only groups the contact already belongs to** — add membership from **`/donations/groups/[id]`** first (no auto-add on payment). **UI (July 2026):** Group giving / Campaign gifts shows a single **Amount** per campaign (no Group / Attributed / Combined split) — going forward gifts are individual contributions toward the group, not pooled gifts from the group as a whole. Click Amount to see donors for that campaign. Apply **`scripts/136_payment_attributed_group.sql`** (after `135`). Key files: `lib/contacts/group-giving-actions.ts`, `components/donations/donation-group-picker.tsx`, `components/donations/donation-group-financial-panel.tsx`.

**Contacts Groups record type (June 2026 / July 2026 / August 2026):** CRM `contact_type = group` remains for giving attribution but **is not a contact profile and is not listed in Directory**. Detail UI is **`/donations/groups/[id]`** for Group Donation / Membership Group collectives. When the collective is a **Department** (linked via `linked_department_id`, or unique same-name match — auto-linked on open), Group Giving redirects to the shared **Department workspace** at **`/workforce/departments/[id]`**. **Department-level tabs:** **Overview** (department flyer + description; years/seasons as a single-column list newest→oldest; click a year → `?year={programId}` Program Overview), **Programs** (catalog), **Schedule**, **Financial**, **Reports**, **Group giving** when linked, **Events** (`?tab=activity`), **Settings**. **Year-level tabs** (require `?year=`): **Overview**, **Offerings** (`?tab=programs`), **Registrations** (`?tab=students`). Breadcrumbs: Departments → department → Programs → year name. Year-only tabs without `?year=` redirect to Overview. Legacy aliases unchanged (`offerings` → overview, finance/students remaps). Financial assistance stays at org/committee level. Apply **`scripts/167_giving_group_category.sql`**. Key files: `department-group-workspace-client.tsx`, `department-overview-panel.tsx`, `donation-group-path.ts` (`isDepartmentYearWorkspaceTab`).

**Programs Catalog offerings (July 2026 / August 2026):** `/programs/catalog` (**Program Catalog** in sidebar/title) and customer **`/customer/programs`** show **active** `program_offerings` (not year/season rows). Cards: **program name on top** (bold), **offering name** as blue link; flyer falls back to parent program flyer; family filters: **Gender** (All / Male / Female), **Audience** (All / Youth / Adult; **Age** only when Youth). **Public (no-login) catalog:** `/o/[orgSlug]/programs` — same cards/filters; only programs with `visibility = public`; offering click → `/join/[orgSlug]?next=/customer/programs/...` to register. Staff copy link on Program Catalog + Settings → Users join links. Branding edited on offering Overview / program Configure. Apply **`scripts/191_offering_catalog_branding.sql`**. Key files: `offering-catalog-view.tsx`, `offering-catalog-queries.ts`, `public-offering-catalog-queries.ts`, `program-catalog-filters.tsx`, `app/o/[orgSlug]/programs/page.tsx`.

**Department Head portal access (July 2026):** Department Heads (`staff.is_department_head` + `department_id`, set on CRM Employment) get **Staff Tools** even without org-wide `staff.view`. Staff Tools shows **My department** → department workspace. Admin sidebar injects **My department** when the user is a head but lacks `staff.view` (full Workforce roster stays admin-only). Application evaluation requires `canManageDepartment` (or `programs.manage` for orphan years). Key files: `lib/departments/department-headship.ts`, `lib/auth/staff-tools-eligibility.ts`, `app/(customer)/customer/staff/page.tsx`, `components/layout/sidebar.tsx`.

**Department Financial vs Reports (August 2026):** **Schedule**, **Financial**, and **Reports** live on the **department** workspace (not year/program). **Schedule** sub-views: **Class times** (weekly `program_schedule_items` + sessions; **Space** column from `venue_id` / venue name) | **Activity planner** (`schedule_activities` Schedule Builder, department-scoped; `?section=activity-planner`). Schedule header CTAs: **Check space availability** → Facilities; **View Master Calendar** → Events. Operating **Financial** sub-tabs: **Employees** (staff roster; click a row → side-sheet **employee profile** in edit mode — position, job role, department, hire date, staff type/status, pay basis/rate, email/phone, recent pay periods & hour logs, link to contact profile; Remove blocked when department pay entries or hour logs exist) | **Payroll** (KPI cards: **Employees** + **Amount** only; Log hours / Create pay period actions; no pay-period list; Finance → Payroll queue for Mark paid) | Expenses | Financial Summary. Scoped to **open** years only (`draft`/`active`/`paused`). Closed-year history is under **Reports** (same sub-tabs; year picker; read-only employees/periods). URLs: `?tab=schedule`, `?tab=schedule&section=activity-planner`, `?tab=financial` (default Employees), `?tab=financial&section=payroll|expenses|budget`, `?tab=reports`. Legacy `?year=&tab=financial|schedule|reports` drops `year` and stays on the department tab. Key files: `department-group-workspace-client.tsx`, `department-payroll-panel.tsx` (`variant=roster|periods`), `department-employee-profile-sheet.tsx`, `finance-payroll-queue-panel.tsx`, `department-reports-panel.tsx`.

**Department Registrations tab (July 2026 / August 2026):** Enrollments + Applications merged into **Registrations** (UI label; URL `?tab=students`). No page title strip — KPI cards first (**Applications**, **Approved**, **On roster**, **Active / enrolled** — counts from applications + enrollments, not enrollment-only), then stage tabs (**Applications** / **Approved** / **Registrations**), then stage content. Applications table: **Program** column shows offering name only (no year/season line); column header filters for Participant (name search), Program (select), New / Returning. **Click a row** to open the application form **dialog** (editable; multi-select courses with checkboxes; full name, returning/new, new-student background, babysitter, payment preference). List has **batch** Approve selected / Not approve selected (checkboxes); no per-row Approve buttons — single approve / not approve / un-approve are inside the dialog. **Last Updated** shows staff who approved/not-approved (`evaluated_by` + `evaluated_at`) when present, otherwise last staff save (`updated_by_user_id` + `updated_at`) — not the applicant submit time (run **`scripts/237_program_application_updated_by.sql`**). **Un-approve** returns an approved-but-not-registered application to Applications (`submitted`) for re-review. Answers stored in `program_applications.application_answers` (run **`scripts/236_program_application_answers.sql`**; includes `requested_offering_ids` for multi-course). No year/season filter (typically one open year). Program filter remains on roster. Legacy URLs `?tab=rosters|enrollments|applications` map to Participants. Key files: `department-students-panel.tsx`, `department-applications-panel.tsx`, `department-application-detail-sheet.tsx`, `program-application-form-fields.tsx`, `department-participants-panel.tsx`.

**Department Years/Seasons = Programs Catalog (July 2026 / August 2026):** Program cards live on the department **Programs** tab (`?tab=programs` **without** `?year=`; `department-programs-catalog-panel.tsx` — list, **+ Add Program**, **Configure**, archive). Legacy **Years/Seasons** URLs (`?tab=offerings`) open Overview. Sellable **Offerings** for a selected program live on year **Offerings** (`?tab=programs&year=`). Opening a program lands on **Program Overview** (`?year=` or `?tab=overview&year=`). Programs **Catalog** (`/programs/catalog`) is an **active-offerings** org-wide browse (read-only cards; search + department filters; flyer or background color). Create/edit offerings from year **Offerings**. `/programs/[id]` with a `department_id` redirects to the department workspace (year Overview, or Settings → Program defaults when `?tab=settings`). Orphan programs (no department) keep standalone detail. Staff UI: Program = `programs` row; Offering = `program_offerings` row (`lib/programs/program-display-labels.ts`).

**Program single-session registration column (July 2026):** Saving program Overview failed with missing `programs.single_session_registration_enabled`. Run **`scripts/189_program_single_session_registration.sql`** in Supabase. App updates retry without the column if still missing so identity edits can save; run the SQL to enable the flag fully.

**Department Overview + Programs tab (July 2026 / August 2026):** Department-level tabs: **Overview | Programs | Schedule | Financial | Reports | Group giving | Events | Settings**. **Overview** = department flyer + rich-text description (`departments.description`) + **Terms and Conditions** (rich text `departments.terms_html` + optional PDF `departments.terms_pdf_url`; run **`scripts/241_department_terms.sql`**; PDF uploads reuse `program-flyers` via `uploadDepartmentTermsPdf`). **Programs** = program cards (newest→oldest); click opens year workspace on **Overview** (`?year=`). **+ Add Program** (optional copy of courses + teachers), **Configure** dialog, Super Admin **Close program** early; programs also **auto-close** after `end_date`. Closed programs remain clickable. Legacy **archived** status filtered out. Operating program tabs include `closed` via `DEPARTMENT_WORKSPACE_PROGRAM_STATUSES`; **Financial** still uses open years only for live ops. Catalog open-only (`draft`/`active`/`paused`). Run **`scripts/199_program_status_closed.sql`**. Key files: `department-overview-panel.tsx`, `department-programs-catalog-panel.tsx`, `department-terms-actions.ts`, `rich-text-editor.tsx`, `lib/ui/rich-text.ts`, `department-group-workspace-client.tsx`, `department-year-configure-dialog.tsx`, `department-year-actions.ts`, `department-year-auto-close.ts`, `department-active-programs.ts`.

**Program Overview (August 2026):** Year/program workspace tabs: **Overview | Offerings | Registrations**. **Overview** (`?tab=overview&year=` or bare `?year=`) shows Configure Program fields (`ProgramBasicsSection`: name, dates, eligibility, flyer, status/visibility) with Save — same payload as the catalog **Configure** dialog (`updateProgramBasics`). Header trail: `… › {department} › Programs › {program}` — **Programs** links to the department Programs catalog (`?tab=programs`). Schedule, Financial, and Reports moved to the department workspace. Key files: `department-program-overview-panel.tsx`, `department-year-configure-dialog.tsx`, `program-basics-section.tsx`.

**Sunday School 2026–2027 import (August 2026):** Workbook `Sunday_School_Master_Registration_Report.xlsx` (**Master Registration Report** + Rosters + Registrations + Payments) → Education → year **`Sunday School 2026-2027`** → offerings **Age 4-6**, **Age 7-9**, **Age 10-14**. Parent identity and fees/discounts/due come from Master (**Financial Row = Yes**). **Money received** (amounts + dates) comes from the **Payments** sheet: `REGISTRATION_AMOUNT` → tuition schedules on the family host charge; `ADDONS_AMOUNT` → transaction-fee addon schedules. Master “Registration Paid” is not used for timeline amounts. Fee: **$120**/student with **5% sibling discount** ($114 for 2nd+); staff families **50% staff discount**; Habiba Hassan **3% full-payment** on $234 list, paid $240 (extra $6) — do not treat her $2,042.82 subscription payment as tuition. Transaction fee $5 (staff half). Skip Zachie/Ihab Neel and withdrawn/cancelled (Walaa Hatamleh, Rosemary Admiral). Monthly rows → 9 `program_payment_plans`. Idempotent tag `SUNDAY_SCHOOL_2026_27_V2`. Script: `node scripts/import-sunday-school-2026-2027.mjs` / `--execute`. Repair already-imported payments: `node scripts/repair-sunday-school-payments-from-sheet.mjs` / `--execute`. Report: `scripts/reports/sunday-school-2026-2027-*.json`.

**Sunday School 2026–2027 operational cleanup (August 2026):** Cleared enrollments/charges/plans for redesign — **150** enrollments, **208** charges, **150** payment plans, **81** charge lines removed for program **Sunday School 2026-2027** only. **Kept:** contacts, people, family relationships, tags, the program row, and offerings Age 4-6 / 7-9 / 10-14. Script: `node scripts/cleanup-sunday-school-2026-2027-registrations.mjs` / `--execute`. Backup under `scripts/backups/sunday-school-2026-2027-cleanup/`.

**QIL year import (July 2026):** Historical QIL 2025–26 roster + Stripe payment CSV → department / **one year program** `Quran Institute for Ladies 2025-2026` / **course offerings** / enrollments / `program_charges`. Requires **`scripts/174_enrollment_unique_per_offering.sql`** (unique active enrollment is per offering so students can take multiple courses). If courses were wrongly created as `QIL — {course}` programs, consolidate with `node scripts/migrate-qil-courses-to-offerings.mjs --execute` after running 174. Import: `node scripts/import-qil-year.mjs` / `--execute`. Display fix for imported rows: `node scripts/fix-qil-enrollment-display.mjs --execute` sets adult contact fields; `node scripts/fix-qil-registered-date.mjs --execute` sets `enrollment_date` to **2025-09-01** (Enrollments Registered). Contact profiles + **Programs** affiliation (`program_participant`): run **`scripts/175_split_customer_programs_affiliation.sql`**, then `node scripts/sync-qil-participant-contacts.mjs --execute`. Report: `scripts/reports/qilts/qil-import-YYYY-MM-DD.json`. Department **Participants** roster = names/courses/teachers only; payments under **Programs → Reports → Registrations**; **Financial Summary** uses billing totals.

**QIL 2026–2027 applications import (August 2026):** Google Form export `QIL2026-2027.xlsx` → year program **`Quran Institute for Ladies 2026-2027`** (already active) as **`program_applications`** with status **`submitted`** (Registrations → **Applications**). Maps Excel course labels (including typos / In Person vs online) onto offerings; creates missing courses (Preparing for Ijaza, Al-Ajurrumiyyah, Recitation Improvement online/in-person, Memorization 1/2). Tag `QIL_2026_27_APPS_V1` in `evaluation_notes` with fee/discount. Idempotent on contact email + offering. Script: `node scripts/import-qil-applications-2026-2027.mjs` / `--execute` (`--file` optional). Report: `scripts/reports/qil-2026-2027-applications-*.json`. **2025–2026** year remains **`closed`** (historical roster kept). Department **Roster** year filter defaults to the current open year (`draft`/`active`/`paused`), not “All years”. **English names:** returning students often applied with Arabic names — `node scripts/fix-qil-2026-2027-english-names.mjs --execute` remaps via email/phone (plus prior QIL enrollments / payment CSV), repoints to existing English contacts, deletes Arabic duplicate contacts, and transliterates only when no English contact exists.

**QIL 2026–2027 offerings import (August 2026):** Same workbook sheet **`Offerings`** (Course, Delivery, Fee, Full Payment Discount, Primary Instructor) → fee plans + primary instructors on year `Quran Institute for Ladies 2026-2027`. Beginner/Advanced/Osool map to **Tajweed (…)**. Fee = total course tuition; installments = \$50/mo × 9 for \$450 (or \$25/mo × 9 for \$225); **Pay in Full** discount is **fixed \$** (`fixed_amount`). Al-Ajurrumiyyah is free. Sets Memorization Baqara/Omran **delivery to online**. Creates missing `staff` rows (e.g. Abeer Abukawan) and `program_staff_assignments` (`primary_instructor`). Script: `node scripts/import-qil-offerings-2026-2027.mjs` / `--execute`. Report: `scripts/reports/qil-2026-2027-offerings-*.json`.

**QLH (Education) registrations import (July 2026):** Excel `QLH_Registrations.xlsx` (sheet `QLH2526`; Year column has both years) → department **Education** / existing year programs **`QLH 2024-2025`** and **`QLH 2025-2026`** / default offering **`QLH Registration`** each / youth enrollments. Parents matched by email then phone (emergency-contact blob when Parent columns are empty); minors as `people` under the parent (`child_person_id`, no child contact). Bad DOB text falls back to Excel serial. Idempotent via import-key notes + child+offering unique. Script: `node scripts/import-qlh-registrations.mjs` / `--execute` (`--xlsx` optional). Reports: `scripts/reports/import-qlh-registrations-*.json`. Optional household fold: `node scripts/sync-summer-camp-households.mjs --all-parents --execute`.

**Household Families = adults + minors (July 2026):** Contacts → Reports → **Families** is a household **directory** (not a second profile; removed from Contacts sidebar). Contact is canonical; family is an extension on the contact (spouse/kids, household name/head). List shows primary email/phone/address + member count and opens the primary contact. Legacy `/contacts/families` redirects to the Reports Families tab; `/contacts/families/[id]` redirects to that contact. Adults keep CRM contacts; minors are `people` under the parent with **no** contact profile via `family_members.person_id` (SQL **`196`**). Default household name uses the kids’ last name (e.g. **Suleiman**), without a “Family” suffix. First adult added is head/primary (changeable on the contact Family card). One household even when kids are linked under both parents. Linking a spouse/partner imports that contact’s children into the shared household and mirrors them on both Family panels (`importContactDependentsIntoHousehold`; repair: `node scripts/repair-household-spouse-dependents.mjs --anchor <id> --member <id> --execute`). Strip existing suffixes: `node scripts/strip-household-family-suffix.mjs --execute`. Camp backfill: `node scripts/sync-summer-camp-households.mjs --execute` after 196. Key: `family-name.ts`, `family-sync.ts`, `contact-family-panel.tsx`, `family-settings-panel.tsx`, `fetchFamilyListSummaries`.

**Minors = people under parent Contact (July 2026):** Same model as QIL **Contact + Participant**. CRM **contacts** are adults (parent/guardian / adult participants). Minors are `people` linked via `person_relationships` under the parent contact — **no contact profile**, no Programs affiliation on the child. Youth registration uses `p_participant_person_id` (SQL **`195`**); enrollments store `child_person_id` and leave `participant_contact_id` null for minors. Do not auto-create contacts after enrollment. Summer Camp cleanup: `node scripts/cleanup-summer-camp-minor-contacts.mjs --execute`. Link kids on parent Family panels: `node scripts/link-summer-camp-participants-under-parents.mjs --execute` (repair sibling parent-person dupes with `repair-summer-camp-parent-people.mjs` if needed). **Roster enrichment (kids DOB / gender / grade):** run **`198_people_grade.sql`**, then `node scripts/enrich-summer-camp-kids-from-roster.mjs --csv "C:/Users/danan/Downloads/Summer Camp 2026.csv" --execute` (fills empty fields only). **Parents (phone/address/emergency notes + spouse email links):** `node scripts/enrich-summer-camp-parents-from-roster.mjs --execute`, then `node scripts/sync-summer-camp-households.mjs --execute`. Roster / family UI: participant names are plain text; parent links to the Contact. Key: `program-registration-actions.ts`, `program-enrollment-actions.ts`, `customer-family-actions.ts`, `contact-profile-admin-actions.ts`.

**Program kinds (July 2026 / August 2026):** Same Programs menu, two modes — **`academic`** (year + offerings) and **`seasonal`** (camp/season; may have multiple offerings for age/gender bands). Column `programs.program_kind` (SQL **`193`**). **Org packaging (Aug 2026):** `organizations.program_kinds` = `academic` | `seasonal` | `both` (default both; SQL **`246`**). **Phase 6:** editable on Platform Admin → Organizations → Modules (**Program modes**) and tenant **Billing** (super-admin) via `organization-program-kinds-settings-card.tsx` + `PATCH /api/platform/organizations/[id]/program-kinds`. Create UI and APIs hide/reject modes outside the entitlement. **Policy (hard validation):** academic = full-program registration + monthly tuition allowed; seasonal = session/day-pass packages, no monthly academic tuition — `lib/programs/program-kind-policy.ts`. **Phase 2 (Aug 2026):** Kind terminology via `getHierarchyLabels` / `getReportHierarchyLabels` (Year↔Season, Offering↔Program); department catalog **Add Year** / **Add Season** entry CTAs; year workspace tab labels follow selected program kind; create can lock kind with `?kind=`; Registrations + Payment Summary reports add **Type** (Academic/Seasonal) filter with matching labels. **Phase 3 (Aug 2026):** Same Type filter + kind-aware labels on Enrollments, Add-ons, and Transactions (`org-reports-client.tsx`; Academic/Seasonal selection hides donation rows). **Phase 4 (Aug 2026):** Report Type presets sync to URL `?kind=` (`hooks/use-program-kind-report-preset.ts`); report nav keeps the preset across tabs; Attendance + Waitlist include Type filter. **Phase 5 (Aug 2026):** Known-kind staff UI (create/edit form, year configure/defaults, offerings section, detail header, registration detail, year breadcrumb) uses `getHierarchyLabels`. Seasonal create makes one leaf offering by default; staff can add more offerings. Key: `program-kind.ts`, `program-kind-policy.ts`, `program-display-labels.ts`, `program-kind-report-preset.ts`, `organization-program-kinds.ts`, `organization-program-kinds-settings-card.tsx`, `department-programs-catalog-panel.tsx`, `program-form.tsx`, `programs-registrations-table.tsx`.

**Department-home program navigation (July 2026):** Department-linked years/seasons open manage under **`/workforce/departments/[id]/programs/[programId]/offerings/[offeringId]`** so the sidebar stays on **Programs/ Events → Departments**. Legacy `/programs/.../offerings/...` redirects when `department_id` is set. Helper: `programOfferingManageHref(..., { departmentId })`. Department Programs / Schedule / Students / Payments links use the department-scoped URL. Breadcrumbs: Department → Programs tab → offering. Department **Add program** includes Academic vs Seasonal type; Seasonal skips inherit defaults and creates a new camp product (no Tajweed placeholder).

**Summer Camps 2026 import — Phase 1 payments (July 2026):** Stripe-style CSV `SummerCampsPayments2026.csv` → department **Recreational Camps** / year **Summer Camps 2026**. Originally two offerings (Camp One / Camp Two); **merged (July 2026)** into one **Summer Camp** offering (Jun 1–Jul 23, eight Mon–Thu week sessions). Parses **Payment Remarks** for Registered Members, fees, add-ons (childcare → separate `addon` charge), and Coupon Code (`FA*` → FA awards; week/day-pass coupons → selected sessions weeks 1…N; `STAFF*` / credits → staff discount tagged for a later payroll phase). Full refunds → cancelled enrollments. Script: `node scripts/import-summer-camps-2026.mjs` (dry-run) / `--execute`. Merge: `node scripts/merge-summer-camps-2026.mjs` / `--execute`. Report: `scripts/reports/summer-camps-2026-*.json`. Archived Camp Two shell removed after merge: `node scripts/delete-summer-camp-two-merged.mjs --execute` (cancelled leftover enrollments cleared; payment charges

**Summer Camp split offerings reassignment (August 2026):** After staff created age/gender offerings, all ~476 enrollments still sat on **PK - KG**. Clean roster Excel `Summer_Camp_Combined_Clean_Roster.xlsx` drives repair: enrich DOB/gender/grade, map to offerings via **Grade Group** (fallback upcoming grade/age), and set session weeks from **Camp 1** (Jun 1–25 → Weeks 1–4) / **Camp 2** (Jun 29–Jul 23 → Weeks 5–8). Script: `node scripts/apply-summer-camp-clean-roster.mjs` / `--execute` (`--xlsx` optional). Older grade/gender-only dry-run: `reassign-summer-camp-offerings-by-age-gender.mjs`. **Executed August 12, 2026** against `Summer_Camp_Combined_Clean_Roster.xlsx` (476 matched enrollments split by Grade Group; Camp 1/2 session weeks applied). retained on Summer Camp). **Pricing (merged camp):** week-count tuition tiers (1→\$135 … 8→\$900) via fee plan `metadata.session_count_tiers`; registration fee \$0; sibling discount **5% on tuition only**. Quote engine support: SQL **`190`**. **Later phases:** master workbook (kids ages, staff, volunteers, payroll, expenses) and staff payroll deductions.

**Summer Camp staff payroll import (August 2026):** Workbook `CampStaffHoursPayments.xlsx` sheet **Staff_Summary** → department **Recreational Camps** staff roster + two **approved** pay periods (`2026-06-01_2026-06-25` Camp 1, `2026-06-29_2026-07-23` Camp 2 — custom `period_key` date-range form). Amount = hours × rate per camp; creates contacts/staff when missing; volunteers sheet ignored for now. Script: `node scripts/import-summer-camp-staff-payroll.mjs` / `--execute` (`--xlsx` optional). Report: `scripts/reports/summer-camp-staff-payroll-*.json`. Tag `SUMMER_CAMP_STAFF_PAYROLL_2026_V1`.

**Programs vs Customer affiliations (July 2026):** Split the unified Customer tag. **Programs** (`program_participant`) = program enrollments as participant, registrant (parents), or **payer**, or a paid `program_charges` row. **Customer** = events/ticketing + venue rentals only. Apply **`scripts/175_split_customer_programs_affiliation.sql`**, then **`scripts/197_fix_sync_affiliations_programs_payer.sql`** (fixes broken `vendors.contact_id` in sync RPC + payer rule). Backfill without RPC: `node scripts/backfill-programs-affiliation.mjs --execute`. Settings toggles under Contacts → Affiliations. Key files: `contact-affiliation-rules.ts`, `contact-affiliation-sync.ts`, `contact-constants.ts`.

**Programs → Reports tabs (July 2026 / August 2026):** Sidebar **Reports** is a top-level item at the bottom of the **Programs/ Events** drawer (not under the **Programs** group). Opens `/programs/registrations`. Shared report tab bar (`ProgramsReportsNav`): **Registration** | **Enrollments** (`/programs/reports/enrollments`) | **Transactions** (`/finance/transactions`) | **Add-ons** (`/programs/reports/addons`) | **Payment Summary** (`/programs/reports/tuition-plans`) | **Waitlist** | **Attendance** | **Child Care** (`/programs/reports/childcare`) | **Payroll** (`/finance/payroll`). Former **Overview** tab removed — KPIs merged into Registrations. Bare `/programs/reports` redirects to Registrations. Legacy `?tab=transactions` redirects to Transactions; `?tab=childcare` → Childcare; `?tab=enrollments` → Enrollments; `?tab=tuition-plans` / `?tab=payment-summary` → Payment Summary; `?tab=addons` / `?tab=add-ons` → Add-ons. Event Management **Reports** removed — `/event-management/reports` and `/event-management/reports/childcare` redirect here. `/programs` redirects to Catalog. **Programs** drawer item uses in-page tabs **Catalog** | **Schedule** | **Calendar** (`ProgramsSectionNav`). **Registrations** uses **open** years only (`draft`/`active`/`paused`) via `getOpenPrograms()` — after archive, live totals reset; closed years remain on the department operating tabs.

**Programs → Reports → Enrollments (August 2026):** One row per participant (not family-grouped). Columns: **Contact**, **Participant**, **Date of birth**, **Age**, **Gender**, **Allergies**, **Photo consent**, **Program**, **Offering**, **Status** (Active/Cancelled). Filters match Registrations (Department | Program | Offering | Status; default Active offerings). DOB/gender/age from `people` via `child_person_id`; allergies and photo consent from enrollment notes (Allergies hides None / N/A / “Any allergies:” placeholders and keeps real values only). **Row click** opens the person-centric **Participant profile** (`/programs/participants/[personId]`) — identity, household, enrollments, attendance, waitlist, applications, session access, authorized pickup (no financials). **Edit** on the profile updates `people` (name, DOB, gender, grade, allergies, emergency contact, photo consent; SQL `242`) and mirrors allergy/consent/emergency lines into that person’s enrollment notes so Contact Family and reports stay aligned. Contact name still opens the registrant contact. Key files: `app/(dashboard)/programs/reports/enrollments/page.tsx`, `components/programs/enrollments-report-table.tsx`, `app/(dashboard)/programs/participants/[personId]/page.tsx`, `lib/programs/participant-profile-queries.ts`, `lib/programs/participant-profile-actions.ts`, `components/programs/participant-profile-edit-dialog.tsx`, note parsers in `lib/programs/registration-report-helpers.ts`.

**Full-time employee benefit (July 2026):** Active `staff` with `staff_type = full_time` automatically get the **Full-Time Employee** discount tag and a default **50%** org benefit on **Programs** (quote + registration charge) and **Venue rentals** (approval pricing suggestions). Ticketing is excluded. Policy table: `organization_employee_benefits`. Run **`scripts/184_fte_employee_benefit_discount.sql`**. Key files: `lib/benefits/employee-benefit.ts`, `lib/bookings/venue-rental-employee-pricing.ts`, quote wrapper in 184.

**Discount tags — custom + auto-apply (July 2026):** Contacts → Settings → Discount Tags uses an **Add Tag** dialog (name, description, discount %, auto-apply toggle, module checkboxes for Programs / Venue rentals / Ticketing). Custom tags are assigned manually on individual **and organization** profiles. System tags (Member / Staff / Employee / Volunteer / FTE) still sync from activity. When auto-apply is on, programs quotes and venue rental pricing use the best matching tag percent (alongside FTE benefit; highest wins). SQL: **`scripts/202_discount_tag_auto_apply.sql`**. Key files: `components/hr/discount-policies-panel.tsx`, `lib/discount-tags/discount-tag-actions.ts`, `lib/discount-tags/discount-tag-benefits.ts`.

**Programs → Payments list (July 2026 / August 2026):** `/programs/registrations` tracks registration balances. Row actions: Receive payment, **Edit registration**, **Mark financial assistance**, Custom payment plan, Add notes, **Withdraw & settle**. Top filters: **Department** | **Program** | **Offering** | **Status** (Active/Closed; default Active). Table columns (family/contact view): **Registration date**, **Contact** (name/email/phone), **# Participants**, **Participants** (stacked names), **Registration fee**, **Total paid**, **Additional fees**, **Status** (Active/Cancelled), Actions. Registration fee is the list amount; no discount columns (registration fee is not discounted). Rows group by registrant contact + program. Family payment rollups (**Program Fees** as months × monthly fee, **Additional Fees** + type, **Received**, **Balance**, paid/partial/unpaid/refunded) live on **Reports → Payment Summary**. Helpers: `lib/programs/registration-report-helpers.ts`. KPI **Active Enrollment** counts only non-terminal enrollments on **currently active** offerings. **Open Balances** counts unpaid non-terminal enrollments in the filtered set. Key files: `programs-registrations-table.tsx`, `app/(dashboard)/programs/registrations/page.tsx`, `payment-summary-report-panel.tsx`.

**Programs → Reports → Payment Summary (August 2026):** Replaces the former **Tuition Plans** installment grid. One row per registration family (registrant contact + program). Top filters: **Program** | **Offering**. Columns: **Contact**, **Participants** (stacked), **Program Fees** (`10 × $114.00` from `program_payment_plans`, else registration total), **Additional Fees** (same months × fee style for lunch/childcare), **Type** (Lunch, Childcare, Transaction fee, etc.), **Received**, **Balance**, **Status** (Paid / Partial / Unpaid / Refunded). Route remains `/programs/reports/tuition-plans`. Key files: `lib/programs/payment-summary-report.ts`, `components/programs/payment-summary-report-panel.tsx`.

**Programs → Reports → Add-ons (August 2026):** One row per purchased add-on (not family-grouped). Tracks materials, lunch, uniforms, field trips, childcare extras, and other non-tuition charges. Columns: **Contact**, **Participant**, **Program**, **Offering**, **Add-on Type**, **Quantity**, **Amount Due**, **Amount Paid**, **Balance**, **Status** (Paid / Partial / Unpaid / Refunded). Filters: Department | Program | Offering | Program Status (default Active) | Add-on Type | Payment Status. Source: `program_charges` add-on/fee rows plus non-tuition charge lines (skips registration/tuition/discount/voided). Route: `/programs/reports/addons`. Key files: `app/(dashboard)/programs/reports/addons/page.tsx`, `components/programs/addons-report-table.tsx`, `lib/programs/addons-report.ts`, `lib/programs/addon-display.ts`.

**Finance surfaces under Programs/ Events (July 2026 / August 2026):** No separate **Finance** drawer group. **Transactions** (`/finance/transactions`) and **Payroll** (`/finance/payroll`) are tabs under **Reports**. **Financial Assistance** (`/finance/financial-assistance`) is a top-level **Programs/ Events** drawer item. Footer org **Reports** removed — payment hub lives under Reports → Transactions. Legacy `/reports` → Transactions; `/programs/financial-assistance` → FA; `/workforce?tab=payroll` → Payroll. Run **`scripts/192_finance_module_sidebar_restore.sql`** (after `187`). Key files: `lib/finance/finance-paths.ts`, `app/(dashboard)/finance/*`, `components/reports/org-reports-client.tsx`, `components/programs/programs-reports-nav.tsx`.

**Organization Reports (July 2026 / August 2026):** Formerly pinned footer `/reports`; now **Reports → Transactions**. Single payment list (Failed transactions and More reports sub-tabs removed). Top filters: **Department** | **Program** | **Offering** | **Program Status** (Active/Closed; default Active). Columns: **Payment date**, **Contact**, **Program**, **Offering**, **Payment type** (registration, program fee, late fee, lunch fee, etc.), **Amount**, **Payment method**, **Status** (Succeeded / Failed / Refunded / Voided). Status column has a filter icon. **Failed** is a declined card/payment-method charge, not a void. **Voided** is its own status and is hidden by default until Status is filtered to Voided or All statuses. Donations rows show type Donation and blank program/offering (hidden unless Program Status is All). Legacy `/reports`, `/settings/reports`, and `?tab=failed|more` redirect here. Key files: `components/reports/org-reports-client.tsx`, `lib/reports/org-payment-transactions.ts`, `lib/programs/program-payment-transactions.ts`, `lib/programs/payment-transaction-display.ts`.

**Program → Offering attributes migration (July 2026):** Program = identity/defaults; Offering = operational attributes. **S1–S6 in repo:** run **`176`–`179`**. Audience is **adult/youth only**. Catalog capacity = sum of limited offerings (Unlimited when none limited). Obsolete program capacity/eligibility columns retained for dual-read (drop later). Plan: [`docs/programs-offering-attributes-migration.md`](./programs-offering-attributes-migration.md).

**Program registration pipeline (July 2026):** Implementation started. Run **`scripts/182_program_registration_applications.sql`**. Customer **Apply** (`/customer/programs/[id]/apply`) with Returning vs New — **everyone** stays pending until department evaluation (no auto-approve) when `application_required` is true. Offerings can opt into **open enrollment** (`application_required = false`): Register & pay with no Apply/Approve — set on Add program or Registration settings. SQL **`194`**. Seasonal camps default to open enrollment. Department workspace **Applications** tab: New/Returning column, per-row and **batch approve**. Reports: **Registrations** + **Payment transactions**. Still pending: approve-other-offering UI, waitlist-on-full + offer deadline, gate Register on approval when required, FA-after-approval. Design: [`docs/programs-registration-pipeline-design.md`](./programs-registration-pipeline-design.md).

**My Classes roster (July 2026):** Personal-portal teachers (assigned staff who are not org members) need **`scripts/183_assigned_staff_offering_roster_rls.sql`** so `/my-classes/[offeringId]` can load the offering roster. Page hardened to avoid server crashes when attendance/roster RLS or columns are missing.

**Staff labels Program vs Offering (August 2026):** UI copy only — DB unchanged (`programs` = program container, `program_offerings` = sellable class). Staff see **Program** / **Programs** for catalog rows and **Offering** / **Offerings** for sellable classes (renamed from Year/Season). Department workspace tabs: **Offerings** (`?tab=programs`), **Registrations** (`?tab=students`). Shared helpers: `lib/programs/program-display-labels.ts`. Sidebar module name remains **Programs**.

**Deferred — consistent naming (do not start without a dedicated migration plan):**  
1. **Programs schema:** Rename DB to match the mental model that also fits camps — container `seasons`, sellable class `programs` (today’s `programs` → `seasons`, `program_offerings` → `programs`; FKs `season_id` / `program_id`). Routes/code follow in the same effort. Deferred to avoid breaking enrollments, billing, RLS, and imports.  
2. **Workforce routes:** Sidebar label is **Workforce** (`WORKFORCE_MODULE_LABEL`); module slug and paths remain `workforce` / `/workforce/*`. Align slug, routes, and folder names when safe (same class of rename as above — high blast radius).  
3. **Donations → Fund Development:** Sidebar/chrome label is **Fund Development** (`lib/donations/fund-development-module-label.ts`); module slug and routes remain `donations` / `/donations/*` until a dedicated DB + path rename.

**Programs → Financial Assistance tabs (July 2026 / August 2026):** Canonical hub is **Finance → Financial Assistance** (`/finance/financial-assistance`): Overview, Submissions, Templates, **Reports** (staff FA awards: participant, year/season, program, original fee, assisted fee, plan; **Remove** restores original fee and supersedes the award). Enrollment payment rollups live under **Reports → Payment Summary** (not FA). Legacy FA **Payment Plans** tab redirects to `/programs/reports/tuition-plans`. Legacy `/programs/financial-assistance` and `?tab=financial-assistance` redirect appropriately. Awards stored in `program_enrollment_fa_awards` when staff use Mark financial assistance — run **`scripts/185_program_enrollment_fa_awards.sql`** (includes note backfill). Opening Reports imports past FA from notes/charge lines only for enrollments with **no** award row yet (so Remove is not re-imported). Contact profile Program enrollments + Financial show original fee and FA plan. Key files: `fa-awards.ts`, `programs-fa-report-panels.tsx`, `payment-summary-report.ts`.

**Offering manage → overview + edit dialog (August 2026):** Offering route is an **overview** (header breadcrumb: Departments › department › **program name** › **Offerings** › offering name; last segment not clickable; parents link to department overview, program overview, and year Offerings list), clickable name + status, year · department subtitle, 3 StatCards: Primary instructor / Schedule / Enrollment, enrolled student names). **Session enrollment:** Weeks listed with live headcounts from `program_registration_session_access`; Camp 1 (Weeks 1–4) / Camp 2 (Weeks 5–8) unique-kid rollups when those date windows apply; click a week (`?session=`) for that session’s roster. **Capacity:** offering capacity is **per session** when weeks exist (Enrollment hint “Up to N per session”; week rows show enrolled/N). Registration cannot add a kid to a week that is already full — run **`scripts/244_session_capacity_per_offering.sql`**. **Full-camp priority:** staff toggle **Accept selected weeks** (`selected_sessions_open`, SQL **`245`**). Off = only complete Camp 1 and/or Camp 2 packages enroll; selected/partial weeks waitlist. On = selected weeks may enroll and waitlist auto-promotes FIFO when all preferred weeks still have seats. **`245` patches `promote_waitlist`:** no early program-capacity block (per-session via grant); resolve offering from waitlist `offering_id` then default. Edit opens in `OfferingEditDialog` using the same basics form as Add (`OfferingBasicsForm`: **Type** Academic Year / Seasonal on top, then Name, Delivery, Status, dates, instructor, gender/ages, capacity) plus foldable **Advanced Settings**. Changing Type on edit updates `programs.program_kind`. **Questions:** Add question opens a dialog (prompt, answer type text box / text area / drop-down; drop-down values comma-separated). Run **`scripts/239_registration_question_select_options.sql`** for `select` type + `options`. **Pricing:** Fees keep Amount; when any fee **Recurrence** is **Monthly**, a **Payment Options** section appears under Fees (above Billing Schedule / Discounts) with checkboxes for **Pay in Full** (`$X at registration`) and **2 Semester Payments** (`$X/2 × 2`) — not month-by-month. One-time fees hide Payment Options. Choices persist on the fee plan notes marker + plan type when saving. **Billing Schedule** (monthly pricing): summary of billing day (from program start date), first/last billing date, duration, plus month checkboxes (4 per row; uncheck to skip e.g. Ramadan). Late enrollments bill from join month through last billing date only; skipped months are never charged. Run **`scripts/238_offering_billing_calendar_summary.sql`**. Dialog Save persists basics plus any opened Advanced handlers (staff, schedule, registration, pricing) and stays on overview (`router.refresh()`). Deep link `?edit=1` auto-opens the dialog. Preview / Share / Delete live on the Offerings list ⋯ menu; Delete also in the edit dialog footer. Key files: `offering-manage-client.tsx`, `offering-edit-dialog.tsx`, `offering-session-enrollment.ts`, `session-package-priority.ts`, `selected-sessions-priority-actions.ts`, `offering-registration-questions-editor.tsx`, `offering-simple-pricing-editor.tsx`, `offering-pricing-mapper.ts`, `program-billing-schedule-view.tsx`, `program-billing-utils.ts`, `offering-simple-schedule-form.tsx`, `program-sessions-editor.tsx`.

**Programs list row actions (August 2026):** Department **Offerings** table (`ProgramOfferingsListPanel`) — row click opens overview; **name** opens overview with `?edit=1` (edit dialog). **Drag handle** reorders offerings (persists `program_offerings.sort_order` via `reorderProgramOfferings`; run SQL **`243`**). Row **⋯** menu: Preview page, Share link, **Duplicate** (name dialog; copies options/pricing/sessions/billing via `duplicateProgramOffering`), Delete (blocked when enrolled). After duplicate/delete/reorder, parent `DepartmentProgramsPanel` silently refetches via `onOfferingsChanged` (list is client state; `router.refresh` alone does not update it). Columns: Offering, Delivery, **Program Fee**, **Primary Instructor**, **Days**, **Times**, Enrollment. Fee type label **Program Fee** (DB `component_type` remains `tuition`) via `FEE_TYPE_LABELS` / `FEE_COMPONENT_TYPE_LABELS`. Key files: `program-offerings-list-panel.tsx`, `department-programs-panel.tsx`, `department-programs.ts`, `lib/programs/program-offering-actions.ts`, `lib/programs/program-offering-duplicate-actions.ts`, `lib/programs/offering-pricing-simple-types.ts`.

**Add Offering dialog fields (August 2026):** Shared `OfferingBasicsForm` with Edit — Type (Academic Year / Seasonal), Name, Delivery, start/end + enrollment dates (default from year), primary instructor, gender, min/max age, capacity, optional one-time tuition fee, and open-enrollment toggle. Instructor picker lists **employees of the department** (`staff.department_id`); assignment via `createProgramStaffAssignment`; fee via `saveOfferingFeePlans`. Key files: `offering-basics-form.tsx`, `program-offerings-list-panel.tsx`, `offering-edit-dialog.tsx`, `program-staff-assignment-queries.ts`.

**Enrollment Window & Eligibility layout (July 2026):** Offering Settings (merged former Enrollment tab) uses horizontal card rows — **Enrollment Window & Type** (multi-select checkboxes for Entire Program / Selected Sessions / Single Session; opens/closes dates; live Open/Closed status badge; waitlist switch) and **Eligibility** (audience, min/max age, gender). Drop-in is not offered in this UI (saving clears it). Waitlist toggle lives in the enrollment card; optional waitlist capacity stays under Capacity when waitlist is on. Key files: `offering-enrollment-window-card.tsx`, `offering-eligibility-card.tsx`, `offering-registration-panel.tsx`.

**Programs flexibility contract (July 2026):** F1–F6 complete + **F7 polish** (dept inherit create, customer effective dates, `?tab=` deep links, admin class attendance view). Run **`180`–`181`**. Contract: [`docs/programs-flexibility-contract.md`](./programs-flexibility-contract.md).

**Department Expenses tab (July 2026):** Programs → Reports **Expenses** moved to department workspace as **Expenses** (`?tab=expenses`), next to Payroll. Filters `program_expenses` by department. Key file: `department-expenses-panel.tsx`.

**Contact Financial transactions (July 2026):** All Transactions drops the Module column (Type remains). Status values are **Succeeded** / **Failed** / **Refunded** (program payments use Succeeded). Enrollment activity is excluded — only payment rows appear. Program payment dates come from `program_charge_schedule`. Every transaction row has actions: **Refund**, **Download Receipt**, **Email Receipt**; donations also get **Link to Pledge**. Key files: `contact-financial-panel.tsx`, `contact-transaction-row-actions.tsx`, `program-payment-refund-actions.ts`.

**Department operating payments / Financial Summary (July 2026):** Replaces Google Sheets trackers for departments like Qur’an Institute for Ladies. **Department tabs:** Programs, Schedule, **Financial** (sub-tabs Employees, Payroll, Expenses, Financial Summary — separate from Group giving); year workspace keeps Registrations. **Enrollments:** enrollment list (student, year/season, course, teacher, parent/guardian) with filters, cancelled/withdrawn toggle, Export CSV — no payment columns. **Schedule:** **Class times** (weekly class times + space/venue + session/term list with links to edit; CTAs for Facilities availability and Master Calendar) and **Activity planner** (Schedule Builder for `schedule_activities`, department-scoped). **Payroll:** teachers and childcare providers; log hours; create pay period for all; approve; department heads can **Edit** hours/amount and **Delete** pay lines (including approved). **Expenses:** program expense rows for the department (moved from Programs → Reports). **Financial Summary:** custom start/end periods plus a simple **By month** table (student payments, payroll, profit per calendar month); revenue from Programs billing (no student payment detail UI); approved payroll expenses. URLs: `?tab=financial` (default Payroll), `?tab=financial&section=expenses|budget`; legacy `?tab=payroll|expenses|budget` still resolve. SQLm Programs billing (no student payment detail UI); approved payroll expenses. SQL: `169`–`173`. Key files: `department-group-workspace-client.tsx`, `department-expenses-panel.tsx`, `department-programs-panel.tsx`, `program-catalog-view.tsx`.

**Finance / Payroll (July 2026):** Org payroll queue is **Finance → Payroll** (`/finance/payroll`). Department heads still approve pay on department Financial → Payroll; approved lines appear as **Ready to pay**. Staff with `finance.manage` can **Mark paid** (status `paid` + `paid_at`). Childcare providers show a Childcare badge. Run **`scripts/187_finance_module_and_payroll_paid.sql`** and **`scripts/192_finance_module_sidebar_restore.sql`**. Event childcare hours: (1) Event Management → event → Childcare → **Log provider hours** (department from the event), or (2) Reports → Childcare Registrations → **Log hours** on a session card (standalone sessions require a department picker). Writes `department_staff_hour_logs.childcare_event_id`; run **`scripts/188_hour_logs_childcare_event.sql`**. Queue shows event names. Legacy `/workforce?tab=payroll` redirects to Finance Payroll. Key files: `lib/finance/org-payroll-queue.ts`, `lib/child-care/childcare-event-hours.ts`, `components/finance/finance-payroll-queue-panel.tsx`, `components/child-care/childcare-registrations-client.tsx`.

**Late program payments / academic year (July 2026):** One-time QIL fix: `node scripts/fix-qil-late-payment-dates.mjs --execute` moves schedule `paid_at`/`due_date` after **2026-04-30** to **2026-04-15**. Going forward, Financial Summary attributes installment months with `due_date` **clamped into the year/season** (`lib/programs/program-year-attribution.ts`); Receive payment keeps cash `paid_at` as now but clamps `due_date` into the program window so late receipts still count.

**QIL teacher payroll import (July 2026):** CSV `QIL-Teacher_Payments_2526.csv` (Sept 2025–April 2026) → `department_staff_pay_entries` as **approved** for Quran Institute for Ladies. Updates staff `pay_basis` / rates (Fadia monthly; others hourly $20). Script: `node scripts/import-qil-teacher-payroll.mjs` (dry-run) / `--execute`. Name aliases for spelling variants. Reports under `scripts/reports/qil-teacher-payroll-*.json`.

**Department Head / Director (July 2026):** Mark an employee **Department Head (Director)** on their Employment details (requires a department). Run **`scripts/186_staff_department_head.sql`**. Their contact profile shows a **Department workspace** card (like teacher **Program assignments** → Manage) with **Open workspace** → `/workforce/departments/[id]` (all tabs). Access is scoped via `canViewDepartment` / `canManageDepartment` (`lib/departments/department-access.ts`). Key UI: `contact-department-workspace-panel.tsx`, `contact-employee-panel.tsx`.

**Department-scoped access (July 2026):** Department workspace mutations/views with a known `departmentId` use `canViewDepartment` / `canManageDepartment` from `lib/departments/department-access.ts` (org `staff.view`/`staff.manage` **or** active Department Head for that department). Applies to payroll, budget periods, babysitting, year programs (`canManageDepartment` **or** `programs.manage`), department staff assign/update, and giving-group link helpers. Creating/deleting departments on the org list remains org-wide `staff.view`/`staff.manage`. SQL for head flag: `186`.

**Settings → Users list fix (June 2026):** `/settings/users` now loads members via `fetchOrganizationUsersForSettings()` (service role + `settings.users.view`) instead of browser Supabase queries limited by RLS — admins see all org members (e.g. invited Super Admins), not only their own row. Row menu supports **Change Role**, **Edit Profile** (name + login email), **Send Reset Email** (Supabase recovery link to `/auth/confirm`), and **Delete** (removes org membership; blocks self-delete and last Super Admin). Actions require org system admin or `settings.users.manage`; audit log entries: `member.profile_updated`, `member.password_reset_sent`, `member.removed`. Key file: `lib/organizations/organization-users-actions.ts`.

**Contacts add form (June 2026):** Add Contact no longer requires affiliations at create time; donor and other tags sync from activity or can be set on the contact profile.

**Merge duplicate donor contacts (June 2026):** When the same entity was imported twice (e.g. `MSAADA` and `MSAADA Educational Foundation`), merge into one canonical contact. **Individuals only** in the UI — groups and organizations cannot be merged (UI hidden; server rejects). **CLI** supports organizations and groups (moves `contact_group_members` before deleting the source group). **UI:** contact profile **Merge duplicate** (keep this record, search for the duplicate) or list row **⋯ → Merge into another contact** (remove this row, search for the record to keep). Preview shows payments/pledges moved before confirm. Requires `contacts.manage`; merge actions use the service-role client after that gate so payment/pledge counts and relinks work without separate `donations.view`. **CLI:** `node scripts/merge-donor-contacts.mjs` (`--search`, `--target-id`, `--source-id`, `--rename`, `--execute`). Logic: `lib/contacts/contact-merge.ts`, `lib/contacts/contact-merge-actions.ts`, `components/contacts/contact-merge-dialog.tsx`. Keeps the **target** contact’s name unless `--rename` is set; reassigns pledges/payments/donor rows, notes, roles; syncs all linked payment `sender_name` values to the canonical contact name; deletes source; syncs affiliations. **All Payments** list displays the linked contact/donor name (not stale import `sender_name`).

**Donor affiliation after first payment (June 2026):** … **People → Donor filter** lists contacts with at least one non-voided payment (`search_donor_giving_contact_ids`, migrations `129` + **`130` grants**), not only stored affiliation tags. **Orphan donors** (missing or stale `contact_id`) are excluded from People until linked — repair: `node scripts/link-orphan-donors-to-contacts.mjs --execute` (creates/matches contacts, merges duplicate donor rows, backfills payment `contact_id`), then `node scripts/sync-donor-affiliations.mjs --execute`. Key files: `lib/contacts/contact-list-actions.ts`, `scripts/link-orphan-donors-to-contacts.mjs`.

**Contacts search fix (June 2026):** Contact list search no longer references `primary_contact_name` when that column is absent in the database — fixes production search errors after bulk import.

**Contact profile homepage (July 2026; updated August 2026):** Sticky header with **blue clickable contact name** (opens edit dialog: Contact Information + Family + gated Delete) and **Merge duplicate** beside badges. Tabs **Overview** | **Financial** | **Activity**. **Overview** = financial KPI cards, Financial by Module, Recent Transactions, Financial Summary. **Activity** = Related Activity tiles (contact-related modules), participation/workforce panels, and the full timeline. Key files: `components/contacts/contact-profile-client.tsx`, `contact-profile-header.tsx`, `contact-profile-financial-summary-card.tsx`, `contact-financial-panel.tsx`.

**Contact profile module gating (June 2026):** Contact detail panels respect org-enabled modules from `/api/organizations/sidebar-modules` — e.g. MAS Dallas (donations-only) omits venue rentals and participation/workforce/applications surfaces under Activity (those panels appear under Activity only when the contact has relevant activity and the module is enabled). Key files: `lib/contacts/contact-profile-module-access.ts`, `components/contacts/contact-profile-client.tsx`.

**Contact profile admin parity (June 2026):** Staff contact profile **Overview** mirrors the customer portal profile: editable address, bio/notes, date of birth, gender, and family members (add/remove). Creating a new family member on staff Overview creates a **person** only (no contact profile / no People list row). Profile name links appear only for members who already have a real contact profile (linked existing contact, or contact with email/phone/roles/payments/donor record); auto-created shell contacts are not linked in the UI. **Payment methods** (stored credit/debit cards on the contact profile) are on the **Financial** tab with **Add Card** (full card number and security code at entry; only last 4, expiration, and cardholder name persist). Customer portal **Profile → Payment Methods** uses the same `ContactPaymentMethodsPanel` and persists via `lib/customer/customer-payment-method-actions.ts` (loaded in `loadCustomerProfilePortalData`). Apply migration `138_contact_payment_methods.sql`. **Date of birth** is optional on staff contact edit and when staff add a family member (email and phone optional too); it remains required on customer signup and customer family-member add. Key files: `components/contacts/contact-basics-panel.tsx`, `components/contacts/contact-family-panel.tsx`, `components/contacts/contact-payment-methods-panel.tsx`, `lib/contacts/contact-payment-method-actions.ts`, `lib/contacts/contact-profile-admin-actions.ts`.

**Family giving / households (July 2026):** Donations remain on **individual contacts** only — no `family_id` on `payments`. New tables `families` + `family_members` (migration **`148`**) backfill from `person_relationships`; removing a member sets `end_date` (gifts stay on the contact). **Contacts → Families** list is a simple household directory (family name, primary contact name/email/phone/address, member count) — not donation-tied; click a **family** or **primary contact** to open the **primary contact** profile (canonical record). Legacy `/contacts/families/[id]` redirects there. Household name / head edit lives on the contact **Family** card. **Donations → Reports → Donors** toggles **Individual Giving**, **Household Giving**, and **Group Giving** (household RPC `donation_household_giving_report` / **`149`**; group RPC `donation_group_giving_report` / **`166`**, sped up by **`268`** — only groups with gifts or attributions in the selected period). **Group Giving hang (August 2026):** Switching to Group Giving used `router.replace(?view=group)`, which refetched the reports layout and aborted the in-flight RPC, leaving the table on “Loading report…”. View changes now update the URL without a Next.js navigation; the load always clears loading in `finally`; report tabs and staff sidebar links use `prefetch={false}`. Run **`scripts/268_group_giving_report_page_join.sql`** so member/pledge columns are computed only for the current page. Tax receipts stay on the donating contact. Adding/removing family on a contact profile syncs `family_members` via `lib/contacts/family-sync.ts`. **Household management (July 2026):** Contact profile **Family** tab — **Link existing contact** joins a real contact into the household for giving rollups; create new member adds a **person** only (no contact profile / People row). Name links only when the member already has a real contact profile (not an auto-created shell). Banner links to household giving page. **Remove member** ends household membership only — the contact and all donations stay on their individual record (divorce / separation). **Household settings** on `/contacts/families/[id]` — edit household name, change primary contact / head, and remove members from the Members table (`lib/contacts/family-management-actions.ts`, `components/contacts/family-settings-panel.tsx`, `components/contacts/family-members-panel.tsx`). Linking ends the member's prior solo household when they were the only active member. Key files: `lib/contacts/family-giving-data.ts`, `lib/contacts/family-actions.ts`, `components/contacts/family-giving-detail.tsx`, `components/contacts/contact-family-panel.tsx`.

**Configurable automatic affiliations (June 2026):** Contacts → Settings → **Affiliations** lets each org turn activity-based affiliations on/off. Defaults follow subscribed modules (e.g. venue-only orgs have Donor off when Donations is not enabled). Stored in `organization_affiliation_settings`; enforced by `sync_contact_affiliations` (migration `115`). Manual affiliations on contact profiles are unchanged. Files: `lib/contacts/contact-affiliation-settings.ts`, `components/contacts/affiliation-rules-panel.tsx`, `scripts/115_organization_affiliation_settings.sql`.

**Contacts profile edit (June 2026):** Contacts list **View & edit profile** (and row click) opens `/contacts/[id]?edit=1` with the Contact information form in edit mode. Profile header includes **Edit contact**; record type and primary contact are editable on save. Files: `components/contacts/contact-profile-client.tsx`, `components/contacts/contact-basics-panel.tsx`, `lib/contacts/contact-profile-path.ts`.

**Donation contact picker (June 2026):** Add Pledge and Record Payment search **org contacts** (name, email, phone), not only existing `donors` rows. On save, `ensureDonorExtensionForContact` creates the donor extension when needed. Add Pledge shows an **Add contact** button when search returns no matches; quick-add dialog supports **Person / Organization**, primary contact name for organizations, and auto-suggests Organization when the name looks like a company (LLC, Inc, etc.). Donor affiliation syncs on **first payment**, not pledge creation. Key files: `lib/donations/donation-list-actions.ts`, `components/contacts/quick-add-contact-dialog.tsx`.

**Pledge reassignment (June 2026):** **Edit Pledge** on **Campaigns → Pledges** (`/donations/pledges`) and contact profile **Financial → Pledges** includes an **Assigned to** picker (person, organization, or group). Saving reassigns the pledge to the selected contact’s donor record and moves linked **payments** and **pledge reminders** with it; affiliation sync runs on both old and new contacts. Use this to move historical pledges from an individual to a group (e.g. Quran Institute). Key files: `lib/donations/pledge-admin-actions.ts` (`updatePledgeAction`, `reassignPledgeContact`), `components/donations/pledge-contact-picker.tsx`, `components/donations/donor-pledges-tab.tsx`, `app/(dashboard)/donations/(operations)/pledges/page.tsx`.

**Contact Financial → cross-module summary (June 2026 / layout July 2026):** Contact profile **Financial** tab is a read-only summary hub (not a second ledger). **Layout (July 2026):** KPI cards — **Lifetime Giving**, **Total Paid**, **Outstanding Balance**, **Last Payment** (each with subtitles) — plus an **All Time** period selector (All Time only for now). Two-column middle: **Financial by Module** doughnut chart and **Recent Transactions** (**View all** opens a full-list sheet). Detail sub-tabs: **Recurring** | **Pledges** | **Invoices** (placeholder) | **Refunds** | **Payment Methods** (module-gated). Right rail: **Financial Summary**, **Payment Methods**, **Statements** (and a **Membership** placeholder when the membership module is on). Footer: “All financial information is associated with {contact}.” **Open Balances** still opens from the Outstanding Balance KPI (or rail link) as a sheet; it lists unpaid pledges, venue rental payment lines, and program fee balances from existing tables. **Transactions** show actual payments only (no pledges) with the same row actions as One-Time Reports (**Refund**, **Link to Pledge**, **Download/Email Receipt**; click date still opens Edit). **Payment Plans** use donor-scoped **Reports → Recurring** actions: Edit, Change Card, Receive Payment, Pause/Resume, Cancel, New Plan; **Completed** plans are view-only — create a new plan instead of reactivating. **Pledges** use `DonorPledgesTab` (Edit, Payment Plan, Receive Payment, Mark as Paid, Cancel, reminders). **Payment Methods**: staff add cards on the Financial tab (and rail); contacts can also add cards from **Profile → Payment Methods** in the customer portal (same saved list). **Statements**: generate, preview, download, or email annual giving statements when donations apply. Profile ⋮ **Receive Payment** shows the contact name under the title (no Contact field); **Apply to** is a one-time donation, an open pledge, or an open payment plan (program/failed-payment targets to follow). The separate **Donations** filter tab was removed — gifts appear under transactions. Table columns: **Type** = activity kind (Donation, Pledge, Programs, Venue Rental, …); **Description** = campaign name for pledges, One-Time/Recurring Donation for gifts, program name for programs; **Status** = for donations: **Succeeded**, **Failed**, **Refunded**, or **Partially Refunded** (imported/unallocated gifts show **Succeeded**); for pledges: **Open**, **Partial**, **Fulfilled**, or **Cancelled**. **Date** is clickable: donation **payments** open an inline **Edit Payment** dialog; **pledges** open an inline **Edit Pledge** dialog on the same contact profile; venue rentals and other modules follow their linked record. Pledge commitments appear under the **Pledges** sub-tab; gift payments appear under transactions even when later linked to a pledge. Key files: `components/contacts/contact-financial-panel.tsx`, `components/donations/donor-recurring-panel.tsx`, `lib/contacts/contact-financial-actions.ts`. **Contact profile navigation (July 2026):** Breadcrumbs handle return paths (e.g. **Dashboard > Contacts > People**); the redundant profile back button was removed. `returnTo` query param and session-tracked paths still apply for **Open full profile** links and post-delete redirects. Key files: `components/contacts/contact-profile-client.tsx`, `lib/navigation/return-to.ts`.

**Contact Financial → Pledges + reminders (June 2026 / July 2026):** Contact profile **Pledges** section uses `DonorPledgesTab` (Edit, Payment Plan, Receive Payment, Mark as Paid, Cancel Pledge, reminders) so actions stay in sync with donor workflows.

**Payment import & match (June 2026 — unified flow):** Under **Payments** → **Import** (`/donations/payments/import`; Upload + History sub-tabs) and **Match Payments** (`/donations/payments/match`). Upload CSV → payments are created immediately in the match queue (`pending_review`) in **100-row server chunks**. **Auto-match after import** is on by default: high-confidence contact matches (≥85%, email/phone/exact name) link automatically; **name-only imports with no ≥85% match auto-create a new contact** from the payment sender name (no email/phone on the row). Weak partial matches (e.g. shared “Dr.”) are not shown as suggestions. Remainder with email/phone but no match stays for manual review. **Auto-allocate to best pledge** (default on with auto-match) uses `lib/donations/payment-pledge-allocation.ts`: prefers **lump-sum** (`one_time`) open pledges over **installment** schedules (`monthly`, `quarterly`, `yearly`); skips installment pledges when donor has an active `recurring_donation_plans` row and a lump-sum pledge exists; leaves payment **unallocated** when two pledges tie on top balance. Bulk auto-match and **Quick Apply** share the same picker. Migrations `116`–`118`. Key files: `components/donations/payment-import-match-workspace.tsx`, `lib/donations/payment-import-match-actions.ts`, `lib/donations/payment-contact-matching.ts`, `lib/donations/payment-pledge-allocation.ts`. Legacy `/donations/import` and `/donations/reconcile` redirect to the new Payments routes.

**Payment reconcile matching (June 2026):** Superseded by unified Import & Match flow above. Legacy `/donations/reconcile` redirects to `/donations/payments/match`.

**Campaign progress gauge (June 2026):** Speedometer-style fundraising gauge on `/donations/campaigns` (card grid for campaigns with goals) and campaign detail **Goal Progress**. Red/orange/green arc, needle, and total raised; supports exceeding 100% of goal. Component: `components/donations/campaign-progress-gauge.tsx`.

**Campaign source breakdown (June 2026):** Campaign detail (`/donations/campaigns/[id]`) shows fundraising metrics in a **colorful table** (Cash, Checks, Square, One-Time, Recurring, Ticket Sales, Donors, Largest Gift, Pledges last with highlight) plus **Goal Progress** gauge on the right. **Per-campaign metric customization:** **Customize** on the overview table toggles visible rows and order; **Automatic** mode (default) hides empty source rows such as Ticket Sales or Square until they have activity. Stored in `campaigns.overview_metric_keys` (migration `134`). Below metrics: **Outstanding Pledges** table for the campaign (donor with **Primary contact** subline for organizations/groups or colored group badges for individuals, pledged/paid/balance in red, status with orange **Open** badge, date, **Actions** menu linking to pledge view/edit/payment on `/donations/pledges`). Donor names open **Contact profile in a modal** (`ContactProfileDialog`) from outstanding pledges, campaign donors list, and largest-gift row. Logic: `computeCampaignSourceBreakdown`, `fetchCampaignOutstandingPledges` in `lib/donations/campaign-analytics.ts`; metric config: `lib/donations/campaign-overview-metrics.ts`; UI: `campaign-source-breakdown-cards.tsx`, `campaign-overview-metrics-editor.tsx` (`CampaignOverviewMetricsTable`), `campaign-outstanding-pledges-table.tsx`.

**Campaign workspace + phases (August 2026 — Phase A):** Opening a campaign is a tabbed workspace (`?tab=`): **Overview**, **Strategy**, **Prospects**, **Pledges**, **Donations**, **Groups**, **Wishlist**. Overview uses clear money language: **Committed** (valid pledges), **Collected** (payments), **Outstanding** (pledge balances). Each campaign has **one goal** (`campaigns.goal_amount`) — Goal Breakdown / campaign phases are no longer used. Existing phase rows can be cleared with `scripts/270_disable_campaign_goal_phases.sql` (table/columns kept unused). Pledges and Donations tabs filter the existing ledger by campaign (no duplicate financial records). Key files: `campaign-workspace-paths.ts`, `campaign-overview-tab.tsx`. Migration `260_campaign_phases.sql` remains historical.

**Single campaign goal (August 2026):** Campaigns no longer split goals into phases. Create/edit has one **Goal** field. Overview shows one Campaign Goal card (no Pre-Event / Event Day / Overall breakdown). Strategy and Wishlist no longer assign a campaign phase.

**Campaign strategy ask levels (August 2026 — Phase B):** Campaign → **Strategy** tab is a gift/ask chart (`campaign_ask_levels`, migration `261`). Org-defined ask amounts + target gift counts; Target Value = Ask × Target #. Table shows Prospects / Asked (populate in Prospects phase), Secured count, Amount Secured, Gap. Prospects may exceed target count. Nullable `pledges.ask_level_id` for later prospect→pledge conversion. Key files: `campaign-strategy-tab.tsx`, `campaign-ask-level-actions.ts`, `computeCampaignAskLevelMetrics`. Run `scripts/261_campaign_ask_levels.sql` after `260`.

**Campaign prospects (August 2026 — Phase C):** Campaign → **Prospects** tab (`campaign_prospects`, migration `262`). Links to Contacts (no duplicate people DB). Fields: suggested ask, ask level, assigned-to contact, stage (Identified default, Contacted, Pledged, Declined, No Response). **Assigned** is not a stage — it is the person column / filter only; existing `assigned` stage rows display as Identified. **Assign Donor** opens the create/edit dialog; clicking a row edits that donor, including changing the prospect contact. Record Pledge and Delete live in the dialog (no row action links; Priority is not shown). Table search plus column-header filters on **Stage** (All, Identified, Contacted, Pledged, Declined, No Response) and **Assigned** (Unassigned / Assigned, then assignee names). Pagination, bulk assign, overdue highlight. Strategy Prospects/Asked counts update from prospect rows. Key files: `campaign-prospects-tab.tsx`, `campaign-prospect-actions.ts`. Run `scripts/262_campaign_prospects.sql` after `261`.

**Prospect → pledge conversion (August 2026 — Phase D):** **Record Pledge** in the Assign Donor dialog fully creates **one** `pledges` row (amount, date, frequency, category, fund, optional wishlist item) with `campaign_id`, optional `ask_level_id`, and `campaign_prospect_id`. After save, staff stay on the Prospects tab. Prospect `suggested_ask_amount` is preserved; actual amount is entered separately. Prospect stage → **Pledged** and `converted_pledge_id` is set. Strategy secured + campaign committed use the same pledge. Action: `convertCampaignProspectToPledgeAction`. UI: `campaign-prospect-record-pledge-dialog.tsx`.

**Campaign groups (August 2026 — Phase E):** Campaign → **Groups** (`campaign_groups`, migration `263`). Lead contact, optional link to existing org group contact, stable `public_token` donation URL `/donate/g/{token}`, Copy link / Copy QR code icons, Regenerate/Deactivate. Group goals are not used in the UI (`goal_amount` column kept unused). Group detail via `?tab=groups&group=`. Metrics: pledged/collected/donors from `pledges`/`payments.campaign_group_id` (no double count). Key files: `campaign-groups-tab.tsx`, `campaign-group-actions.ts`, `campaign-group-helpers.ts`. Run `scripts/263_campaign_groups.sql`.

**Campaign wishlist (August 2026):** Campaign → **Wishlist** (`campaign_wishlist_items`, migration `267`). Campaign-specific funding priorities (not funds, not a second ledger). Target amounts do **not** add to the campaign goal. Table lists items sorted High → Medium → Low (no search/filters; no manual Order column). Funding status is derived from attributed pledges/payments (`wishlist_item_id`); project status is operational and independent (an item can be Completed but Partially Funded, or Fully Funded but still Planned). Carry-forward clones the need into a destination campaign with `previous_funding_amount` / `remaining_need_at_carry_forward` — old payments stay on the source campaign. Public items use `/donate/w/{public_token}` (Copy/QR reuse group QR helper). Reports → Campaign Performance → **Wishlist Performance**. Permissions reuse `donations.view` / `donations.campaigns.manage`. Key files: `campaign-wishlist-tab.tsx`, `campaign-wishlist-actions.ts`, `campaign-wishlist-funding.ts`. Run `scripts/267_campaign_wishlist.sql`.

**Public group donate checkout (August 2026 — Phase F):** `/donate/g/{token}` collects amount + name/email → Stripe Checkout (Connect) → webhook inserts **one** `payments` row with `campaign_id`, `campaign_group_id`, and optional `attributed_group_contact_id` (when the campaign group links an org group; membership ensured). Reuses `createOneTimeDonationCheckout` / `insertProcessorPaymentFromCheckout`. Checkout session columns: migration `264`. Key files: `campaign-group-public-actions.ts`, `campaign-group-donate-form.tsx`.

**Public group recurring + pledge emails (August 2026):** Group links support **Give monthly / recurring** (monthly, quarterly, annually) via `createRecurringDonationCheckout` with `campaign_group_id` on the plan, checkout session, and each `invoice.paid` payment. Pledge modes send a **group pledge confirmation** email (`group_pledge_confirmation`). Daily cron `/api/cron/prospect-follow-up-reminders` emails assignees with overdue prospect follow-ups (deduped via `prospect_follow_up_reminder_log`). Migration `266_group_recurring_and_fd_emails.sql`.

**Campaign overview insights (August 2026 — Phase G):** Campaign → Overview adds **Action Required** (overdue/upcoming follow-ups, unassigned, asked-without-pledge), **Team Summary** (by assignee), and **Campaign Groups** rollup. Deep-links into Prospects filters (`followUp`, `assignee`, `stage`, `pledged`). Contact Financial panel shows **Fund Development** history (prospects, assignments, group gifts) gated by `donations.view`. Key files: `campaign-overview-insights.tsx`, `contact-fund-development-history.tsx`.

**Granular Fund Development permissions (August 2026):** Added `donations.campaigns.manage`, `donations.prospects.manage`, `donations.reports.manage`. `donations.manage` still implies full access. Seed: `scripts/265_donations_granular_permissions.sql`. Import/Match accept reports.manage; campaign writes use campaigns.manage; prospect writes use prospects.manage.

**Org-wide Campaign Groups report (August 2026):** Campaign fundraising groups analytics live under **Reports → Campaign Performance → Campaign Groups** (`/donations/reports/campaigns?view=groups`). Legacy `/donations/reports/campaign-groups` redirects there. Separate from Donors → Group Giving (CRM groups). Reuses `computeCampaignGroupMetrics`.

**Public group pledge attribution (August 2026):** `/donate/g/{token}` supports Donate now, Give monthly/recurring, Pledge and pay now, or Pledge only. Pledge+pay creates a `pledges` row with `campaign_group_id` and links Stripe payment via `pledge_id` (`allocated`). Pledge-only and pledge+pay send confirmation email to the donor.

**Donations payment methods (June 2026):** Removed **Payment Methods** tab from Donations → Settings; org cards on file are managed under **Billing** (`/billing`). Existing `payment_methods` rows remain for donation source labels where referenced.

**Contact timeline reset (July 2026):** Contact profile **Timeline** tab hides import-sourced payments/pledges and events before `organizations.contact_timeline_reset_at`. Financial tab and reports are unchanged. Run migration **`154`**, then: `node scripts/clear-contact-timelines.mjs --org <uuid> --execute` (backs up and deletes `contact_activities`, sets reset timestamp). Rules: `lib/contacts/contact-timeline-rules.ts`.

**Donor contact enrichment import (July 2026):** Bulk match/create contacts from a donor directory CSV and fill missing email/phone without overwriting existing values. Tool: `node scripts/enrich-donor-contacts-from-csv.mjs --file <csv> --execute`. Matches by email → phone → exact name → fuzzy name (≥85%); creates unmatched rows; ensures `donors` extension; runs `sync_contact_affiliations` per affected contact. Report JSON under `scripts/reports/enrich-donor-contacts-*.json`.

**MAS campaign ledger import (June 2026):** Historical pledge/payment spreadsheet import via `node scripts/import-mas-campaign-ledger.mjs --file <csv> [--campaign <name>] [--execute] [--create-campaigns]`. Dry-run by default. **Payments-only import:** `--payments-only` for CSVs with **no Pledge/Balance** — one-time payments only (no pledges). With **Group Name** → group attribution + membership links (`GroupDonationsImport.csv`). Without group column → individual one-time gifts (`One-Time-Donations.csv`). Campaign alias: `Ramadan2025` → `Ramadan 2025`. **Ledger semantics:** `Pledge` = explicit commitment; `Cash`/`Checks` = direct payments; `One-time`/`CC` = one-time card payment toward a pledge; `Recurring`/`CC+` = installment payments toward a pledge. When payment columns are empty but **`Total Received`** is set (fully paid rows), that amount is used as the payment total. **Blank Pledge + payment(s)** → implicit fulfilled pledge equal to total payments on the row (no outstanding balance). Tag: `MAS_CAMPAIGN_LEDGER_V1`. Skips spreadsheet summary rows (`Total`, `Subtotal`, `Grand Total`). **Group names** (e.g. `Wednesday Halaqa`) import as `contact_type = group`, not People. **Square terminal batches:** ledger rows named `Square` import as campaign batch deposits (`source: square`, no People contact) and appear on the campaign overview **Square** line alongside Cash/Checks. **Repair existing Square donor:** `node scripts/clean-mas-ledger-square-batch.mjs --execute`. **Reclassify group mis-imports:** `node scripts/reclassify-mas-ledger-group-contacts.mjs --execute` (after migration `132`). **Repair existing imports:** `node scripts/repair-mas-ledger-implicit-pledges.mjs [--execute]` — creates missing implicit pledges and links unallocated MAS-tagged payments without re-importing. If CSV campaign spelling differs from an existing record (e.g. `Ramadan2025` vs `Ramadan 2025`), merge with `node scripts/merge-mas-ramadan2025-campaign.mjs --execute`. Erroneous summary donor cleanup: `node scripts/clean-mas-ledger-total-donor.mjs --execute`. Placeholder donor cleanup (names that are only `?`, start with `?`, or high `?` ratio without a real Latin name): `node scripts/merge-mas-anonymous-placeholder-donors.mjs [--target "Anonymous"] [--target-id <uuid>] [--execute]` — reassigns pledges/payments to the canonical Anonymous donor and deletes source donors/orphan contacts. Report: `scripts/reports/mas-anonymous-placeholder-donor-merge-<date>.json`.

**Donations pilot blockers (June 2026):** Migrations `119`–`120` — voided payments excluded from `pledge_status_view` balances and headline totals; cancelled pledges emit `calculated_status = cancelled` (excluded from Collect/allocation); portal pledge pay saves `status = allocated`. Validation: `lib/donations/pilot-blocker-validation.test.ts`. Apply: `119_donations_pilot_blocker_views.sql`, `120_donations_pilot_blocker_totals.sql`.

**Fund Development IA redesign (August 2026):** Sidebar is **Overview / Campaigns / Pledges / Donations / Reports / Settings**. Operational work (transactions, recurring plans, import/match, receipts & statements) lives under **Donations** (`/donations/payments/*`). **Reports** is an analytics landing page with Giving Summary, Donor Giving, Campaign Performance, Pledge Performance, and Recurring Giving. Date range and CSV export on Transactions / Giving Summary filter KPIs, charts, and the payment table together. Transaction columns include campaign, fund, campaign group, and receipt status; method/type/campaign/fund/group filters use stored values. Receipts has a Missing queue (`?status=missing`); year-end KPIs come from `donation_receipts` where `receipt_type = annual_statement`. No schema change — same `payments` / `pledges` / `recurring_donation_plans` / `donation_receipts` records. Legacy report URLs redirect. Key files: `donations-sidebar-children.ts`, `donation-ops-chrome.tsx`, `donation-reports-landing.tsx`, `donation-payments-panel.tsx`.

**Donations sidebar (July 2026):** Under Fund Development: **Overview**, **Campaigns**, **Pledges**, **Donations**, **Reports**, **Settings**. See August 2026 IA redesign for current destinations. **New campaign → fund (July 2026):** Creating a campaign on `/donations/campaigns` also creates an open fund under category **General Donation** with the same name (`ensureCampaignDonationFund` via `createCampaignAction`); creates the category if missing; skips if a matching fund already exists. Editing a campaign does not rename the fund. **Campaign create/edit/delete (Aug 2026):** Overview table uses server actions (`createCampaignAction` / `updateCampaignAction` / `deleteCampaignAction`). Campaign names are blue links into the workspace; edit/delete icons are not on the list. Delete lives in the workspace **Edit Campaign** dialog and is blocked when the campaign has pledges, payments, or recurring plans. Apply `scripts/258_campaigns_rls_policies.sql` for permission-aware campaign RLS (staff view/manage + org-member SELECT of active campaigns for portal pickers).

**Pledge collection merged into Pledges (June 2026):** Collect tab removed; collection reminders, last-contacted dates, and inline reminder actions live on **Campaigns → Pledges** (`/donations/campaigns/pledges#collection-queue`). Legacy `/donations/collect` redirects to the same anchor.

**Donors giving report (June 2026):** Reports → **Donors** (`/donations/reports/donors`) … Donor names link to the **canonical contact profile** Financial tab (`/contacts/[contactId]?tab=financial`), not a separate donor page. Cross-module financial summary, pledge management, giving statements, and recurring gifts live on that tab via `ContactFinancialPanel`. Legacy `/donations/donors/individuals/[id]` and `/donations/donors/organizations/[id]` redirect to the contact profile when `donors.contact_id` is set. Contact basics and notes remain on the profile **Overview** tab. Apply `scripts/127_donor_giving_report.sql`, `scripts/128_donor_giving_report_contact_id.sql`, `scripts/143_donor_giving_report_type_fix.sql` (date cast + net amounts), `scripts/144_donor_giving_report_summary_gift_count_cast.sql` (summary gift_count bigint cast), `scripts/145_donor_giving_report_email_search.sql` (search by donor/contact email), and `scripts/146_donor_giving_report_min_total_given.sql` (minimum total given filter).

**Receipts tab merged (June 2026):** Transaction receipts and year-end statements now live under **Donations → Receipts & Statements** (`/donations/payments/receipts`). Legacy `/donations/reports/receipts` and `/donations/reports/tax-receipts` redirect there. Settings → Receipts remains configuration only.

**Tax Receipts duplicate donor rows (June 2026):** `donation_donor_tax_year_totals` now groups by `donor_id` only (not `sender_name`). App merges RPC rows defensively in `mergeDonorTaxYearTotals`. Apply: `scripts/126_donation_tax_year_totals_group_by_donor.sql` (or re-run updated `125` on fresh installs).

**Pledges summary cards (June 2026):** Pledges page stat cards match Donations Overview styling (colored left border, rounded icon badges). File: `app/(dashboard)/donations/(operations)/pledges/page.tsx`.

**Donation attribution fields (June 2026 / August 2026):** Add Pledge / Record Payment / Record Pledge pick **Category** (from `donation_categories`) and **Fund** on the same row. New gifts default to **General Donation** / **General Fund** when those records exist (no “No category” / “No fund” options). Choosing a fund still fills its category; choosing a category filters the fund list. Campaign is its own row, or hidden when already locked (prospect Record Pledge). Manage categories and funds under **Donations → Settings → Categories** (`donation_categories`, `donation_subcategories`). **Fund close (July 2026):** `donation_subcategories.is_active` (migration `161`); closed funds show **Closed** in settings, are omitted from customer/staff fund pickers for new gifts, and remain on historical pledges/payments. Toggle **Accept new gifts** in the Edit Fund dialog. Settings **Funds** table defaults to **open** funds with **View all** for closed. **Customer dashboard Donation Options (July 2026):** lists every donation category (`buildCustomerOpenDonationCategories` in `lib/customer/customer-open-donation-categories.ts`); the **Specific Fund** picker appears only when that category has open funds. Categories with no open funds (or only closed funds) accept category-level gifts without picking a fund. Customer donations validate open funds in `validateCustomerDonationAttribution` (portal UI, Stripe checkout, offline server action); migration `162` blocks portal payment inserts to closed funds at the database layer. Files: `components/donations/donation-attribution-fields.tsx`, `app/(dashboard)/donations/settings/page.tsx`, `lib/donations/donation-fund-status.ts`, `lib/customer/customer-open-donation-categories.ts`, `lib/customer/customer-donation-actions.ts`.

**The Asad Realty org removed (June 2026):** Deleted dev/stress org `95c4eb7d-b151-4aa1-a489-a3c1e1289c7e` and org-scoped data (~7.5k payments, 1k donors, campaigns, contacts, etc.). **MAS Dallas pilot org preserved.** Backup: `scripts/backups/organization-delete/organization-delete-95c4eb7d-...json`. Tools: `node scripts/delete-organization.mjs` (dry run / `--execute --confirm-name=...`), `node scripts/cleanup-organization-orphans.mjs` for leftover rows. Auth users with **only** Asad membership were removed; `heyamasad220@gmail.com` kept (MAS membership).

**MAS Dallas program registrations cleared (June 2026):** Removed 4 experimental enrollments (Youth Seasonal Camps), 3 charges, 9 charge lines, and related status/lifecycle rows. Preserved programs catalog (2 programs), sessions, offerings, and registration options. Reset program `enrolled`/`waitlist` counters. Backup: `scripts/backups/program-registrations/`. Report: `scripts/reports/mas-program-registrations-cleanup-2026-06-16.json`. Tool: `node scripts/clean-mas-program-registrations.mjs --execute`.

**MAS Dallas donations seed config cleared (June 2026):** Removed `DONATIONS_DEV_SEED_V1` categories, subcategories, payment methods, campaign, seed contacts/donors, pledges, payments, and **orphaned `donation_receipts`** (2 rows left after ledger delete). Reports overview/collection/receipts should read $0 / 0 pledges after tab refresh. Tool: `node scripts/clean-mas-donations-seed.mjs --execute`. Report sub-pages refetch on navigation (`app/(dashboard)/donations/reports/**/page.tsx`).

**MAS Dallas pilot full reset (July 2026):** Pre-launch wipe of **all contacts + donations data** for org `e057e00a-e4e3-4adf-9af5-f465db1894be` (~2,510 contacts, 895 donors, 1,149 payments, 1,256 pledges, 8 campaigns) while preserving org, auth users, roles, `donation_settings`, programs catalog, and modules. Backups: `scripts/backups/mas-pilot-full-reset/`. Report: `scripts/reports/mas-pilot-full-reset-2026-07-01.json`. Tool: `node scripts/clean-mas-pilot-full-reset.mjs` (dry run) / `node scripts/clean-mas-pilot-full-reset.mjs --execute --confirm-name="MAS Dallas"`. Re-import campaigns after CSV cleanup via `import-mas-campaign-ledger.mjs`. **July 2026 re-import progress:** Organizations ledger (84 rows → 7 campaigns, 84 pledges, 41 payments); group donations (452 rows → 452 one-time payments, 37 groups, 0 pledges); one-time donations (437 rows → 434 payments, 0 pledges); **individual pledges** (`All CampaignsPledges.csv`, 373 rows → 370 pledges, 316 payments, 129 new contacts, 54 unpaid/partial). **Ramadan2025 → Ramadan 2025** duplicate campaign merged (`merge-mas-ramadan2025-campaign.mjs --execute`: 2 pledges + 1 payment reassigned, duplicate deleted). Reports: `mas-campaign-ledger-import-group-donations-2026-07-01.json`, `mas-campaign-ledger-import-one-time-donations-2026-07-01.json`, `mas-campaign-ledger-import-all-2026-07-01.json`, `mas-ramadan2025-campaign-merge-2026-07-01.json`.

**MAS Dallas Square donations import (July 2026):** `MadinaDonationsActive07032026.csv` (9,921 rows) imported via `scripts/import-madina-square-donations.mjs --execute`. Created **4 donation categories** (General Donation, Zakat, Operations, Family Emergency Takaful Fund) and **13 funds** (subcategories). **9,099 payments** inserted as unallocated import rows (`MADINA_SQUARE_DONATIONS_V1` memo tag); skipped 100 zero-amount rows, 231 within-file duplicates, 491 campaign-ledger overlaps (donor + amount vs `MAS_CAMPAIGN_LEDGER_V1`). **648 new donors/contacts** matched or created; donor affiliations synced. Report: `scripts/reports/madina-square-donations-import-2026-07-03.json`. Re-run safe (hash idempotency skips already-imported rows). **Rollback (July 2026):** `scripts/remove-madina-square-donations-import.mjs --execute` removed all **9,099** tagged payments (~$1.57M) and **502** Square-linked recurring plans created from those payments. Report: `scripts/reports/madina-square-donations-removal-2026-07-07.json`. Contacts/donors created during import were kept; **17** recurring plans from `RecurringDonations07032026.csv` (`import-madina-recurring-plans.mjs`) remain. **Recurring plan linking (July 2026):** `scripts/link-square-recurring-plans.mjs --execute` groups imported payments by donor+amount+frequency+category into `recurring_donation_plans` and sets `payments.recurring_donation_plan_id`. Explicit CSV **DAILY/WEEKLY/MONTHLY** rows plus **inferred** recurring from Square `ONE_TIME` rows (same donor+amount+category, 4+ payments over 14+ days). Plans with last payment within 60 days are **active**; older ones **completed**. Migration **`155_recurring_daily_frequency.sql`** adds `'daily'` to the frequency constraint. Contact Financial tab shows **Daily/Weekly/Monthly Recurring Donation** when `recurring_donation_plan_id` is set (`lib/contacts/contact-financial-actions.ts`). Report: `scripts/reports/square-recurring-plans-2026-07-03.json`. **Square recurring plans CSV (July 2026):** `RecurringDonations07032026.csv` (205 rows) synced via `scripts/import-madina-recurring-plans.mjs --execute` — **17 new plans** inserted, **180 existing** updated with Square status/dates/`total_payments`/`payments_made`; **Sustainers Campaign** mapped to category **General Donation** / fund **Sustainers Club**; **Qays Hawwar** skipped for manual review; 7 rows skipped (donor not found). Migration **`156_recurring_plan_payment_counts.sql`** adds `total_payments` and `payments_made` on `recurring_donation_plans`. **Category/fund repair (July 2026):** `scripts/fix-sustainers-recurring-category-fund.mjs --execute` corrected **9** plans that had category/fund swapped during import. Reports → **Recurring Donations** table shows donor, category/fund, frequency, plan start/end, total payments, amount, payments made, status, and next payment (`components/donations/donation-recurring-panel.tsx`). Row **⋯** menu (blue icon): **Edit Plan** (amount, frequency, dates, total/made counts, category/fund, notes), **Change Credit Card** (assign `contact_payment_methods` card), Record Payment, Pause/Resume, Cancel. Requires migration **`157_recurring_plan_contact_payment_method.sql`**. Report: `scripts/reports/madina-recurring-plans-import-2026-07-03.json`.

## Organization Switching

Completed

Uses:

active_organization_id

Components:

* organization-switcher.tsx
* customer-nav.tsx
* switch-organization.ts

---

# Customer Programs

Status: Partial

Routes:

* /customer/programs
* /customer/programs/[id]
* /customer/programs/[id]/register
* /o/[orgSlug]/programs (public, no login — public visibility only)

### Features

* Organization filtering
* Active program filtering
* Public no-login Program Catalog (`/o/[orgSlug]/programs`)
* Open-enrollment-only list (closed enrollment windows hidden)
* Program cards
* Enrollment badges (Open / Waitlist / Full)
* Loading states
* Empty states

### Current Issue

Customer membership lookup.

Possible causes:

* user_id mismatch
* NULL organization_members.user_id
* membership linked only by email

---

# Programs Module

Status: Active Development

## Dashboard access (June 2026)

Staff routes under `/programs/*` require the **Programs** product module to be enabled for the selected organization (`organization_modules.enabled = true`, module catalog `is_active`). Disabled modules redirect to `/dashboard` even when the user role still has `programs.view` / `programs.manage`. Layout: `app/(dashboard)/programs/layout.tsx`; helper: `lib/modules/dashboard-module-access-server.ts`.

## Staff setup UI (June 2026)

**Doc:** [programs-staff-setup-ui.md](./programs-staff-setup-ui.md)

Completed:

* **Catalog** (`/programs/catalog`) — sidebar/page title **Program Catalog**; lists **active offerings** as cards (program name on top, offering name as blue link; offering flyer or inherited program flyer; family filters: Gender All/Male/Female, Audience All/Youth/Adult, Age when Youth). Customer portal **`/customer/programs`** uses the same catalog for families. **Public browse** (no login): **`/o/[orgSlug]/programs`** (public visibility only; register via join/login). Copy public link from catalog page or Settings → Users. Run **`scripts/191_offering_catalog_branding.sql`**.
* **Program detail** (`/programs/[id]`) — only for orphan years (no `department_id`). Years with a department redirect to **Programs/ Events → Departments → Program Overview** (`?year=…`); `?tab=settings` → Settings → **Year defaults**; legacy `?tab=offerings` → Offerings; `?tab=reports` → Enrollments. Key files: `program-detail-client.tsx`, `department-overview-panel.tsx`, `department-program-overview-panel.tsx`, `department-programs-catalog-panel.tsx`, `department-year-configure-dialog.tsx`, `department-programs-panel.tsx`, `department-participants-panel.tsx`.
* **Offering manage** — Overview + edit dialog (registration, fees, schedule, staff, sessions in Advanced). Department-linked: `/workforce/departments/[id]/programs/[programId]/offerings/[offeringId]` (keeps Departments sidebar). Orphan / Programs-module: `/programs/[id]/offerings/[offeringId]` (redirects to department URL when `department_id` is set). Attendance & Waitlist: `/programs/reports?tab=attendance|waitlist`.
* **Quick Create** (`/programs/create`) — basics + eligibility; redirects to **program detail** after save (or department when assigned).
* **Retired Edit Program** (`/programs/[id]/edit`) — redirects to program detail (General) or offering manage (Offerings / legacy tab deep links). Billing route redirects to offering Fees.
* **Service Needs** on **Programs/ Events → Departments → [department] → Settings → Service Needs** (`?tab=settings&section=service-needs`). Department **Settings** also holds General / **Year defaults** (`?section=year-defaults` — year picker + `ProgramDefaultsSettingsPanel`; prefill from `?year=`), Registration / Notifications stubs (`department_program_settings`), and **Promo Codes** scoped to the whole department across years (`discount_codes.department_id`). Legacy `/programs/settings` and `/programs/settings/service-needs` redirect to `/workforce/departments`. Key files: `components/departments/department-settings-panel.tsx`, `components/departments/department-year-defaults-settings-panel.tsx`, `components/departments/department-promo-codes-settings-panel.tsx`, `components/programs/program-service-needs-settings-client.tsx`, `components/programs/edit/program-service-requirements-panel.tsx`. Apply SQL `scripts/190_department_settings_promo_codes.sql`.
* Shared section components in `components/programs/edit/` (create + detail edit reuse basics; offerings use manage panels)
* Capacity group gender/grade rules (Male/Female parallel pools)

Quick Create collects: name, type, department, description, dates, eligibility, capacity, visibility, draft/active.

Offering manage completes: registration options, fee plans, sessions/schedule, staff.

---

## Programs

Completed:

* Program CRUD
* Departments
* Eligibility fields (min/max age, grade levels, gender)
* Registration types (Offering manage → Enrollment)
* Visibility on create + edit

---

## Program Sessions

Table:

program_sessions

Supported:

* Capacity
* Enrollment counts
* Pricing
* Registration windows

**Offering manage → Registration → Sessions (July 2026):** Staff can always add/edit sessions from this section via **Add Session** (no longer gated behind Selected Sessions / Day Pass). When those enrollment types are off, a tip still suggests enabling them so customers can register per session. Sessions save immediately. Key file: `program-sessions-editor.tsx`.

Decision:

Use program_sessions.

Do not use schedule_sessions.

---

## Lunch Options

Table:

program_lunch_options

Status:

Working

Current records:

* No Lunch
* Basic Lunch
* Hot Lunch

---

## Registration Types

Supported:

* Full Program Registration
* Session-Based Registration

Field:

session_registration_enabled

---

# Registrations

Status: Partial

## Tables

* program_enrollments
* program_waitlist
* registration_carts
* registration_orders

---

## Admin Registration Management

Routes:

* /programs/registrations
* /programs/registrations/enrollment/[id]
* /programs/registrations/waitlist/[id]

Features:

* Search
* Filters (department, offering, payment bucket, status, type)
* Offering column (course; year program as subtitle)
* Adult contact = participant; minor = person under parent Contact (no minor CRM profile)
* Amount / Received / Balance columns (Status only; no Type column)
* Labels: Participant / Contact (not Child / Parent)
* Shared entry from Programs → Reports (**Payments** tab opens Registrations list)
* Stats
* Status changes
* Waitlist conversion

---

## Registration Fixes

Completed:

* Status constraint fix
* Lunch option loading fix

---

## Planned Improvements

* Enrollment-session linking
* Session capacity tracking
* Session-based registration workflow

---

# Financial Assistance

Status: Database Complete

## Program Settings

Added to programs:

* financial_assistance_enabled
* financial_assistance_open
* financial_assistance_close_date
* financial_assistance_instructions

---

## Tables

* program_financial_assistance
* program_financial_assistance_documents
* program_financial_assistance_status_history

---

## Customer Workflow

Planned Route:

/customer/programs/[id]/financial-assistance

Features:

* Application submission
* Document upload
* Status tracking

---

## Admin Workflow

Planned Routes:

* /programs/financial-assistance
* /programs/financial-assistance/[id]

Features:

* Review queue
* Approval workflow
* Status history

---

# Development Preferences

Always:

* Provide full files
* Provide exact SQL
* Provide permanent solutions
* Provide beginner-friendly instructions
* Inspect schema before creating tables
* Update `docs/` when making meaningful changes (see `docs/AI_INSTRUCTIONS.md`)

Avoid:

* Abstract explanations
* Mock data
* Duplicate systems
* Large rewrites

---

# People Management

Status: Active Development

Display label: **People Management** (module slug `hr`, routes `/hr/*`).

Migration: `scripts/013_rename_hr_module.sql` updates `modules.name` in the database.

---

## Module Rename

Completed:

* User-facing label changed from HR to People Management
* Sidebar uses `PEOPLE_MANAGEMENT_MODULE_LABEL` from `lib/hr/hr-module-label.ts`
* Page headers and copy updated across HR routes

Technical note: URL paths remain `/hr/*`; only display names changed.

---

## Employees Module Simplification

Completed:

* Employees page is roster-only (no Departments/Positions tabs)
* **Departments** is a top-level drawer item under **Programs/ Events** → `/workforce/departments` (standalone page — not a Workforce tab). **List UI (July 2026):** card grid (`DepartmentsManager`) with flyer thumb (or color + initial), name link, description, years/seasons count, and ⋯ menu (**Edit** / **Upload flyer** / **Delete**). Run **`scripts/203_department_flyer_url.sql`** for `departments.flyer_url` (uploads reuse `program-flyers` storage via `ProgramFlyerField`). Department names open `/workforce/departments/[id]`. **Department-level tabs:** Overview (flyer, description, Terms) | Programs (program cards) | Schedule | Financial | Reports | Group giving | Events | Settings. **Year-level** (`?year=`): Overview (Configure Program fields) | Offerings | Registrations. Run **`scripts/241_department_terms.sql`** for `terms_html` / `terms_pdf_url`. Employees live under Financial → Employees (roster click → employee profile sheet; Name, Position, Pay, Status). Hours / pay periods / Log hours / Create pay period live under Financial → Payroll. Legacy `/workforce/settings/departments`, `/hr/departments`, and `/workforce?tab=departments` redirect to `/workforce/departments`. Programs drawer group starts at Catalog (not Departments). **Payments** is a tab on Programs → Reports (opens `/programs/registrations`).
* **Positions** live under **Workforce → Employees → Positions** (`/workforce/employees?view=positions`). Workforce sidebar Settings removed.
* Removed: Time Off, Work Schedule, Notifications, Teams, Applications (as employee sub-tabs)
* Removed QuickBooks payroll/scheduling note from copy
* **Contact-first hiring:** Add Employee searches existing Contacts only; if none match, create the person under Contacts first, then add them as an employee (`createEmployeeFromContact`). Same pattern for Add Volunteer.
* **Workforce tabs (August 2026):** **Programs/ Events** → **Workforce** (`/workforce` → `/workforce/employees`) shows in-page tabs **Employees** | **Volunteers** | **Childcare Providers** (Departments tab removed — use the drawer **Departments** link). Deep-link paths `/workforce/employees`, `/workforce/volunteers`, `/workforce/childcare` still load the same tab shell. Org payroll Mark-paid queue is **Finance → Payroll**. Directory Applications use `?view=applications`; Positions use `?view=positions`. Key UI: `components/hr/hr-overview-client.tsx`, `components/hr/hr-overview-route-page.tsx`, `lib/hr/hr-overview-path.ts`, `lib/hr/hr-module-label.ts`. Legacy `/workforce?tab=…` redirects to the matching path; `/workforce?tab=payroll` → Finance Payroll.

### HR directory list pattern

Employees, Volunteers, and Childcare Providers share the same directory shell (`components/workforce/hr-directory-shell.tsx`):

* Header: title, subtitle, Export CSV, primary Add/Review action (default blue buttons)
* Tabs: Directory | Applications (pending count) | Positions (Employees only); Active/Inactive status filter (default Active; Archived tab removed)
* KPI stat cards, search/filters bar, avatar table, 10-per-page pagination

Key files:

* `components/hr/staff-records-client.tsx` — Employees (includes Positions view)
* `components/hr/hr-positions-manager.tsx` — job titles
* `components/workforce/volunteers-list.tsx` — Volunteers
* `components/hr/hr-childcare-panel.tsx` — Childcare Providers

Redirects:

* `/hr/time-off` → `/workforce/employees`
* `/workforce/employees?tab=departments`, legacy `/workforce?tab=departments` → `/workforce/departments`
* `/workforce/employees?tab=positions`, `/workforce/settings`, `/workforce/settings/positions`, `/settings/positions`, `/workforce/positions`, `/hr/positions` → `/workforce/employees?view=positions`
* `/settings/departments`, `/hr/departments`, `/workforce/settings/departments` → `/workforce/departments`
* Legacy `/workforce?tab=employees|volunteers|childcare` → `/workforce/employees`, `/workforce/volunteers`, `/workforce/childcare`

---

## Child Care

Status: Complete (data wiring)

**Providers:** `/workforce/childcare` (Workforce → Childcare Providers tab)  
**Customer apply:** `/customer/apply/childcare` (Profile → Applications, or **Copy apply link** on the providers directory)  
**Registrations:** `/programs/reports/childcare` (Programs/ Events → Reports → Childcare)

Completed:

* Providers under Workforce → Childcare Providers tab using the shared HR directory shell
* Customer childcare provider application intake wired to `submitApplication` (`childcare_provider`)
* Approving a childcare provider application creates/links an active `staff` row (`staff_type = childcare`, position Childcare Provider) so event/session hours can post to payroll; existing staff keep employment type and get a childcare position label. Helper: `lib/hr/ensure-childcare-staff-from-application.ts`
* Registrations under **Programs/ Events → Reports → Childcare** (moved from Event Management Reports; old `/event-management/reports/childcare` and `/workforce/childcare/registrations` redirect)
* Removed mock provider array
* Providers loaded from approved `childcare_provider` applications
* Provider detail dialog shows real `form_data` from applications
* Empty states for no providers and no event history
* Applications tab / Review Applications link to Applications Submissions tab

Pending:

* Event participation tracking (Total Hours, Events Worked, History tab)

Key files:

* `lib/hr/childcare-provider-actions.ts`
* `components/hr/hr-childcare-panel.tsx`
* `components/child-care/childcare-registrations-client.tsx`
* `app/(dashboard)/event-management/reports/childcare/page.tsx`

---

## People Management Settings

Completed:

* Removed General tab (fiscal year, timezone, employee ID format — was non-functional UI)
* Removed Roles tab from Settings UI
* Kept Discount Policies as the sole Settings content
* `/hr/discount-policies` redirects to `/hr/settings`

---

## Unified Applications Engine

Status: Active Development

Migration: `scripts/012_applications.sql`

### Database

Tables:

* `application_type_definitions`
* `applications`
* `application_history`
* `application_documents`

### Application Types (seeded)

| ID | Module |
|----|--------|
| volunteer | hr |
| employment | hr |
| committee_member | hr |
| childcare_provider | hr |
| vendor | vendor_hub |
| financial_aid | programs |

### Lib Layer

* `lib/applications/application-types.ts` — types, registry, PM hub type list
* `lib/applications/application-actions.ts` — server actions (list, stats, submit, review)
* `lib/applications/application-routes.ts` — URL builders
* `lib/applications/application-status-tabs.ts` — status tab definitions
* `lib/applications/application-nav.ts` — sidebar nav helpers

### UI

* `components/applications/applications-module-page.tsx` — shared list/dashboard component
* `components/applications/applications-overview-client.tsx` — cross-module overview
* `components/contacts/contact-applications-panel.tsx` — contact profile integration
* Application detail: `/applications/[id]`

### Sidebar Changes

Completed:

* Removed duplicate Applications under Vendor Hub settings path
* Single **Applications** entry under People Management
* Removed separate Pending / Approved / Rejected sidebar items (now status tabs/filters on one page)

---

## People Management Applications Page

Status: Relocated

Workforce application submissions no longer live under Settings. Each type opens on the matching category **Applications** view:

* Employment → `/workforce?tab=employees&view=applications`
* Volunteer → `/workforce?tab=volunteers&view=applications`
* Childcare provider → `/workforce?tab=childcare&view=applications`
* Committee member → `/membership/applications`

**Customer apply (July 2026):**
* Volunteer → `/customer/apply/volunteer` (Profile → Applications; staff **Copy apply link** on Volunteers). Approve creates/links a `volunteers` roster row (`lib/volunteers/ensure-volunteer-from-application.ts`).
* Childcare provider → `/customer/apply/childcare` (Profile → Applications; staff **Copy apply link** on Childcare Providers). Approve creates/links childcare `staff`.

**Application Templates hub removed.** Each type is reviewed under its category Applications tab (customer apply links + staff Copy apply link). **Workforce Settings removed** — Positions live under Employees → Positions (`/workforce/employees?view=positions`).

Legacy `/settings/applications` (and `/people-management/applications`) redirects to the category Applications tab based on `application_type` (default: employment). `?tab=templates` and `/workforce/settings/application-templates` redirect to `/workforce`. Legacy `/workforce/settings/committee-applications` redirects to Membership Applications. Legacy `/workforce/settings` and `/workforce/settings/positions` redirect to Employees → Positions.

Module shortcut links and directory Applications tabs open the embedded submissions list for that category.

---

## Layout

Completed:

* Sidebar logo enlarged to fill header area (`components/layout/sidebar.tsx`)
* Scale applied to compensate for whitespace in `public/logo.png`

---

# Donations

## Ledger stabilization (Priority 1 — stop new corruption)

Status: In progress (June 2026)

### Canonical tables

All new payments → `payments`. All new pledges → `pledges`. Donor identity → `donors` (via `ensureDonorExtensionForContact`).

### Legacy tables (removed June 2026)

Migrations `140`–`141` drop superseded tables after export via `scripts/cleanup-legacy-donation-staging-tables.mjs`: `donation_payments`, `donation_pledges`, `donation_amount_options`, `donor_import_*`, `contact_import_staging`, `organization_settings`, `payment_import_rows`, and `backup_*_2026_05_24` snapshots.

### Key files changed

* `app/(dashboard)/donations/campaigns/pledges/page.tsx` — pledges CRUD + record payment on canonical tables only
* `app/(dashboard)/donations/page.tsx` — dashboard reads `pledge_status_view` + per-pledge outstanding
* `app/(customer)/customer/donation/page.tsx` — portal writes to `payments` / `pledges`
* `lib/customer/customer-portal-data-actions.ts` — portal reads canonical tables
* `lib/contacts/contact-profile-data.ts` — pledge activity from `pledge_status_view`
* `lib/donations/donation-status.ts` — lowercase status values + display labels

### Pending (not in this phase)

* Committed DDL for `pledge_status_view` / `donor_summary_view` definitions (now in migrations `097`, `116`, `119`, `124`)
* Data migration / backfill from pre-2026 imports (canonical ledger is source of truth)

### Legacy cleanup (June 2026)

```bash
# 1. Export Tier 2 archives + inventory (dry run)
node scripts/cleanup-legacy-donation-staging-tables.mjs

# 2. Delete Tier 2 rows + repair payments missing donor_id
node scripts/cleanup-legacy-donation-staging-tables.mjs --execute

# 3. Apply SQL on linked Supabase
npx supabase db query --linked -f scripts/140_drop_legacy_donation_and_staging_tables.sql
npx supabase db query --linked -f scripts/141_drop_payment_import_rows_and_backup_tables.sql
```

### Dev seed + validation (canonical only)

Dev-only scripts to populate and verify the stabilized ledger.

| Script | Purpose |
|--------|---------|
| `scripts/seed-donations-dev.mjs` | Seed contacts, donors, campaigns, categories/funds, payment methods, pledges, payments, import staging |
| `scripts/validate-donations-seed.mjs` | Assert pledge balances, dashboard totals, portal write path, import/reconcile queue |
| `scripts/fixtures/donations-import-test.csv` | Sample CSV for manual import UI testing |
| `scripts/verify-donations-priority1.mjs` | Read-only integrity audit (legacy vs canonical counts) |
| `scripts/088_payments_source_type_check.sql` | Expand `payments.source_type` to manual/import/portal/processor |
| `scripts/smoke-portal-donation-payment.mjs` | One-time portal payment smoke (Seed Zelle display name) |
| `scripts/validate-campaign-analytics.mjs` | Assert campaign raised/pledged/progress math |
| `scripts/089_campaign_goals.sql` | Add `goal_amount` + `description` to campaigns |

**Run (dev Supabase only):**

```bash
npm run seed:donations-dev
# reset + re-seed: node scripts/seed-donations-dev.mjs --clean --confirm-dev
# remove seed only (no re-seed): node scripts/seed-donations-dev.mjs --clean --clean-only --confirm-dev
npm run validate:donations-seed
```

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Optional `DONATIONS_SEED_ORG_ID` to target a specific org (defaults to first org).

Seed marker: `DONATIONS_DEV_SEED_V1` (emails `donations-seed-*@dev.test`). Clean removes only tagged rows.

**Validated June 2026 (MAS Dallas dev):** 21/21 checks — pledge balances, dashboard totals, portal/import/manual writes, payment method display-name normalization, import reconcile queue; legacy tables at 0 rows.

## Attribution integrity (Priority 10)

Status: Implemented (June 2026)

### Goal

Every canonical `payments` and `pledges` write path stores `campaign_id`, `category_id`, and `subcategory_id` as foreign keys — not fund/campaign names in `memo` or `notes`.

### Shared helpers

* `lib/donations/payment-attribution.ts` — merge attribution, resolve names from CSV, fetch pledge/plan FKs
* `components/donations/donation-attribution-fields.tsx` — reusable Campaign / Category / Fund pickers

### Paths updated

| Path | File | Behavior |
|------|------|----------|
| Staff one-time payment | `components/donations/donation-payments-panel.tsx` (`/donations/payments/one-time`) | Contact picker searches all contacts; attribution pickers on insert; pledge allocate copies FKs from pledge |
| Staff pledge create/edit | `app/(dashboard)/donations/campaigns/pledges/page.tsx` | Contact picker searches all contacts; full FK pickers; edit pledge supports **Assigned to** reassignment (person/org/group) via `updatePledgeAction` |
| Staff pledge payment | `app/(dashboard)/donations/campaigns/pledges/page.tsx` | Copies pledge FKs onto payment |
| Portal one-time / pledge / pledge pay | `app/(customer)/customer/donation/page.tsx` | FKs on insert; optional campaign picker |
| Portal data | `lib/customer/customer-portal-data-actions.ts` | Payments select includes attribution columns; loads **active** campaigns only for customer pickers |
| Recurring plan create | `components/donations/donation-recurring-panel.tsx` (`/donations/payments/recurring`) | Category + fund + campaign on plan |
| CSV import | `app/(dashboard)/donations/payments/import/page.tsx` | Upload CSV + import history; `donations.manage` |
| Match payments | `app/(dashboard)/donations/payments/match/page.tsx` | Match queue; email/phone matching; bulk auto-match; add contact |
| Legacy import URL | `/donations/import` | Redirects to `/donations/payments/import` (or `/donations/payments/match` when `?tab=match`) |
| Legacy reconcile URL | `/donations/reconcile` | Redirects to `/donations/payments/match` |

### Validation

```bash
node scripts/seed-donations-dev.mjs --clean --confirm-dev
node scripts/validate-payment-attribution.mjs
node scripts/validate-campaign-analytics.mjs
node scripts/validate-recurring-donations.mjs
```

`scripts/validate-payment-attribution.mjs` — seed payment FK coverage, import attribution, campaign raised math, fund totals, recurring linkage.

**Apply migration:** `npx supabase db query --linked -f scripts/088_payments_source_type_check.sql` (or Supabase SQL Editor).

## Stripe one-time donation checkout (Priority 11)

Status: Implemented (June 2026)

### Goal

One-time online donations via Stripe Checkout write **only** to canonical `payments` after webhook confirmation. No second ledger, no unpaid portal inserts for card payments.

### Schema (migration `093_stripe_one_time_donations.sql`)

* `payments` — `stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_charge_id`, `refunded_amount`; unique index on `stripe_payment_intent_id`
* `donation_checkout_sessions` — in-flight checkout state (not a payment ledger)
* `payment_processor_events` — webhook audit + idempotency (`UNIQUE (stripe_event_id)`)

### Environment

* `STRIPE_SECRET_KEY` — Manaratee **platform** Connect key (not per-org)
* `STRIPE_WEBHOOK_SECRET`
* `NEXT_PUBLIC_APP_URL`

Per-org payout accounts use **Stripe Connect Express** (see below). `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is not used (hosted Checkout).

Stripe secrets are env-only — never stored in the database.

### Checkout flow

1. Portal card/online method → `createOneTimeDonationCheckoutAction` (`lib/donations/stripe-donation-actions.ts`)
2. Inserts `donation_checkout_sessions` row, creates Stripe Checkout Session (`mode: payment`)
3. Metadata: `organization_id`, `donor_id`, `contact_id`, `campaign_id`, `category_id`, `subcategory_id`, `checkout_type=one_time`, `manaratee_checkout_id`
4. Redirect to Stripe — **no** `payments` insert until webhook

Offline/manual methods still insert `payments` with `source_type: portal` directly.

### Webhook

`POST /api/webhooks/stripe/donations` — verifies `Stripe-Signature`, service-role Supabase. Also completes **event ticket** Checkout sessions when `metadata.manaratee_module` is `ticketing` (`completeTicketOrderFromStripeCheckout`), and applies ticket refunds on `charge.refunded` (`completeTicketOrderRefundFromStripeCharge`) before donation refund sync.

| Event | Behavior |
|-------|----------|
| `checkout.session.completed` | Insert `payments` (`source_type=processor`, `source=stripe`, `status=unallocated`, `is_verified=true`); link checkout session |
| `payment_intent.succeeded` | Idempotent fallback if checkout event missed |
| `payment_intent.payment_failed` | Mark checkout session `failed` |
| `checkout.session.expired` | Mark checkout session `expired` |

Receipts: `maybeAutoGeneratePaymentReceipt` after payment insert when `auto_generate_receipts` is enabled (`status: not_sent` only — no email).

### Key files

| Area | Path |
|------|------|
| Checkout creation | `lib/donations/stripe/checkout.ts` |
| Webhook processor | `lib/donations/stripe/processor-payment.ts` |
| Metadata | `lib/donations/stripe/metadata.ts` |
| Server actions | `lib/donations/stripe-donation-actions.ts` |
| Stripe client | `lib/stripe/stripe-server.ts` |
| Portal UI | `app/(customer)/customer/donation/page.tsx` |
| Webhook route | `app/api/webhooks/stripe/donations/route.ts` |

### Validation

```bash
npx supabase db query --linked -f scripts/093_stripe_one_time_donations.sql
npm run validate:stripe-one-time
```

**Validated (June 2026):** 14/14 — schema, checkout row, webhook payment insert, idempotency (payment + event), attribution FKs, campaign analytics delta, donor history, legacy tables untouched.

### Manual test (Stripe CLI)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe/donations
# Use test card 4242 4242 4242 4242 in portal online donation flow
```

### Out of scope (P11)

Pledge-via-Stripe. (Stripe **subscriptions** moved to Priority 16.) **Refunds** implemented separately — see Payment admin actions below. Per-org Connect moved to **Stripe Connect Express (June 2026)** below.

## Stripe Connect Express — org donation accounts (June 2026)

Status: Implemented

### Goal

Each organization connects its own Stripe Express account. One-time and recurring donation Checkout sessions run on the connected account (direct charges). **No Manaratee platform fee** on donations — 100% to the org minus Stripe processing.

### Schema (migration `139_stripe_connect_donations.sql`)

On `organizations`:

* `stripe_connect_account_id` (unique partial index)
* `stripe_connect_charges_enabled`, `stripe_connect_payouts_enabled`, `stripe_connect_details_submitted`
* `stripe_connect_onboarded_at`

### Staff UI

* `/donations/settings` → **Online Payments** tab — `DonationStripeConnectPanel`
* Connect / continue onboarding via Stripe Account Links
* Refresh status + open Express dashboard (login link)

### Checkout + refunds

* `createOneTimeDonationCheckout` / `createRecurringDonationCheckout` require a ready connected account (`charges_enabled` + `details_submitted`)
* Stripe API calls pass `{ stripeAccount: acct_… }`
* Staff Stripe refunds use the org connected account

### Webhook

Same endpoint: `POST /api/webhooks/stripe/donations`. In Stripe Dashboard, enable **Listen to events on Connected accounts**. Handles existing donation events plus `account.updated` to sync org Connect status.

### Key files

| Area | Path |
|------|------|
| Connect actions | `lib/stripe/stripe-connect-actions.ts` |
| Connect queries / request options | `lib/stripe/stripe-connect-queries.ts` |
| Account sync | `lib/stripe/stripe-connect-sync.ts` |
| Settings UI | `components/donations/donation-stripe-connect-panel.tsx` |

```bash
npx supabase db query --linked -f scripts/139_stripe_connect_donations.sql
```

### Pending

Platform subscription billing (orgs paying Manaratee monthly) — separate from Connect donations; schema stub in `121_organization_billing.sql`, not Stripe-charged yet.

### Payment edit, void, and refunds (June 2026)

Staff with `donations.manage` can edit, void, refund, and **allocate** payments from **Donor profile → Donation History** (`/donations/donors/individuals/[id]`, `/donations/donors/organizations/[id]`), **Payments → payment detail** (`/donations/payments/[paymentId]`), or **Contact Financial → Financial Activity** (click the payment date). Allocate links unallocated payments to an open pledge for that donor (`allocatePaymentToOpenPledgeAction`).

| Action | Manual / import | App Stripe (`source_type = processor`) |
|--------|-----------------|----------------------------------------|
| Edit amount/date/method | Yes | Notes only |
| Void | Yes | Blocked — use Stripe refund |
| Stripe refund (full/partial) | No | Yes |
| Record refund (ledger only) | Yes | No (except imported rows) |

Imported CSV payments (`source_type = import`) cannot receive in-app Stripe refunds even if the method column says `stripe`; staff refund externally and use **Refund** in the app.

**Totals:** migration `125_payment_refunds_net_amounts.sql` — net amount `amount - refunded_amount` in `pledge_status_view`, `donor_summary_view`, dashboard RPCs, and pledge refresh trigger (also fires on `refunded_amount` updates). Payment statuses: `partially_refunded`, `refunded`.

**Key files:** `lib/donations/payment-admin-actions.ts`, `lib/donations/stripe/refund-payment.ts`, `components/donations/donor-donation-history-table.tsx`, webhook `charge.refunded` in `lib/donations/stripe/checkout.ts`.

```bash
npx supabase db query --linked -f scripts/125_payment_refunds_net_amounts.sql
```

## Stripe recurring donation subscriptions (Priority 16)

Status: Implemented (June 2026)

### Goal

Stripe-powered recurring billing on top of existing `recurring_donation_plans`. Canonical `payments` rows are created only from `invoice.paid` / `invoice.payment_succeeded` webhooks — not at checkout start.

### Schema (migration `100_stripe_recurring_donations.sql`)

* `payments.stripe_invoice_id` — unique partial index for invoice idempotency
* `recurring_donation_plans.stripe_customer_id`
* Plan statuses extended: `pending_setup`, `past_due` (plus existing `active`, `paused`, `cancelled`, `completed`)

### Customer portal

* `/customer/donation` — tabs: **Giving Opportunities** (default; Active Campaigns + Donation Options via `CustomerDashboardGivingSection` / `customer-donation-dialog.tsx`), **My Pledges**, **Giving history**. Deep links: `?tab=giving|pledges|payments`, `?campaign={id}&action=pledge`, `?campaign={id}&give=one-time|recurring`
* `/customer/transactions` — **My Transactions** sidebar page: read-only cross-module financial summary (mirrors staff contact Financial overview)
* `/customer/donation` — **Donate** dialog: amount, frequency (one-time / monthly / quarterly / annually), campaign, category/fund; payment picker shows **cards on file** from `contact_payment_methods` (same as Profile → Payment Methods) plus org offline/online methods, with **Add new card** in-dialog
* `/customer/donation` — **Giving history** tab lists donation payments for the contact: pledge payments, recurring donations, and one-time donations
* `/customer/donation` — **New Pledge** (My Pledges tab): required **campaign** + **total pledge amount** only; pledge date is set automatically. After creating the pledge, donors use **Pay Now** (pay in full or any amount toward balance) or **Set Up Payment Plan** (monthly/quarterly/annually, number of payments, amount per payment, first payment date). Key files: `lib/customer/customer-pledge-actions.ts`, `lib/donations/pledge-payment-plan.ts`, migrations `158_pledge_payment_plan.sql`, `159_customer_pledge_plan_update.sql`
* **Admin/customer pledge alignment (July 2026):** Staff can set or edit the same installment **payment plan** on `/donations/campaigns/pledges` and donor **Pledges** tabs via `updatePledgePaymentPlanAction` + `components/donations/pledge-payment-plan-dialog.tsx` (shared validation in `validatePledgePaymentPlanInput`). Main pledges page **Record Payment** now uses `recordPledgePaymentAction` (balance cap, audit log, affiliation sync). Plan summary and suggested pay amount match the customer portal. Admin `Yearly` frequency stores as `annually` for consistency.
* `createRecurringDonationCheckoutAction` creates `recurring_donation_plans` (`pending_setup`) + `donation_checkout_sessions` (`recurring_setup`) + Stripe Checkout `mode: subscription`
* Success redirect: `/customer/donation?checkout=success&type=recurring&session_id={CHECKOUT_SESSION_ID}`

### Webhook events (`POST /api/webhooks/stripe/donations`)

| Event | Behavior |
|-------|----------|
| `checkout.session.completed` (recurring_setup) | Link `external_processor_id` (subscription), `stripe_customer_id`, activate plan; **no** payment insert |
| `invoice.paid` / `invoice.payment_succeeded` | Insert canonical `payments` with `recurring_donation_plan_id`, `stripe_invoice_id`; auto-receipt when enabled |
| `charge.refunded` | Sync `payments.refunded_amount` and status from Stripe charge totals (donation refunds). Ticket charges (`manaratee_module=ticketing` or matching `ticket_orders.stripe_payment_intent_id`) apply `charge.amount_refunded` to `ticket_orders.refunded_amount_cents` (partial keeps seats; full remaining voids tickets). |
| `invoice.payment_failed` | Log event; set plan `past_due`; no payment |
| `customer.subscription.updated` | Sync plan status + `next_payment_date` from Stripe period |
| `customer.subscription.deleted` | Set plan `cancelled` |

One-time checkout events unchanged (P11).

### Key files

| Area | Path |
|------|------|
| Recurring checkout | `lib/donations/stripe/recurring-checkout.ts` |
| Subscription webhooks | `lib/donations/stripe/processor-subscription.ts` |
| Stripe helpers | `lib/donations/stripe/recurring-stripe-utils.ts` |
| Server actions | `lib/donations/stripe-donation-actions.ts` |
| Portal UI | `app/(customer)/customer/donation/page.tsx` |
| Staff UI | `app/(dashboard)/donations/(operations)/recurring/page.tsx` |

### Validation

```bash
npx supabase db query --linked -f scripts/100_stripe_recurring_donations.sql
npm run validate:stripe-recurring
```

**Validated (June 2026):** 19/19 — subscription checkout, plan link, invoice payment insert, idempotency (invoice + event), attribution FKs, donor/recurring/campaign reporting, legacy tables untouched.

### Manual test (Stripe CLI)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe/donations
# Portal → Recurring Donation → test card 4242 4242 4242 4242
# Subscribe to webhook events: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted
```

### Out of scope (P16)

Refunds, donor self-service pause/cancel in portal, Stripe Customer Portal for card updates, per-org Stripe Connect, weekly frequency in portal (staff manual plans still support weekly).

## Transactional email delivery (Priority 12)

Status: Implemented (June 2026)

### Goal

Reliable operational email for donations only — receipts, year-end statements, and pledge reminders. No marketing, newsletters, or campaigns.

### Provider abstraction

* `lib/email/email-provider-types.ts` — provider interface
* `lib/email/providers/resend-email-provider.ts` — Resend (preferred)
* `lib/email/providers/console-email-provider.ts` — dev fallback when Resend not configured
* `lib/email/get-email-provider.ts` — provider factory
* `lib/email/donation-email-service.ts` — public API: `sendReceiptEmail`, `sendYearEndStatementEmail`, `sendPledgeReminderEmail`
* `lib/donations/donation-email-delivery.ts` — delivery orchestration + status updates
* `lib/donations/donation-email-templates.ts` — branded HTML templates with org tokens

### Environment

* `RESEND_API_KEY`
* `TRANSACTIONAL_EMAIL_FROM`
* `TRANSACTIONAL_EMAIL_REPLY_TO` (optional)

### Schema (migration `094_transactional_email.sql`)

* `transactional_email_log` — recipient, template, status, provider, `provider_message_id`, `sent_at`
* `donation_receipts.status` — adds `failed`
* `donation_settings.year_end_statement_email_template`

### Email flows

| Flow | Trigger | Status tracking |
|------|---------|-----------------|
| Receipt | Auto after Stripe payment when `email_receipts_automatically`; manual from payments UI | `donation_receipts.status` → `sent` / `resent` / `failed` |
| Year-end statement | Individual or bulk from Reports → Receipts | Same receipt row (`annual_statement`) |
| Pledge reminder | Staff send from pledges/collection UI | `pledge_reminders.status` + `delivered_externally` |

PDF attachments included for receipt and statement emails (server-generated via `jspdf`).

### Templates (editable per org)

* Receipt — `donation_settings.receipt_email_template`
* Year-end statement — `donation_settings.year_end_statement_email_template`
* Pledge reminder — `pledge_reminder_subject` + `pledge_reminder_message`

### Validation

```bash
npx supabase db query --linked -f scripts/094_transactional_email.sql
npm run validate:transactional-email
```

**Validated (June 2026):** 8/8 — schema, receipt/statement/reminder send, failed delivery logging, email log entries.

### Out of scope (P12)

Marketing emails, newsletters, donor segmentation, scheduled pledge reminder cron (manual send only).

## Beta launch hardening (Priority 13)

Status: Audit complete (June 2026)

### Validation suite (automated)

| Script | Result | Notes |
|--------|--------|-------|
| `validate:donations-seed` | 20/21 | `dashboard_totals` fails due to Stripe test payment pollution (+$67) |
| `validate:payment-attribution` | 9/10 | Same raised-total drift from test runs |
| `validate:campaign-analytics` | 6/9 | Expected values stale after Stripe validation inserts |
| `validate:recurring-donations` | 9/9 | Pass |
| `validate:stripe-one-time` | 14/14 | Pass |
| `validate:stripe-recurring` | 19/19 | Pass |
| `validate:transactional-email` | 8/8 | Pass |
| `validate:donation-receipts` | — | Fails when multiple orgs share seed campaign code (`maybeSingle` ambiguity) |
| `validate:pledge-reminders` | — | Same org-scoping issue |
| `beta:donations-stress` (quick: 1k payments) | Pass | All queries &lt; 300ms |

### Stress test (quick scale)

`npm run beta:donations-stress` — 100 donors, 1,000 payments, 100 pledges:

* `fetch_all_payments`: ~257ms
* `pledge_status_view`: ~151ms
* `campaign_analytics_bundle`: ~293ms
* `donor_search_ilike`: ~116ms

Full 10k scale not run in CI (requires explicit approval); extrapolated ~2–3s per full-org fetch at current indexes.

### Launch blockers to fix before paid customers

1. ~~Add RLS policies on `payments`, `pledges`, `donors`~~ — **Fixed (Priority 14, migration `095`)**
2. ~~Enforce `donations.view` / `donations.manage` on server actions and `/donations/*` routes~~ — **Fixed (Priority 14)**
3. ~~Add pagination to staff payments/donors lists~~ — **Fixed (Priority 15–15.5)** — payments, pledges, donors, and reports use server pagination or SQL RPCs
4. Isolate validation test data (cleanup Stripe test payments or use dedicated test org)

## Security & multi-tenant hardening (Priority 14)

Status: Implemented (June 2026)

### RLS (migration `scripts/095_donations_rls_hardening.sql`)

Permission-aware `SECURITY DEFINER` helpers: `auth_user_can_view_donations`, `auth_user_can_manage_donations`, `auth_user_contact_ids`, `auth_user_donor_ids`.

| Table | Staff SELECT | Staff INSERT/UPDATE/DELETE | Customer self-access |
|-------|--------------|----------------------------|----------------------|
| `payments` | `donations.view` or `donations.manage` | `donations.manage` | SELECT/INSERT own (`contact_id`, `source_type = portal`) |
| `pledges` | same | same | SELECT/INSERT own (`donor_id`) |
| `donors` | same | same | SELECT/INSERT own (`contact_id`) |
| `campaigns` | same (migration **`258`**) | same | org members SELECT **active** campaigns (portal pickers) |
| `recurring_donation_plans` | same | same | — |
| `donation_receipts` | same | same | — |
| `pledge_reminders` | same | same | — |
| `donation_checkout_sessions` | staff view; staff update manage | — | SELECT own sessions |
| `payment_processor_events` | staff view (org or null org) | service role only | — |

Service role (Stripe webhooks, checkout session creation) bypasses RLS unchanged.

### Server-side permission enforcement

* `app/(dashboard)/donations/layout.tsx` — `donations.view` **or** `donations.manage`
* `app/(dashboard)/donations/payments/import/layout.tsx` — `donations.manage`
* `app/(dashboard)/donations/payments/match/layout.tsx` — `donations.manage`
* `app/(dashboard)/donations/settings/layout.tsx` — `donations.manage`
* `lib/donations/donation-action-auth.ts` — `requireDonationStaffAccess("view" | "manage")` for receipt, pledge-reminder, and recurring server actions

Customer portal (`/customer/donation/*`, `stripe-donation-actions.ts`) uses contact-scoped JWT + RLS; no staff permissions required.

### Validation

```bash
npx supabase db query --linked -f scripts/095_donations_rls_hardening.sql
npx supabase db query --linked -f scripts/258_campaigns_rls_policies.sql
npm run validate:donations-security
```

**Validated (June 2026):** 38/38 security checks — anon blocked, customer cross-donor isolation, staff cross-org isolation, layout/action guards, Stripe webhook integration 14/14.

### Remaining security notes (post-P14)

* `pledge_status_view` / `donor_summary_view` — view RLS not committed in repo; staff/customer queries rely on underlying table policies + app filters
* Staff list pages still fetch via client Supabase (protected by layout + RLS, not server-action wrappers)
* `transactional_email_log` still uses org-membership SELECT (not permission-key aware)
* Pagination still recommended before large-org production load

## Production readiness & scalability (Priority 15)

Status: Implemented (June 2026)

### Database performance (migrations `096`–`098`)

* `096_donations_performance_indexes.sql` — org-scoped indexes on `payments`, `pledges`, `donors`, receipts, checkout sessions
* `097_donations_views.sql` — committed `pledge_status_view` + `donor_summary_view` with `security_invoker = true`
* `098_donations_dashboard_rpcs.sql` — SQL summaries for dashboard KPIs, monthly chart, source breakdown

Run after `095`:

```bash
npx supabase db query --linked -f scripts/096_donations_performance_indexes.sql
npx supabase db query --linked -f scripts/097_donations_views.sql
npx supabase db query --linked -f scripts/098_donations_dashboard_rpcs.sql
npm run validate:donations-production
```

### Pagination & server-side lists

* `lib/donations/donation-list-actions.ts` — paginated payments, pledges, donor summary queries (50/page)
* `/donations/payments/transactions` — summary metric cards + server-paginated payments table + search/status filters
* `/donations/campaigns/pledges` — server-paginated table; filters: status, campaign, minimum pledged amount; pledge summary cards reflect the same filters; donor name opens contact profile in a modal (`ContactProfileDialog`). Legacy `/donations/pledges` redirects here. Pledge Performance analytics is `/donations/reports/pledges`.
* `/donations/reports/donors` — `DonorsReportPanel` via `donation_donor_giving_report` RPC: period (lifetime / calendar year / custom), **column header filters** (Donor, Email, Phone, Total Given min, Last Gift), email and phone columns, CSV + PDF export. Pledge status and outstanding balance live on **Pledges**, not this report. Last Gift filter options: all, gift within 12 months, no gift in 12+/24+ months, never gave. Apply migrations `127`–`146`, **`150`**, **`151`**, **`152`**, **`153`**, **`163`** (report prefers `contacts.full_name` over stale `donors.full_name`; backfills donor name/email/phone from linked contacts). Contact profile name edits sync the linked `donors` row (`syncDonorExtensionFromContact`).
* `/donations` dashboard — executive overview: compact KPI cards (active campaigns, collected, outstanding, payments this month) with **Action Required** and **Active Campaigns** beside a right-rail **Quick Actions** column (blue text links: receive payment, add pledge, import, create campaign). **Recent Activity** feed is temporarily hidden while historical imports dominate the timeline. Key files: `app/(dashboard)/donations/page.tsx`, `components/donations/donations-overview-dashboard.tsx`, `lib/donations/donation-overview-actions.ts`

### Operational visibility

* `lib/donations/donation-ops-actions.ts` + `DonationOpsPanel` on **Donations → Import & Match** (`/donations/payments/import-match?view=match`)
* Surfaces failed emails, failed receipts, payments needing donor match (`pending_review` + `unresolved` only — not already-matched `unallocated`), Stripe processor failures

### Email scalability

* `sendBulkAnnualStatementsAction` — parallel batches of 10 (no external queue)

### Remaining scale work

* Recurring plans list not paginated (typically smaller dataset)
* Customer portal payment history unbounded per contact
* Dedicated test org for validation scripts still recommended

### Donations navigation (sidebar consolidation)

Status: Implemented (August 2026 IA redesign)

* Sidebar: **Overview**, **Campaigns**, **Pledges**, **Donations**, **Reports**, **Settings** (`lib/navigation/donations-sidebar-children.ts`)
* **Donations** (operations) — in-page tabs:
  * **Transactions** — `/donations/payments/transactions` (payment register + Receive Payment; date range, CSV export, campaign/fund/group/receipt columns)
  * **Recurring** — `/donations/payments/recurring` (plan management)
  * **Import & Match** — `/donations/payments/import-match` (`donations.manage` or `donations.reports.manage`; Import File → Auto-Match → Review Exceptions)
  * **Receipts & Statements** — `/donations/payments/receipts` (Missing queue at `?status=missing`; year-end KPIs from annual statement rows)
* **Reports** (analytics) — landing cards at `/donations/reports` (optional `?range=` applies to Giving Summary):
  * **Giving Summary** — `/donations/reports/giving` (filtered KPIs, charts, read-only payment register)
  * **Donor Giving** — `/donations/reports/donors` (Individual / Household / Group). Open Group Giving from Reports. Group/Household table sections show the view title on the left (**Add Group** beside Group Giving) and the period dropdown on the right. Group name and Last Gift columns sort. Group workspace is `/donations/groups/[id]`. Pledge and Outstanding Balance columns are omitted — pledge detail stays on **Pledges**.
  * **Campaign Performance** — `/donations/reports/campaigns` (includes Campaign Groups view)
  * **Pledge Performance** — `/donations/reports/pledges` (read-only; operational pledges stay at `/donations/campaigns/pledges`)
  * **Recurring Giving** — `/donations/reports/recurring-giving` (read-only)
* Legacy redirects: `/donations/reports/one-time` → transactions; `/donations/reports/recurring` → recurring ops; `/donations/reports/import` and `/match` → import-match; `/donations/reports/receipts` → receipts ops; `/donations/reports/campaign-groups` → campaign performance groups view
* `/donations/pledges` still redirects to operational Pledges
* Record payment / add pledge remain on donor profile pages; **Receive Payment** on Transactions is preserved

## Campaign goals & fundraising analytics (Priority 3)

Status: Implemented (June 2026)

### Campaign fields

`campaigns` supports `goal_amount`, `description`, `start_date`, `end_date`, `status` (migration `scripts/089_campaign_goals.sql` adds goal/description if missing).

### Analytics module

`lib/donations/campaign-analytics.ts` — metrics from canonical `payments`, `pledges` (via `pledge_status_view`), `campaigns`, `donors`:

* **Raised** — `SUM(payments)` linked by `payments.campaign_id` or `payments.pledge_id → pledges.campaign_id`
* **Pledged / Outstanding / Collected** — from `pledge_status_view` per campaign
* **Progress %** — `raised / goal_amount` (null-safe when no goal)

### Routes

| Route | Purpose |
|-------|---------|
| `/donations/campaigns` | Campaigns Overview — org-wide pledge summary cards; fundraising campaigns table (active + two most recent by default; **View all** expands full list, most recent first) |
| `/donations/campaigns/[id]` | Campaign workspace — Overview, Strategy, Prospects, Pledges, Donations, Groups; `?tab=` / `?group=` |
| `/donate/g/[token]` | Public campaign group donation + optional pledge; Stripe Checkout attributes campaign + group (+ pledge when selected) |
| `/donations/groups/[id]` | Giving group workspace (members and attributed donations). Directory Groups URLs redirect here. |
| `/donations/reports/campaigns` | Campaign Performance — campaigns + Campaign Groups view (`?view=groups`) |
| `/donations` | Donations executive dashboard — KPI cards, action required, active campaigns snapshot, recent activity, quick actions |
| `/donations/settings` | Categories, **Funds** (subcategories under categories), Online Payments (Stripe Connect), receipt and pledge reminder settings. Campaign CRUD is under **Campaigns → Overview**. Org legal name/address/EIN: **Settings → General** (`/settings/general`). Org billing cards: **Billing** (`/billing`). |

### Validation

```bash
npm run validate:campaign-analytics
# Re-seed with goals: node scripts/seed-donations-dev.mjs --clean --confirm-dev
```

Seed campaign `DEV-RAMADAN-2026`: goal $5,000; raised $750; pledged $1,800; outstanding $1,050; 15% progress.

**Validated (June 2026):** donations seed 21/21; campaign analytics 9/9; UI metrics consistency 6/6 (`scripts/smoke-campaign-ui-metrics.mjs`).

## Receipts & year-end giving statements (Priority 4)

Status: Implemented (June 2026)

### Schema

Migration `scripts/090_donation_receipts.sql`:

* `donation_settings` — org legal name, address, EIN, receipt footer, signer, email template, receipt numbering, year-end options
* `donation_receipts` — generated receipts from canonical `payments` only; status `not_sent` / `sent` / `resent`; `sent_at`, `sent_by`

### Libraries

| File | Purpose |
|------|---------|
| `lib/donations/receipt-types.ts` | Types, defaults, receipt number formatting |
| `lib/donations/receipt-settings.ts` | Load/save org receipt config |
| `lib/donations/receipt-data.ts` | Build payment receipt + annual statement payloads; donor giving totals |
| `lib/donations/receipt-actions.ts` | Server actions: generate, mark sent, reporting summary |
| `lib/donations/receipt-pdf.ts` | HTML templates + jsPDF download + print fallback |

### Routes / screens

| Route | Receipt features |
|-------|------------------|
| `/donations/settings` | Receipts tab — full receipt config (org legal/address/EIN moved to **Settings → General**) |
| `/donations/donors/individuals/[id]` | Lifetime giving totals; donation history per-payment receipts; annual statement |
| `/donations/donors/organizations/[id]` | Same as individual donor profile |
| `/donations/payments/receipts` | Receipts & year-end statements (bulk send, ⋯ per donor) |

### Rules

* Receipts generated only from actual `payments` rows (not pledge creation)
* Voided payments excluded
* Annual statements sum payments for donor + tax year only

### Validation

```bash
npx supabase db query --linked -f scripts/090_donation_receipts.sql
npm run validate:donation-receipts
```

**Validated (June 2026):** donation receipts 12/12 (`scripts/validate-donation-receipts.mjs`).

**Apply migration:** `scripts/090_donation_receipts.sql`

## Pledge reminders & collection workflows (Priority 5)

Status: Implemented (June 2026)

### Schema

Migration `scripts/091_pledge_reminders.sql`:

* Extends `donation_settings` with pledge reminder config (enable, message, subject, schedule, footer, payment instructions)
* `pledge_reminders` — reminder activity log per pledge (`draft` / `sent` / `failed` / `skipped`); `delivered_externally` tracks real email delivery

### Libraries

| File | Purpose |
|------|---------|
| `lib/donations/pledge-reminder-types.ts` | Types, defaults, eligibility helpers |
| `lib/donations/pledge-reminder-data.ts` | Outstanding pledges, message builder, collection report |
| `lib/donations/pledge-reminder-actions.ts` | Preview, record reminder, mark contacted, reporting |

### Routes / screens

| Route | Features |
|-------|----------|
| `/donations/settings` → Pledge Reminders | Enable reminders, message templates, schedule options |
| `/donations/campaigns/pledges` | Pledge list (filters: campaign, status, min amount), add/edit/pay, last reminder/contacted columns, inline reminder actions, detail dialog |
| `/donations/pledges` | Redirects to `/donations/campaigns/pledges` |
| `/donations/collect` | Redirects to `/donations/campaigns/pledges#collection-queue` |
| `/donations/donors/*/[id]` | Redirects to contact profile Financial tab when linked |
| `/contacts/[id]?tab=financial` | Pledges (with Remind / Mark Contacted), reminder history, donation history |
| `/donations/reports/collection` | Redirects to `/donations/campaigns/pledges#collection-queue` |
| `/donations/reports/pledges` | Redirects to `/donations/campaigns/pledges` |

### Workflow

1. Staff opens outstanding pledge (Pledges page or pledge detail).
2. Preview builds message from org settings + canonical pledge balances.
3. **Record Reminder** inserts `pledge_reminders` row with `delivered_externally=false` and alerts staff that no external email was sent.
4. **Mark Contacted** logs manual outreach with optional notes (`reminder_type=contacted`).
5. Fulfilled pledges are excluded from the collection queue automatically.

### Limitations

* Outbound email provider not wired — reminders are recorded only until mail integration is added.
* `delivered_externally` remains `false` for all current sends.
* Overdue detection uses `pledge_date` as proxy (no separate due-date column on pledges).

### Validation

```bash
npx supabase db query --linked -f scripts/091_pledge_reminders.sql
npm run validate:pledge-reminders
```

**Validated (June 2026):** pledge reminders 11/11 (`scripts/validate-pledge-reminders.mjs`).

**Apply migration:** `scripts/091_pledge_reminders.sql`

## Recurring donations (Priority 6)

Status: Implemented (June 2026)

### Schema

Migration `scripts/092_recurring_donations.sql`:

* `recurring_donation_plans` — donor, amount, frequency, start/next/end dates, status (`active` / `paused` / `cancelled` / `completed`), `total_payments`, `payments_made` (migration `156`)
* `payments.recurring_donation_plan_id` — links canonical payments to plans (nullable FK)

Recurring donations are **not** pledges and do **not** auto-create receipts.

### Libraries

| File | Purpose |
|------|---------|
| `lib/donations/recurring-donation-types.ts` | Types, MRR helpers |
| `lib/donations/recurring-donation-schedule.ts` | Next payment date calculation |
| `lib/donations/recurring-donation-data.ts` | Dashboard metrics, reporting |
| `lib/donations/recurring-donation-actions.ts` | CRUD plans, record payments, status updates |

### Routes / screens

| Route | Features |
|-------|----------|
| `/donations/payments/recurring` | Operational plan table (donor, category/fund, frequency, plan start/end, total payments, amount, payments made, status); MRR/ARR metrics; create plan; record payment. Status column filter defaults to **Active**. |
| `/donations/reports/recurring-giving` | Read-only recurring giving analytics using the same plan data. |
| `/donations/donors/*/[id]` | Active plans, recurring payment history, lifetime recurring giving |

### Payment flow

1. Staff creates `recurring_donation_plans` record.
2. On scheduled gift, staff uses **Record Payment** → inserts canonical `payments` row with `recurring_donation_plan_id`, `pledge_id=null`.
3. Plan `next_payment_date` advances by frequency.
4. Status changes: pause, resume, cancel — no processor integration yet.

### Future processor integration

* Implemented in Priority 16 — Stripe subscriptions populate `external_processor` / `external_processor_id` / `stripe_customer_id`; invoice webhooks insert canonical `payments` with `source_type=processor`.

### Validation

```bash
npx supabase db query --linked -f scripts/092_recurring_donations.sql
npm run validate:recurring-donations
```

**Validated (June 2026):** recurring donations 9/9 (`scripts/validate-recurring-donations.mjs`).

**Apply migration:** `scripts/092_recurring_donations.sql`

## Contacts identity & affiliation sync (Phase 1) — Closeout

**Status:** Complete (June 2026) — tickets **S-01 through S-13** delivered and validated.

**North star:** One Contact · Many Roles · Many Activities · No Duplicate Identities

**Validation gate (run before release or after affiliation changes):**

```bash
npm run validate:contacts-phase1
npm run validate:contacts-phase1:report   # optional JSON → scripts/reports/contacts-phase1-validation.json
```

**Required migration:**

```bash
npx supabase db query --linked -f scripts/101_contact_participation_roles.sql
```

(Run after `100_stripe_recurring_donations.sql`.)

### Goal

Stabilize canonical contact identity across donations, programs, ticketing, and volunteers without merge UI or segmentation. Activity-derived roles sync through approved helpers only — never manual `contact_roles` inserts on write paths, never profile-refresh dependency for new activity.

### Architecture (approved — do not redesign)

```
Activity write (donation, enrollment, ticket order, volunteer roster)
        │
        ├─ Donations (portal / staff UI) ──► handleDonationAffiliationSync
        ├─ Donations (Stripe webhooks) ──────► syncDonationAffiliationFromWebhook
        └─ Programs / ticketing / volunteers ► syncContactAffiliations(orgId explicit)
                    │
                    ▼
           computeDerivedAffiliations (validation / diagnostics)
                    │
                    ▼
           sync_contact_affiliations RPC (authoritative reconcile)
                    │
                    ▼
           contact_roles upsert (idempotent)
```

`refreshContactAffiliations` on contact profile open (`app/(dashboard)/contacts/[id]/page.tsx`) reconciles stale rows for staff viewing — Phase 1 write paths do **not** depend on it.

### Ticket delivery (S-01 – S-13)

| Ticket | Scope |
|--------|-------|
| **S-01** | `handleDonationAffiliationSync` accepts optional `organizationId` + `supabaseClient` for webhook/service-role callers |
| **S-02/S-03** | Stripe webhook donation affiliation sync via `syncDonationAffiliationFromWebhook` |
| **S-04A/B** | **Programs** (`program_participant`) for enrollments (participant or registrant); **Customer** (`customer`) for events/ticketing + venue rentals (migration `175` after unified `137`) |
| **S-05/S-06** | Portal/staff pledge **payment** → `handleDonationAffiliationSync`; pledge create does not sync donor |
| **S-07** | `createTicketOrder` → `findOrCreateContact` + `ticket_orders.contact_id` |
| **S-08** | Ticketing completion → `syncContactAffiliations` on completed orders |
| **S-09/S-10** | Program `participant_contact_id` via `ensureContactForPerson`; enrollment → `syncContactAffiliations` for **Customer** |
| **S-11** | `ensureVolunteerForContact` fixed — roster + `syncContactAffiliations` only |
| **S-12** | Unified validation runner + shared lib + cross-module role accumulation |
| **S-13** | Documentation closeout — `Features.md`, `Project_Context.md`, `Database_Overview.md`, `Module_Inventory.md` |

### Affiliation derivation (Phase 1)

| Role | Activity trigger | Auto-remove | Sync entry |
|------|------------------|-------------|------------|
| `donor` | Linked `payments` for contact (direct or via `donor_id`) | Never (sticky) | `handleDonationAffiliationSync` / webhook helper |
| `volunteer` | `volunteers` row for contact | Never (sticky) | `syncContactAffiliations` |
| `customer` | Program enrollment (non-terminal), completed ticket order, or venue rental with `billing_contact_id` (status not declined/cancelled/draft) | Never (sticky) | `syncContactAffiliations` |
| `member` | Active `memberships` row | Yes when membership lapses | `syncContactAffiliations` |

Migration **`137_customer_role_merge.sql`** backfills legacy `program_participant`, `event_attendee`, and `venue_rental_customer` rows into `customer` and merges org auto-sync settings. Migration **`175_split_customer_programs_affiliation.sql`** restores **Programs** (`program_participant`) for enrollments and narrows **Customer** to events/venue.

### Module write paths

| Module | Identity helper | Affiliation trigger | Key files |
|--------|-----------------|---------------------|-----------|
| Stripe donations | Payment/donor metadata | After payment/plan insert (webhook) | `lib/donations/stripe/processor-payment.ts`, `processor-subscription.ts` |
| Portal/staff donations | Existing donor/contact | After payment insert (not pledge-only) | `app/(customer)/customer/donation/page.tsx`, `app/(dashboard)/donations/(operations)/pledges/page.tsx` |
| Ticketing | `findOrCreateContact` | Order reaches `completed` | `lib/tickets/ticket-order-actions.ts` |
| Programs | Youth: `p_participant_person_id` (minors stay people under parent Contact); adult: registrant contact. Affiliations sync existing contacts only — never create minor contacts. | Enrollment created (not waitlist-only); `promote_waitlist` | `lib/programs/program-registration-actions.ts`, `program-enrollment-actions.ts`, `program-lifecycle-actions.ts`, SQL **`195`** |
| Volunteers | Reuse canonical `contact_id` | Volunteer roster row created | `lib/volunteers/volunteer-actions.ts` |

### Key files

| File | Purpose |
|------|---------|
| `lib/contacts/contact-affiliation-sync.ts` | `computeDerivedAffiliations` (diagnostics), `syncContactAffiliations` → RPC, webhook helpers |
| `lib/contacts/contact-affiliation-rules.ts` | Terminal enrollment statuses, sticky/removable role policy |
| `lib/contacts/contact-actions.ts` | `findOrCreateContact`, `ensureContactForPerson` → gated RPCs |
| `lib/tickets/ticket-order-actions.ts` | FOC + `contact_id`; completion sync |
| `lib/programs/person-actions.ts` | Existing-contact lookup only (no auto-create for participants) |
| `lib/programs/program-enrollment-actions.ts` | `syncAffiliationAfterEnrollmentCreation` |
| `lib/programs/program-registration-actions.ts` | Customer registration identity + sync |
| `lib/programs/program-lifecycle-actions.ts` | Waitlist promotion sync |
| `lib/volunteers/volunteer-actions.ts` | `createVolunteer`, `ensureVolunteerForContact` |
| `scripts/lib/contacts-phase1-validation.mjs` | Shared validation utilities (S-12) |
| `scripts/validate-contacts-phase1.mjs` | Unified runner (S-12) |

### Validation (S-12)

Unified runner executes policy checks, six module suites, and cross-module role accumulation.

| Suite | Command | Ticket |
|-------|---------|--------|
| **Unified** | `validate:contacts-phase1` | S-12 |
| Stripe one-time | `validate:stripe-one-time` | S-02 |
| Stripe recurring | `validate:stripe-recurring` | S-03 |
| Portal + pledge | `validate:portal-pledge-donation-sync` | S-05/S-06 |
| Ticketing completion | `validate:ticketing-completion-sync` | S-08 |
| Program participant | `validate:program-participant-sync` | S-09/S-10 |
| Volunteer identity | `validate:volunteer-identity-sync` | S-11 |

**Matrix covered:** donations (one-time, recurring, pledge create/pay), ticketing (complete, pending→complete, contact reuse), programs (enroll, contact create/reuse, sticky terminal), volunteers (create, reuse, dedupe), cross-module accumulation (donor + volunteer + customer on one contact), policy (sticky roles, member auto-removable, sync primary path, no profile-refresh dependency).

**Last validated:** June 2026 — policy 8/8, suites 7/7, checks 75/75 (`validate:contacts-phase1:report`).

### Deferred (Phase 2+)

* Historical enrollment/ticket `contact_id` backfill
* Participant merge UI and dedupe tooling
* Contact segmentation / advanced CRM panels
* Volunteer application approval → automatic roster (approval UX unchanged in Phase 1)
* Staff enrollment paths outside `register_for_program` / `promote_waitlist`

---

## Contacts security remediation (RLS wave 1) — G6 complete, M4 authorized

**Status:** M1–M6b + CR-8 implemented in repo (June 2026). **M4** script `111` is **authorized** for staging after `109`–`110` applied.

**Rollout:** Hybrid C→B — additive policies (102–106) → M6/M6b RPC gates → G6 validation → M4 drop open policies (`111`).

### SQL migrations (run in order after `101_contact_participation_roles.sql`)

```bash
npx supabase db query --linked -f scripts/102_contacts_rls_helpers.sql
npx supabase db query --linked -f scripts/103_contacts_rls_support_helpers.sql
npx supabase db query --linked -f scripts/104_contacts_rls_policies.sql
npx supabase db query --linked -f scripts/105_contact_roles_rls_policies.sql
npx supabase db query --linked -f scripts/106_contact_notes_rls_policies.sql
npx supabase db query --linked -f scripts/107_contacts_permission_seeds.sql
npx supabase db query --linked -f scripts/108_contacts_affiliation_sync_rpcs.sql
npx supabase db query --linked -f scripts/109_contacts_rls_gate_alignment.sql
npx supabase db query --linked -f scripts/110_contacts_membership_permission_seeds.sql
# After staging smoke + npm run validate:contacts-security --post-m4:
npx supabase db query --linked -f scripts/111_contacts_m4_drop_open_policies.sql
```

| Script | Scope |
|--------|-------|
| `102`–`108` | M1–M6 (helpers, policies, seeds, affiliation RPCs) |
| `109` | **M6b:** events/ticketing/membership in create + sync RPC gates |
| `110` | **M6b:** `membership.view` / `membership.manage` seeds; `events.*` → `contacts.view` cross-grant |
| `111` | **M4:** Drop legacy `USING(true)` contacts / contact_roles policies |

### App changes (M6 + M6b + CR-7)

* RPC routing: `syncContactAffiliations`, `findOrCreateContact`, `ensureContactForPerson`
* Permissions: `contacts.*`, `membership.*`, `ticketing.*` in `permission-keys.ts` + Roles UI
* `assertTicketingManagePermission` — includes `ticketing.manage`
* `assertMembershipManagePermission` on membership write paths
* Sidebar: membership module gated by `membership.view` (fallback `contacts.view`)

### Validation (CR-8 / G6)

```bash
npm run validate:contacts-g6              # CR-8 + Phase 1 (report written)
npm run validate:contacts-security        # CR-8 repo + DB helpers/RPCs
npm run validate:contacts-security:report # + JSON → scripts/reports/
npm run validate:contacts-security -- --post-m4   # after 111 applied
```

**G6 result (June 2026):** `54/54` checks passed (`validate:contacts-g6`). Report: `scripts/reports/contacts-security-validation.json`.

### M4 authorization

**Authorized** for staging deployment of `111` when:

1. `102`–`110` applied on target database
2. `npm run validate:contacts-g6` GREEN
3. Manual smoke: ticketing order complete, membership add-member, CRM notes (staff with `contacts.manage`)
4. `npm run validate:contacts-security -- --post-m4` GREEN after `111`

**Not authorized for production** until staging post-M4 soak completes without P0 regressions.
