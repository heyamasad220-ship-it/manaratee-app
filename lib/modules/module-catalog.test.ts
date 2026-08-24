import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  expandEnabledModuleSlugs,
  isCoreModuleSlug,
  isHiddenSubscriptionCapabilitySlug,
  isProductModuleSlug,
  isValidProductModuleSlug,
  PRODUCT_MODULE_SLUGS,
  sanitizeIncludedCapabilitySlugs,
  slugifyProductModuleSlug,
} from "./module-catalog"

describe("module catalog subscriptions", () => {
  it("sells the staff product modules, not Workforce or Finance", () => {
    assert.deepEqual([...PRODUCT_MODULE_SLUGS], [
      "event-management",
      "programs",
      "vendor-hub",
      "bookings",
      "donations",
      "membership",
    ])
    assert.equal(isProductModuleSlug("workforce"), false)
    assert.equal(isProductModuleSlug("finance"), false)
    assert.equal(isProductModuleSlug("hr"), false)
  })

  it("treats Administration (workforce) as core for every tenant", () => {
    assert.equal(isCoreModuleSlug("workforce"), true)
    assert.equal(isCoreModuleSlug("hr"), true)
    assert.equal(expandEnabledModuleSlugs([]).has("workforce"), true)
  })

  it("includes Finance as a Programs capability, not a catalog SKU", () => {
    const withPrograms = expandEnabledModuleSlugs(["programs"])
    assert.equal(withPrograms.has("finance"), true)
    assert.equal(withPrograms.has("spaces"), true)
    assert.equal(expandEnabledModuleSlugs(["membership"]).has("finance"), false)
    assert.equal(isHiddenSubscriptionCapabilitySlug("finance"), true)
  })

  it("includes Facilities with operations modules, not Membership or Fund Development", () => {
    assert.equal(isProductModuleSlug("spaces"), false)
    assert.equal(isHiddenSubscriptionCapabilitySlug("spaces"), true)
    assert.equal(expandEnabledModuleSlugs(["event-management"]).has("spaces"), true)
    assert.equal(expandEnabledModuleSlugs(["programs"]).has("spaces"), true)
    assert.equal(expandEnabledModuleSlugs(["bookings"]).has("spaces"), true)
    assert.equal(expandEnabledModuleSlugs(["vendor-hub"]).has("spaces"), true)
    assert.equal(expandEnabledModuleSlugs(["membership"]).has("spaces"), false)
    assert.equal(expandEnabledModuleSlugs(["donations"]).has("spaces"), false)
  })

  it("includes Community Calendar with Vendor Hub or Event Management", () => {
    assert.equal(isProductModuleSlug("community-calendar"), false)
    assert.equal(isHiddenSubscriptionCapabilitySlug("community-calendar"), true)
    assert.equal(
      expandEnabledModuleSlugs(["event-management"]).has("community-calendar"),
      true
    )
    assert.equal(
      expandEnabledModuleSlugs(["vendor-hub"]).has("community-calendar"),
      true
    )
    assert.equal(
      expandEnabledModuleSlugs(["programs"]).has("community-calendar"),
      false
    )
    assert.equal(
      expandEnabledModuleSlugs(["bookings"]).has("community-calendar"),
      false
    )
    assert.equal(expandEnabledModuleSlugs(["membership"]).has("community-calendar"), false)
    assert.equal(expandEnabledModuleSlugs(["donations"]).has("community-calendar"), false)
  })

  it("includes volunteer sign-ups and childcare with Event Management and Programs", () => {
    const events = expandEnabledModuleSlugs(["event-management"])
    const programs = expandEnabledModuleSlugs(["programs"])
    assert.equal(events.has("sign-ups"), true)
    assert.equal(events.has("child-care"), true)
    assert.equal(programs.has("sign-ups"), true)
    assert.equal(programs.has("child-care"), true)
    assert.equal(isProductModuleSlug("sign-ups"), false)
    assert.equal(isProductModuleSlug("child-care"), false)
    assert.equal(isHiddenSubscriptionCapabilitySlug("sign-ups"), true)
    assert.equal(isHiddenSubscriptionCapabilitySlug("child-care"), true)
  })

  it("slugifies custom product module names", () => {
    assert.equal(slugifyProductModuleSlug("Custom Youth Program"), "custom-youth-program")
    assert.equal(isValidProductModuleSlug("custom-youth-program"), true)
    assert.equal(isValidProductModuleSlug("Youth"), false)
  })

  it("keeps only editable capability slugs", () => {
    assert.deepEqual(
      sanitizeIncludedCapabilitySlugs(["spaces", "hr", "ticketing", "spaces"]),
      ["ticketing", "spaces"]
    )
  })
})
