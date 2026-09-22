import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { boothSelectionTotal, parseBoothNumberList } from "@/lib/vendor-hub/booth-pricing"

describe("boothSelectionTotal", () => {
  it("adds the table-selection extra to the base price", () => {
    assert.equal(boothSelectionTotal(150, 10), 160)
    assert.equal(boothSelectionTotal(150, 25), 175)
    assert.equal(boothSelectionTotal(300, 0), 300)
  })
})

describe("parseBoothNumberList", () => {
  it("splits comma lists and trims blanks", () => {
    assert.deepEqual(parseBoothNumberList("T1, T2, T3"), ["T1", "T2", "T3"])
    assert.deepEqual(parseBoothNumberList(["T15", " T25 "]), ["T15", "T25"])
  })
})
