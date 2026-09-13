import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  splitTicketOrderRevenue,
  ticketOrderCheckoutDonationCents,
} from "./ticket-checkout-donation"

describe("ticket checkout donations", () => {
  it("reads checkoutDonationCents from order metadata", () => {
    assert.equal(ticketOrderCheckoutDonationCents(null), 0)
    assert.equal(ticketOrderCheckoutDonationCents({ checkoutDonationCents: 2000 }), 2000)
    assert.equal(ticketOrderCheckoutDonationCents({ checkoutDonationCents: "2500" }), 2500)
  })

  it("keeps ticket revenue separate from checkout donations", () => {
    assert.deepEqual(
      splitTicketOrderRevenue({
        netRevenueCents: 22000,
        checkoutDonationCents: 2000,
      }),
      { ticketRevenueCents: 20000, checkoutDonationCents: 2000 }
    )
    assert.deepEqual(
      splitTicketOrderRevenue({
        netRevenueCents: 0,
        checkoutDonationCents: 2000,
      }),
      { ticketRevenueCents: 0, checkoutDonationCents: 0 }
    )
  })
})
