import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { computeWishlistFunding, deriveWishlistFundingStatus } from "./campaign-wishlist-funding"

describe("wishlist funding", () => {
  it("treats a $10k gift as one transaction on the item", () => {
    const totals = computeWishlistFunding({
      targetAmount: 120000,
      pledged: 0,
      collected: 10000,
    })
    assert.equal(totals.collected, 10000)
    assert.equal(totals.pledged, 0)
    assert.equal(totals.remaining, 110000)
    assert.equal(totals.fundingStatus, "partially_funded")
  })

  it("does not add pledge plus payment as raised", () => {
    const totals = computeWishlistFunding({
      targetAmount: 100000,
      pledged: 25000,
      collected: 5000,
    })
    assert.equal(totals.pledged, 25000)
    assert.equal(totals.collected, 5000)
    assert.notEqual(totals.pledged + totals.collected, totals.collected)
    assert.equal(totals.remaining, 95000)
  })

  it("allows completed-but-underfunded items", () => {
    const totals = computeWishlistFunding({
      targetAmount: 100000,
      collected: 80000,
      pledged: 80000,
    })
    assert.equal(totals.fundingStatus, "partially_funded")
    assert.equal(totals.remaining, 20000)
  })

  it("marks fully funded without implying completed", () => {
    const totals = computeWishlistFunding({
      targetAmount: 40000,
      collected: 40000,
      pledged: 40000,
    })
    assert.equal(totals.fundingStatus, "fully_funded")
    assert.equal(deriveWishlistFundingStatus(40000, 40000), "fully_funded")
  })

  it("keeps prior-year money out of the new campaign collected total", () => {
    const totals = computeWishlistFunding({
      targetAmount: 100000,
      previousFundingAmount: 60000,
      pledged: 0,
      collected: 0,
    })
    assert.equal(totals.collected, 0)
    assert.equal(totals.previousFunding, 60000)
    assert.equal(totals.lifetimeCollected, 60000)
    assert.equal(totals.remaining, 40000)
    assert.equal(totals.fundingStatus, "partially_funded")
  })

  it("adds new-campaign gifts to lifetime without rewriting history", () => {
    const totals = computeWishlistFunding({
      targetAmount: 100000,
      previousFundingAmount: 60000,
      collected: 10000,
      pledged: 10000,
    })
    assert.equal(totals.collected, 10000)
    assert.equal(totals.lifetimeCollected, 70000)
    assert.equal(totals.remaining, 30000)
  })
})
