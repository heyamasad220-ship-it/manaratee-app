import assert from "node:assert/strict"
import { test } from "node:test"

import {
  assertNoFinancialFields,
  canOpenSourceRecordForBrief,
  toOperationalBriefView,
} from "./operational-brief-payload"
import {
  OPERATIONAL_BRIEF_SETUP_STATUSES,
  OPERATIONAL_BRIEF_SOURCE_TYPES,
  type OperationalBriefRecord,
} from "./operational-brief-types"

const sampleBrief: OperationalBriefRecord = {
  id: "brief-1",
  organization_id: "org-1",
  source_type: OPERATIONAL_BRIEF_SOURCE_TYPES.venueRental,
  source_id: "rental-1",
  reservation_id: "res-1",
  title: "Wedding — Venue Rental",
  event_date: "2026-06-01",
  start_time: "14:00:00",
  end_time: "18:00:00",
  primary_contact_person_id: null,
  primary_contact_name: "Alex Customer",
  primary_contact_phone: "555-0100",
  internal_coordinator_person_id: null,
  internal_coordinator_name: null,
  internal_coordinator_phone: null,
  internal_coordinator_email: null,
  expected_attendance: 120,
  setup_style: "Banquet",
  room_setup_notes: "Round tables",
  equipment_notes: "Projector",
  food_beverage_notes: null,
  table_linen_notes: null,
  cleanup_notes: null,
  accessibility_notes: null,
  special_requests: "No peanuts",
  facility_notes: "Spaces: Main Hall",
  setup_status: OPERATIONAL_BRIEF_SETUP_STATUSES.needsReview,
  source_status: "awaiting_supervisor_approval",
  visibility_level: "staff",
  created_by: null,
  updated_by: null,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
}

test("toOperationalBriefView hides source record link for facility-only viewers", () => {
  const view = toOperationalBriefView(sampleBrief, {
    canOpenVenueRentalRecord: false,
    canOpenInternalEventRecord: false,
    canOpenProgramRecord: false,
    canEditSetupFields: true,
    isFacilitiesOnly: true,
  })

  assert.equal(view.sourceRecordHref, null)
  assert.equal(view.canOpenSourceRecord, false)
  assert.equal(view.primaryContactName, "Alex Customer")
  assert.equal(view.canEditSetupFields, true)
  assert.equal(
    "depositAmount" in view,
    false,
    "financial fields must not appear on operational brief views"
  )
})

test("toOperationalBriefView exposes source record link only for module managers", () => {
  const view = toOperationalBriefView(sampleBrief, {
    canOpenVenueRentalRecord: true,
    canOpenInternalEventRecord: false,
    canOpenProgramRecord: false,
    canEditSetupFields: false,
    isFacilitiesOnly: false,
  })

  assert.equal(view.canOpenSourceRecord, true)
  assert.equal(view.sourceRecordHref, "/bookings/rentals/rental-1")
})

test("canOpenSourceRecordForBrief blocks maintenance deep links without manage access", () => {
  assert.equal(
    canOpenSourceRecordForBrief(
      { source_type: OPERATIONAL_BRIEF_SOURCE_TYPES.maintenance },
      {
        canOpenVenueRentalRecord: true,
        canOpenInternalEventRecord: true,
        canOpenProgramRecord: true,
        canEditSetupFields: false,
        isFacilitiesOnly: false,
      }
    ),
    false
  )
})

test("assertNoFinancialFields rejects payment-related update keys", () => {
  assert.throws(() =>
    assertNoFinancialFields({
      briefId: "brief-1",
      depositAmount: 500,
    })
  )
})
