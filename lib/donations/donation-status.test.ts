import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  formatPledgeStatusLabel,
  pledgeDisplayStatus,
  pledgeStatusToDb,
} from "./donation-status"

describe("pledgeDisplayStatus", () => {
  it("treats a partly paid pledge as Open", () => {
    assert.equal(pledgeDisplayStatus("partial", 5000, 2000), "Open")
    assert.equal(pledgeDisplayStatus("open", 5000, 2000), "Open")
    assert.equal(pledgeDisplayStatus(null, 5000, 1000), "Open")
  })

  it("returns Fulfilled when paid in full", () => {
    assert.equal(pledgeDisplayStatus("fulfilled", 5000, 5000), "Fulfilled")
    assert.equal(pledgeDisplayStatus("open", 5000, 5000), "Fulfilled")
  })
})

describe("formatPledgeStatusLabel", () => {
  it("maps legacy partial to Open", () => {
    assert.equal(formatPledgeStatusLabel("partial"), "Open")
    assert.equal(formatPledgeStatusLabel("open"), "Open")
    assert.equal(formatPledgeStatusLabel("fulfilled"), "Fulfilled")
  })
})

describe("pledgeStatusToDb", () => {
  it("stores only open or fulfilled", () => {
    assert.equal(pledgeStatusToDb("Open"), "open")
    assert.equal(pledgeStatusToDb("Fulfilled"), "fulfilled")
  })
})
