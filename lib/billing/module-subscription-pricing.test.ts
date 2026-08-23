import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { formatCentsAsUsd, parseUsdToCents, percentOfCents } from "./money"
import {
  calculateModuleSubscriptionQuote,
  discountPercentForModuleCount,
} from "./module-subscription-pricing"

const exampleModules = [
  {
    slug: "event-management",
    name: "Event Management",
    description: null,
    monthlyPriceCents: 14900,
    isActive: true,
  },
  {
    slug: "programs",
    name: "Programs",
    description: null,
    monthlyPriceCents: 14900,
    isActive: true,
  },
  {
    slug: "vendor-hub",
    name: "Vendor Hub",
    description: null,
    monthlyPriceCents: 4900,
    isActive: true,
  },
  {
    slug: "bookings",
    name: "Venue Rentals",
    description: null,
    monthlyPriceCents: 9900,
    isActive: true,
  },
  {
    slug: "donations",
    name: "Fund Development",
    description: null,
    monthlyPriceCents: 19900,
    isActive: true,
  },
  {
    slug: "membership",
    name: "Membership",
    description: null,
    monthlyPriceCents: 4900,
    isActive: true,
  },
]

const exampleRules = [
  { moduleCount: 1, discountPercent: 0, isActive: true },
  { moduleCount: 2, discountPercent: 5, isActive: true },
  { moduleCount: 3, discountPercent: 10, isActive: true },
  { moduleCount: 4, discountPercent: 10, isActive: true },
  { moduleCount: 5, discountPercent: 15, isActive: true },
  { moduleCount: 6, discountPercent: 20, isActive: true },
]

describe("module subscription pricing", () => {
  it("matches the Fund Development + Programs + Membership example", () => {
    const quote = calculateModuleSubscriptionQuote({
      selectedSlugs: ["donations", "programs", "membership"],
      productModules: exampleModules,
      discountRules: exampleRules,
    })

    assert.equal(quote.moduleCount, 3)
    assert.equal(quote.moduleSubtotalCents, 39700)
    assert.equal(quote.discountPercent, 10)
    assert.equal(quote.discountAmountCents, 3970)
    assert.equal(quote.calculatedMonthlyCents, 35730)
    assert.equal(quote.billedMonthlyCents, 35730)
    assert.equal(formatCentsAsUsd(quote.moduleSubtotalCents), "$397.00")
    assert.equal(formatCentsAsUsd(quote.discountAmountCents), "$39.70")
    assert.equal(formatCentsAsUsd(quote.calculatedMonthlyCents), "$357.30")
  })

  it("uses integer math for percent discounts", () => {
    assert.equal(percentOfCents(39700, 10), 3970)
    assert.equal(percentOfCents(100, 5), 5)
    assert.equal(discountPercentForModuleCount(1, exampleRules), 0)
    assert.equal(discountPercentForModuleCount(2, exampleRules), 5)
    assert.equal(discountPercentForModuleCount(6, exampleRules), 20)
  })

  it("uses a custom monthly override when set", () => {
    const quote = calculateModuleSubscriptionQuote({
      selectedSlugs: ["donations", "programs", "membership"],
      productModules: exampleModules,
      discountRules: exampleRules,
      customMonthlyCents: 29900,
    })

    assert.equal(quote.calculatedMonthlyCents, 35730)
    assert.equal(quote.customMonthlyCents, 29900)
    assert.equal(quote.billedMonthlyCents, 29900)
    assert.equal(quote.usingCustomPrice, true)
  })

  it("keeps a locked grandfathered price until Super Admin changes it", () => {
    const quote = calculateModuleSubscriptionQuote({
      selectedSlugs: ["programs"],
      productModules: exampleModules,
      discountRules: exampleRules,
      isPriceLocked: true,
      lockedMonthlyCents: 24800,
    })

    assert.equal(quote.calculatedMonthlyCents, 14900)
    assert.equal(quote.billedMonthlyCents, 24800)
    assert.equal(quote.isPriceLocked, true)
  })

  it("parses dollar input into cents without floats", () => {
    assert.equal(parseUsdToCents("149.00"), 14900)
    assert.equal(parseUsdToCents("$39.70"), 3970)
    assert.equal(parseUsdToCents("10"), 1000)
    assert.equal(parseUsdToCents("abc"), null)
  })
})
