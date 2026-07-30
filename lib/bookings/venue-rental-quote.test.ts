import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildVenueRateLookup,
  computeVenueRentalQuotedCharges,
} from "./venue-rental-quote"

describe("computeVenueRentalQuotedCharges", () => {
  it("uses day flat price for the requested space/date when set", () => {
    const rates = buildVenueRateLookup({
      venues: [
        {
          id: "v1",
          hourly_rate: 100,
          peak_hourly_rate: 150,
          base_price: 500,
          peak_flat_price: 800,
        },
      ],
      dayPricing: [
        {
          venue_id: "v1",
          day_of_week: 5,
          hourly_price: 150,
          flat_price: 1200,
          is_active: true,
        },
      ],
    })

    // Friday evening in Chicago (UTC-5 in July) → Friday
    const quote = computeVenueRentalQuotedCharges(
      [
        {
          venueId: "v1",
          startAt: "2026-07-31T23:00:00.000Z", // 6pm CDT Friday
          endAt: "2026-08-01T03:00:00.000Z", // 10pm CDT Friday
        },
      ],
      [{ quantity: 2, unitPrice: 25 }],
      rates
    )

    assert.equal(quote.hours, 4)
    assert.equal(quote.spaceFee, 1200)
    assert.equal(quote.addonFees, 50)
    assert.equal(quote.totalCharges, 1250)
  })

  it("falls back to hours × hourly when flat is zero", () => {
    const rates = buildVenueRateLookup({
      venues: [{ id: "v1", hourly_rate: 100, peak_hourly_rate: 150 }],
      dayPricing: [
        {
          venue_id: "v1",
          day_of_week: 5,
          hourly_price: 150,
          flat_price: 0,
          is_active: true,
        },
      ],
    })

    const quote = computeVenueRentalQuotedCharges(
      [
        {
          venueId: "v1",
          startAt: "2026-07-31T23:00:00.000Z",
          endAt: "2026-08-01T03:00:00.000Z",
        },
      ],
      [],
      rates
    )

    assert.equal(quote.hours, 4)
    assert.equal(quote.spaceFee, 600)
    assert.equal(quote.totalCharges, 600)
  })

  it("uses legacy peak flat when day pricing is missing", () => {
    const rates = buildVenueRateLookup({
      venues: [
        {
          id: "v1",
          hourly_rate: 0,
          peak_hourly_rate: 0,
          base_price: 400,
          peak_flat_price: 900,
        },
      ],
      dayPricing: [],
    })

    const quote = computeVenueRentalQuotedCharges(
      [
        {
          venueId: "v1",
          startAt: "2026-07-31T23:00:00.000Z",
          endAt: "2026-08-01T03:00:00.000Z",
        },
      ],
      [],
      rates
    )

    assert.equal(quote.spaceFee, 900)
    assert.equal(quote.totalCharges, 900)
  })
})
