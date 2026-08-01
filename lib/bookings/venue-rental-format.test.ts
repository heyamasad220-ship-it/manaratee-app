import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  getVenueRentalDisplayNotes,
  mergeVenueRentalCustomerNotes,
  mergeVenueRentalEventTypeInNotes,
} from "./venue-rental-format"

describe("mergeVenueRentalCustomerNotes", () => {
  it("replaces plain notes", () => {
    assert.equal(mergeVenueRentalCustomerNotes("Old note", "New note"), "New note")
    assert.equal(mergeVenueRentalCustomerNotes("Old note", "  "), null)
  })

  it("preserves Google Form metadata while updating Notes", () => {
    const existing = [
      "Notes: Hello, how does the lounge work?",
      "Event type: Wedding reception",
      "Form submitted: 7/1/2026 10:00:00 AM",
      "VENUE_RENTAL_GOOGLE_FORM_V1",
    ].join("\n")

    const merged = mergeVenueRentalCustomerNotes(
      existing,
      "Updated lounge question + Friday Nikkah note"
    )

    assert.match(merged || "", /Notes: Updated lounge question/)
    assert.match(merged || "", /Event type: Wedding reception/)
    assert.match(merged || "", /VENUE_RENTAL_GOOGLE_FORM_V1/)
    assert.equal(
      getVenueRentalDisplayNotes(merged),
      "Updated lounge question + Friday Nikkah note"
    )
  })
})

describe("mergeVenueRentalEventTypeInNotes", () => {
  it("updates Event type line when present", () => {
    const existing = "Event type: Wedding\nNotes: Hi\nVENUE_RENTAL_GOOGLE_FORM_V1"
    assert.equal(
      mergeVenueRentalEventTypeInNotes(existing, "Seminar"),
      "Event type: Seminar\nNotes: Hi\nVENUE_RENTAL_GOOGLE_FORM_V1"
    )
  })
})
