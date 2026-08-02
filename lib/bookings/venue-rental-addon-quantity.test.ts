import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  computeVenueRentalTableCount,
  resolveVenueRentalAddonPricingBasis,
  resolveVenueRentalAddonQuantity,
} from "./venue-rental-addon-quantity"

describe("venue-rental-addon-quantity", () => {
  it("computes table count from attendance and chairs per table", () => {
    assert.equal(computeVenueRentalTableCount(100, 8), 13)
    assert.equal(computeVenueRentalTableCount(100, 10), 10)
    assert.equal(computeVenueRentalTableCount(0, 8), 0)
  })

  it("resolves pricing basis from slug/name", () => {
    assert.equal(
      resolveVenueRentalAddonPricingBasis({ slug: "table-covers" }),
      "per_table"
    )
    assert.equal(
      resolveVenueRentalAddonPricingBasis({ slug: "chair-covers" }),
      "per_person"
    )
    assert.equal(
      resolveVenueRentalAddonPricingBasis({ slug: "plate-chargers" }),
      "per_person"
    )
    assert.equal(
      resolveVenueRentalAddonPricingBasis({ slug: "projector" }),
      "flat"
    )
  })

  it("scales quantities for attendance examples", () => {
    assert.equal(
      resolveVenueRentalAddonQuantity({
        slug: "plate-chargers",
        expectedAttendance: 100,
        chairsPerTable: 8,
      }),
      100
    )
    assert.equal(
      resolveVenueRentalAddonQuantity({
        slug: "chair-covers",
        expectedAttendance: 100,
        chairsPerTable: 8,
      }),
      100
    )
    assert.equal(
      resolveVenueRentalAddonQuantity({
        slug: "table-covers",
        expectedAttendance: 100,
        chairsPerTable: 8,
      }),
      13
    )
    assert.equal(
      resolveVenueRentalAddonQuantity({
        slug: "projector",
        expectedAttendance: 100,
        chairsPerTable: 8,
      }),
      1
    )
  })
})
