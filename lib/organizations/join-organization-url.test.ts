import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildOrganizationDonationJoinUrl,
  buildOrganizationJoinUrl,
} from "./join-organization-url"

describe("organization join urls", () => {
  it("defaults shareable join links to app.manaratee.com", () => {
    assert.equal(
      buildOrganizationJoinUrl("mas-dallas"),
      "https://app.manaratee.com/join/mas-dallas"
    )
  })

  it("builds donor join links with next path", () => {
    assert.equal(
      buildOrganizationDonationJoinUrl("mas-dallas"),
      "https://app.manaratee.com/join/mas-dallas?next=%2Fcustomer%2Fdonation%3Fgive%3Done-time"
    )
  })

  it("allows an explicit baseUrl override", () => {
    assert.equal(
      buildOrganizationJoinUrl("mas-dallas", { baseUrl: "http://localhost:3000" }),
      "http://localhost:3000/join/mas-dallas"
    )
  })
})
