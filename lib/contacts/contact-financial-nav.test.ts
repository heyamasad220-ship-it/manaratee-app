import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { ContactProfileModuleFlags } from "@/lib/contacts/contact-profile-module-access"
import type {
  ContactFinancialSummaryPayload,
  ContactFinancialTimelineEvent,
  ContactOpenBalanceRow,
} from "@/lib/contacts/contact-financial-types"

import {
  defaultFinancialModuleSection,
  detectContactFinancialActivity,
  filterFinancialRowsBySection,
  getEnabledFinancialBillingModules,
  getFinancialDetailTabs,
  parseFinancialModuleSection,
  resolveFinancialModuleSection,
  shouldShowFinancialModuleNav,
} from "./contact-financial-nav"

const EMPTY_MODULES: ContactProfileModuleFlags = {
  donations: false,
  bookings: false,
  workforce: false,
  vendorHub: false,
  programs: false,
  membership: false,
  applications: false,
}

function modules(
  overrides: Partial<ContactProfileModuleFlags>
): ContactProfileModuleFlags {
  return { ...EMPTY_MODULES, ...overrides }
}

function timelineEvent(
  sourceModule: ContactFinancialTimelineEvent["sourceModule"]
): ContactFinancialTimelineEvent {
  return {
    id: `${sourceModule}-1`,
    date: "2026-09-01",
    eventType: "Payment",
    description: "Test",
    amount: 25,
    method: null,
    status: "Succeeded",
    sourceModule,
    filterCategory: sourceModule === "donations" ? "donations" : sourceModule,
    href: null,
  }
}

function openBalance(
  sourceModule: ContactOpenBalanceRow["sourceModule"]
): ContactOpenBalanceRow {
  return {
    id: `${sourceModule}-balance`,
    type: "Fee",
    description: "Open",
    originalAmount: 100,
    paidAmount: 0,
    balanceRemaining: 100,
    status: "open",
    sourceModule,
    href: null,
  }
}

function payload(
  overrides: Partial<ContactFinancialSummaryPayload> = {}
): Pick<ContactFinancialSummaryPayload, "timeline" | "openBalances" | "metrics"> {
  return {
    timeline: [],
    openBalances: [],
    metrics: {
      totalPaid: 0,
      lifetimeContributions: 0,
      outstandingBalance: 0,
      lastActivityDate: null,
      donationsOnlyTotalPaid: true,
    },
    ...overrides,
  }
}

describe("contact financial nav", () => {
  it("hides fund development and membership for a programs-only tenant", () => {
    const enabled = getEnabledFinancialBillingModules(modules({ programs: true }))
    assert.deepEqual(enabled, ["programs"])
    assert.equal(shouldShowFinancialModuleNav(modules({ programs: true })), false)
    assert.deepEqual(
      getFinancialDetailTabs({
        section: "programs",
        modules: modules({ programs: true }),
        showPaymentMethods: true,
      }).map((tab) => tab.id),
      ["charges", "transactions", "refunds", "payment-methods"]
    )
    assert.ok(
      !getFinancialDetailTabs({
        section: "programs",
        modules: modules({ programs: true }),
        showPaymentMethods: true,
      }).some((tab) => tab.id === "recurring" || tab.id === "pledges")
    )
  })

  it("flattens a donations-only tenant onto recurring and pledges", () => {
    const tabs = getFinancialDetailTabs({
      section: "donations",
      modules: modules({ donations: true }),
      showPaymentMethods: true,
    }).map((tab) => tab.id)
    assert.deepEqual(tabs, ["recurring", "pledges", "refunds", "payment-methods"])
  })

  it("shows All plus per-module nav when more than one billing module is on", () => {
    const mixed = modules({ donations: true, programs: true, membership: true })
    assert.equal(shouldShowFinancialModuleNav(mixed), true)
    assert.deepEqual(getEnabledFinancialBillingModules(mixed), [
      "donations",
      "programs",
      "membership",
    ])
  })

  it("defaults a programs-only contact in a mixed org onto Programs", () => {
    const mixed = modules({ donations: true, programs: true, membership: true })
    const activity = detectContactFinancialActivity(
      payload({
        timeline: [timelineEvent("programs")],
        openBalances: [openBalance("programs")],
      })
    )
    assert.equal(activity.programs, true)
    assert.equal(activity.donations, false)
    assert.equal(defaultFinancialModuleSection(mixed, activity), "programs")
    assert.equal(resolveFinancialModuleSection(mixed, null, activity), "programs")
  })

  it("defaults mixed activity onto All so staff still see the shared ledger", () => {
    const mixed = modules({ donations: true, programs: true })
    const activity = detectContactFinancialActivity(
      payload({
        timeline: [timelineEvent("donations"), timelineEvent("programs")],
        metrics: {
          totalPaid: 50,
          lifetimeContributions: 25,
          outstandingBalance: 0,
          lastActivityDate: null,
          donationsOnlyTotalPaid: false,
        },
      })
    )
    assert.equal(defaultFinancialModuleSection(mixed, activity), "all")
  })

  it("keeps a requested Fund Development section even when the contact is not a donor", () => {
    const mixed = modules({ donations: true, programs: true })
    const activity = detectContactFinancialActivity(
      payload({ timeline: [timelineEvent("programs")] })
    )
    assert.equal(
      resolveFinancialModuleSection(mixed, "donations", activity),
      "donations"
    )
  })

  it("ignores Fund Development URLs when the tenant is not subscribed", () => {
    const programsOnly = modules({ programs: true })
    assert.equal(
      resolveFinancialModuleSection(programsOnly, "donations", {
        donations: false,
        programs: true,
        bookings: false,
        vendorHub: false,
        membership: false,
      }),
      "programs"
    )
  })

  it("parses friendly module query values", () => {
    assert.equal(parseFinancialModuleSection("fund-development"), "donations")
    assert.equal(parseFinancialModuleSection("venue-rentals"), "bookings")
    assert.equal(parseFinancialModuleSection("vendor-hub"), "vendorHub")
    assert.equal(parseFinancialModuleSection("nope"), null)
  })

  it("filters charges and refunds to the active module section", () => {
    const rows = [openBalance("programs"), openBalance("donations")]
    assert.deepEqual(
      filterFinancialRowsBySection(rows, "programs").map((row) => row.sourceModule),
      ["programs"]
    )
    assert.equal(filterFinancialRowsBySection(rows, "all").length, 2)
  })
})
