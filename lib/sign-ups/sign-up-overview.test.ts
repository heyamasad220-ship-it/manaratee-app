import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  formatVolunteerCoverage,
  signUpOverviewSource,
  signUpOverviewWhenMatches,
  volunteerSlotsNeeded,
} from "./sign-up-overview"

describe("sign-up overview", () => {
  it("counts volunteer slots and ignores staff-only roles", () => {
    assert.equal(
      volunteerSlotsNeeded({
        volunteers: {
          roles: [
            { name: "Setup", slots: 2, volunteerAllowed: true },
            { name: "Lead", slots: 1, volunteerAllowed: false },
          ],
        },
      }),
      2
    )
    assert.equal(
      volunteerSlotsNeeded({ volunteers: { maxVolunteers: 6 } }),
      6
    )
    assert.equal(volunteerSlotsNeeded({}), null)
  })

  it("treats a vendor-hub date hold as Vendor Hub", () => {
    assert.equal(signUpOverviewSource("vendor_hub"), "vendor-hub")
    assert.equal(signUpOverviewSource("event_management"), "event-management")
    assert.equal(signUpOverviewSource(null), "event-management")
  })

  it("splits upcoming and past by the event end", () => {
    const now = new Date("2026-09-22T12:00:00.000Z")
    const upcoming = {
      startAt: "2026-10-10T15:00:00.000Z",
      endAt: "2026-10-10T20:00:00.000Z",
    }
    const past = {
      startAt: "2026-09-01T15:00:00.000Z",
      endAt: "2026-09-01T20:00:00.000Z",
    }
    assert.equal(signUpOverviewWhenMatches(upcoming, "upcoming", now), true)
    assert.equal(signUpOverviewWhenMatches(past, "upcoming", now), false)
    assert.equal(signUpOverviewWhenMatches(past, "past", now), true)
    assert.equal(signUpOverviewWhenMatches(upcoming, "all", now), true)
  })

  it("formats filled volunteer counts", () => {
    assert.equal(formatVolunteerCoverage(0, null), "Needed")
    assert.equal(formatVolunteerCoverage(2, null), "2 assigned")
    assert.equal(formatVolunteerCoverage(1, 4), "1 / 4")
  })
})
