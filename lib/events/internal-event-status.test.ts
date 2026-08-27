import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  INTERNAL_EVENT_STATUSES,
  fromInternalEventStatusMenuValue,
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
      "approved"
    )
    assert.equal(
      fromInternalEventStatusMenuValue("pending"),
      INTERNAL_EVENT_STATUSES.awaitingApproval
    )
    assert.equal(
      fromInternalEventStatusMenuValue("approved"),
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
})
