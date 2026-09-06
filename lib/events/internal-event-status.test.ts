import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  INTERNAL_EVENT_STATUSES,
  fromInternalEventStatusMenuValue,
  getEventListDisplayStatus,
  getInternalEventCalendarColor,
  isInternalEventPendingApproval,
  mapInternalEventStatusToReservationStatus,
  toInternalEventStatusMenuValue,
} from "./internal-event-status"

describe("internal event approval status", () => {
  it("maps awaiting approval to temporary hold reservations", () => {
    assert.equal(
      mapInternalEventStatusToReservationStatus(
        INTERNAL_EVENT_STATUSES.awaitingApproval
      ),
      "temporary_hold"
    )
  })

  it("maps confirmed events to confirmed reservations", () => {
    assert.equal(
      mapInternalEventStatusToReservationStatus(INTERNAL_EVENT_STATUSES.confirmed),
      "confirmed"
    )
  })

  it("removes declined events from reservations", () => {
    assert.equal(
      mapInternalEventStatusToReservationStatus(INTERNAL_EVENT_STATUSES.declined),
      null
    )
  })

  it("maps workspace status menu values", () => {
    assert.equal(
      toInternalEventStatusMenuValue(INTERNAL_EVENT_STATUSES.awaitingApproval),
      "pending"
    )
    assert.equal(
      toInternalEventStatusMenuValue(INTERNAL_EVENT_STATUSES.confirmed),
      "live"
    )
    assert.equal(
      fromInternalEventStatusMenuValue("pending"),
      INTERNAL_EVENT_STATUSES.awaitingApproval
    )
    assert.equal(
      fromInternalEventStatusMenuValue("live"),
      INTERNAL_EVENT_STATUSES.confirmed
    )
  })

  it("identifies pending approval statuses", () => {
    assert.equal(
      isInternalEventPendingApproval(INTERNAL_EVENT_STATUSES.awaitingApproval),
      true
    )
    assert.equal(
      isInternalEventPendingApproval(INTERNAL_EVENT_STATUSES.confirmed),
      false
    )
  })

  it("assigns calendar colors by workflow state", () => {
    assert.equal(
      getInternalEventCalendarColor(INTERNAL_EVENT_STATUSES.awaitingApproval),
      "yellow"
    )
    assert.equal(
      getInternalEventCalendarColor(INTERNAL_EVENT_STATUSES.confirmed),
      "green"
    )
    assert.equal(
      getInternalEventCalendarColor(INTERNAL_EVENT_STATUSES.declined),
      "orange"
    )
  })

  it("shows Draft, Published, or Completed on the Events list", () => {
    const now = new Date("2026-09-06T12:00:00.000Z")
    assert.equal(
      getEventListDisplayStatus(
        {
          status: INTERNAL_EVENT_STATUSES.draft,
          start_at: "2026-09-12T18:00:00.000Z",
          end_at: "2026-09-12T22:00:00.000Z",
        },
        now
      ),
      "draft"
    )
    assert.equal(
      getEventListDisplayStatus(
        {
          status: INTERNAL_EVENT_STATUSES.confirmed,
          start_at: "2026-09-12T18:00:00.000Z",
          end_at: "2026-09-12T22:00:00.000Z",
        },
        now
      ),
      "published"
    )
    assert.equal(
      getEventListDisplayStatus(
        {
          status: INTERNAL_EVENT_STATUSES.confirmed,
          start_at: "2018-01-06T18:00:00.000Z",
          end_at: "2018-01-06T22:00:00.000Z",
        },
        now
      ),
      "completed"
    )
  })
})
