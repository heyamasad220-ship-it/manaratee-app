import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  applyVenueRentalDiscountPolicies,
  computeVenueRentalPolicyDiscountAmount,
  venueRentalDiscountPolicyMatches,
  type VenueRentalDiscountPolicyRule,
} from "./venue-rental-discount-policies"

function policy(
  overrides: Partial<VenueRentalDiscountPolicyRule> &
    Pick<VenueRentalDiscountPolicyRule, "id" | "name" | "discountType" | "amount">
): VenueRentalDiscountPolicyRule {
  return {
    requiresMultiVenue: false,
    minVenues: 2,
    discountTagId: null,
    isActive: true,
    ...overrides,
  }
}

describe("venue rental discount policies", () => {
  it("computes fixed and percent savings", () => {
    assert.equal(
      computeVenueRentalPolicyDiscountAmount(1000, {
        discountType: "fixed",
        amount: 200,
      }),
      200
    )
    assert.equal(
      computeVenueRentalPolicyDiscountAmount(1000, {
        discountType: "percent",
        amount: 15,
      }),
      150
    )
    assert.equal(
      computeVenueRentalPolicyDiscountAmount(100, {
        discountType: "fixed",
        amount: 250,
      }),
      100
    )
  })

  it("requires multi-venue and/or tag conditions to match", () => {
    const multi = policy({
      id: "1",
      name: "Multi",
      discountType: "fixed",
      amount: 100,
      requiresMultiVenue: true,
      minVenues: 2,
    })
    assert.equal(
      venueRentalDiscountPolicyMatches({
        policy: multi,
        venueCount: 1,
        contactTagIds: [],
      }),
      false
    )
    assert.equal(
      venueRentalDiscountPolicyMatches({
        policy: multi,
        venueCount: 2,
        contactTagIds: [],
      }),
      true
    )

    const tagged = policy({
      id: "2",
      name: "Nonprofit",
      discountType: "percent",
      amount: 20,
      discountTagId: "tag-np",
    })
    assert.equal(
      venueRentalDiscountPolicyMatches({
        policy: tagged,
        venueCount: 1,
        contactTagIds: [],
      }),
      false
    )
    assert.equal(
      venueRentalDiscountPolicyMatches({
        policy: tagged,
        venueCount: 1,
        contactTagIds: ["tag-np"],
      }),
      true
    )

    const catalogOnly = policy({
      id: "3",
      name: "Manual later",
      discountType: "fixed",
      amount: 50,
    })
    assert.equal(
      venueRentalDiscountPolicyMatches({
        policy: catalogOnly,
        venueCount: 5,
        contactTagIds: ["tag-np"],
      }),
      false
    )
  })

  it("applies the largest matching discount only", () => {
    const result = applyVenueRentalDiscountPolicies({
      spaceFee: 1000,
      venueCount: 2,
      contactTagIds: ["tag-np"],
      policies: [
        policy({
          id: "multi",
          name: "Two spaces",
          discountType: "fixed",
          amount: 100,
          requiresMultiVenue: true,
        }),
        policy({
          id: "np",
          name: "Nonprofit",
          discountType: "percent",
          amount: 25,
          discountTagId: "tag-np",
        }),
      ],
    })

    assert.equal(result.discountAmount, 250)
    assert.equal(result.totalCharges, 750)
    assert.equal(result.applied?.policyId, "np")
  })
})
