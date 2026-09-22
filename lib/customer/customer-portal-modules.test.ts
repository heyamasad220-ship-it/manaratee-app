import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  isCustomerApplicationTypeEnabled,
  showCustomerApplicationsNav,
} from "./customer-portal-modules"

describe("customer profile applications", () => {
  it("hides all role applications for a Fund Development-only org", () => {
    const enabled = new Set(["donations", "dashboard", "contacts", "settings"])
    assert.equal(showCustomerApplicationsNav(enabled), false)
    assert.equal(isCustomerApplicationTypeEnabled(enabled, "vendor"), false)
    assert.equal(isCustomerApplicationTypeEnabled(enabled, "volunteer"), false)
    assert.equal(isCustomerApplicationTypeEnabled(enabled, "childcare_provider"), false)
  })

  it("shows volunteer and childcare when Programs or Event Management is on", () => {
    const programs = new Set(["programs"])
    assert.equal(showCustomerApplicationsNav(programs), true)
    assert.equal(isCustomerApplicationTypeEnabled(programs, "volunteer"), true)
    assert.equal(isCustomerApplicationTypeEnabled(programs, "childcare_provider"), true)
    assert.equal(isCustomerApplicationTypeEnabled(programs, "vendor"), false)

    const events = new Set(["event-management"])
    assert.equal(isCustomerApplicationTypeEnabled(events, "volunteer"), true)
    assert.equal(isCustomerApplicationTypeEnabled(events, "childcare_provider"), true)
  })

  it("shows vendor applications only when Vendor Hub is on", () => {
    const vendorHub = new Set(["vendor-hub"])
    assert.equal(showCustomerApplicationsNav(vendorHub), true)
    assert.equal(isCustomerApplicationTypeEnabled(vendorHub, "vendor"), true)
    assert.equal(isCustomerApplicationTypeEnabled(vendorHub, "volunteer"), false)
  })
})
