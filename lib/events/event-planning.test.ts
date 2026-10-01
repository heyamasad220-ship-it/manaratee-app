import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { planningCostPerGuest } from "./event-planning"

describe("event planning worksheet", () => {
  it("divides chosen quote costs by expected guests", () => {
    assert.equal(
      planningCostPerGuest({
        dinnerCents: 10000,
        kidsCents: 2000,
        transportCents: 3000,
        otherCents: 500,
        headcount: 100,
      }),
      155
    )
  })

  it("returns nothing until a headcount is set", () => {
    assert.equal(
      planningCostPerGuest({
        dinnerCents: 10000,
        kidsCents: null,
        transportCents: null,
        otherCents: null,
        headcount: null,
      }),
      null
    )
  })
})
