import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  isAutoMatchEligible,
  rankContactMatches,
  scoreContactMatch,
} from "./payment-contact-matching"

describe("payment contact matching", () => {
  it("prefers exact email over partial name", () => {
    const match = scoreContactMatch(
      { senderName: "John Smith", email: "john@example.com" },
      {
        contactId: "c1",
        full_name: "Jonathan Smith",
        email: "john@example.com",
        phone: null,
      }
    )

    assert.equal(match?.confidenceScore, 98)
    assert.equal(match?.matchReason, "Exact email match")
  })

  it("ranks exact name above weak partial matches", () => {
    const matches = rankContactMatches(
      { senderName: "Amina Khan" },
      [
        {
          contactId: "c1",
          full_name: "Amina Khan",
          email: null,
          phone: null,
        },
        {
          contactId: "c2",
          full_name: "Amina K",
          email: null,
          phone: null,
        },
      ]
    )

    assert.equal(matches[0]?.contactId, "c1")
    assert.ok((matches[0]?.confidenceScore || 0) > (matches[1]?.confidenceScore || 0))
  })

  it("requires a clear winner for auto match", () => {
    const eligible = isAutoMatchEligible([
      {
        contactId: "c1",
        donorId: null,
        name: "Exact",
        email: "",
        phone: "",
        totalDonations: 0,
        lastDonation: "",
        confidenceScore: 95,
        matchReason: "Exact name match",
      },
      {
        contactId: "c2",
        donorId: null,
        name: "Also Exact",
        email: "",
        phone: "",
        totalDonations: 0,
        lastDonation: "",
        confidenceScore: 95,
        matchReason: "Exact name match",
      },
    ])

    assert.equal(eligible, false)
  })
})
