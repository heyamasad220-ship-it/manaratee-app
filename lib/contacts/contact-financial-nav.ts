import type { ContactProfileModuleFlags } from "@/lib/contacts/contact-profile-module-access"
import type {
  ContactFinancialSourceModule,
  ContactFinancialSummaryPayload,
} from "@/lib/contacts/contact-financial-types"

/** Billing products that can own a contact Financial inner section. */
export type ContactFinancialBillingModule =
  | "donations"
  | "programs"
  | "bookings"
  | "vendorHub"
  | "membership"

export type ContactFinancialModuleSection = "all" | ContactFinancialBillingModule

export type ContactFinancialDetailTab =
  | "transactions"
  | "recurring"
  | "pledges"
  | "charges"
  | "refunds"
  | "payment-methods"

export type ContactFinancialActivityFlags = Record<ContactFinancialBillingModule, boolean>

export type ContactFinancialDetailTabSpec = {
  id: ContactFinancialDetailTab
  label: string
}

const BILLING_MODULE_ORDER: ContactFinancialBillingModule[] = [
  "donations",
  "programs",
  "bookings",
  "vendorHub",
  "membership",
]

export const FINANCIAL_BILLING_MODULE_LABELS: Record<ContactFinancialBillingModule, string> = {
  donations: "Fund Development",
  programs: "Programs",
  bookings: "Venue Rentals",
  vendorHub: "Vendor Hub",
  membership: "Membership",
}

const SECTION_QUERY_VALUES: Record<ContactFinancialModuleSection, string> = {
  all: "all",
  donations: "fund-development",
  programs: "programs",
  bookings: "venue-rentals",
  vendorHub: "vendor-hub",
  membership: "membership",
}

const SECTION_QUERY_ALIASES: Record<string, ContactFinancialModuleSection> = {
  all: "all",
  donations: "donations",
  "fund-development": "donations",
  programs: "programs",
  bookings: "bookings",
  "venue-rentals": "bookings",
  rentals: "bookings",
  "vendor-hub": "vendorHub",
  vendorhub: "vendorHub",
  membership: "membership",
}

const SOURCE_TO_BILLING: Record<
  ContactFinancialSourceModule,
  ContactFinancialBillingModule | null
> = {
  donations: "donations",
  programs: "programs",
  venue_rentals: "bookings",
  vendor_hub: "vendorHub",
  membership: "membership",
  other: null,
}

const BILLING_TO_SOURCE: Record<ContactFinancialBillingModule, ContactFinancialSourceModule> = {
  donations: "donations",
  programs: "programs",
  bookings: "venue_rentals",
  vendorHub: "vendor_hub",
  membership: "membership",
}

export function getEnabledFinancialBillingModules(
  modules: ContactProfileModuleFlags
): ContactFinancialBillingModule[] {
  return BILLING_MODULE_ORDER.filter((module) => {
    switch (module) {
      case "donations":
        return modules.donations
      case "programs":
        return modules.programs
      case "bookings":
        return modules.bookings
      case "vendorHub":
        return modules.vendorHub
      case "membership":
        return modules.membership
    }
  })
}

export function shouldShowFinancialModuleNav(modules: ContactProfileModuleFlags) {
  return getEnabledFinancialBillingModules(modules).length > 1
}

export function parseFinancialModuleSection(
  value: string | null | undefined
): ContactFinancialModuleSection | null {
  if (!value) return null
  return SECTION_QUERY_ALIASES[value.trim().toLowerCase()] ?? null
}

export function financialModuleSectionQueryValue(
  section: ContactFinancialModuleSection
): string {
  return SECTION_QUERY_VALUES[section]
}

export function detectContactFinancialActivity(
  payload: Pick<ContactFinancialSummaryPayload, "timeline" | "openBalances" | "metrics">
): ContactFinancialActivityFlags {
  const flags: ContactFinancialActivityFlags = {
    donations: Number(payload.metrics.lifetimeContributions || 0) > 0,
    programs: false,
    bookings: false,
    vendorHub: false,
    membership: false,
  }

  for (const row of payload.timeline) {
    const billing = SOURCE_TO_BILLING[row.sourceModule]
    if (billing) flags[billing] = true
  }

  for (const row of payload.openBalances) {
    const billing = SOURCE_TO_BILLING[row.sourceModule]
    if (billing) flags[billing] = true
  }

  return flags
}

export function defaultFinancialModuleSection(
  modules: ContactProfileModuleFlags,
  activity: ContactFinancialActivityFlags
): ContactFinancialModuleSection {
  const enabled = getEnabledFinancialBillingModules(modules)
  if (enabled.length === 0) return "all"
  if (enabled.length === 1) return enabled[0]

  const activeEnabled = enabled.filter((module) => activity[module])
  if (activeEnabled.length === 1) return activeEnabled[0]
  return "all"
}

export function resolveFinancialModuleSection(
  modules: ContactProfileModuleFlags,
  requested: ContactFinancialModuleSection | null,
  activity: ContactFinancialActivityFlags
): ContactFinancialModuleSection {
  const enabled = getEnabledFinancialBillingModules(modules)
  if (enabled.length === 0) return "all"
  if (enabled.length === 1) return enabled[0]

  if (requested === "all") return "all"
  if (requested && enabled.includes(requested)) return requested
  return defaultFinancialModuleSection(modules, activity)
}

export function filterFinancialRowsBySection<
  T extends { sourceModule: ContactFinancialSourceModule },
>(rows: T[], section: ContactFinancialModuleSection): T[] {
  if (section === "all") return rows
  const source = BILLING_TO_SOURCE[section]
  return rows.filter((row) => row.sourceModule === source)
}

export function getFinancialDetailTabs(input: {
  section: ContactFinancialModuleSection
  modules: ContactProfileModuleFlags
  showPaymentMethods: boolean
  isGroup?: boolean
  isCustomer?: boolean
}): ContactFinancialDetailTabSpec[] {
  if (input.isGroup || input.isCustomer) return []

  const flattened = !shouldShowFinancialModuleNav(input.modules)
  const includePaymentMethods =
    input.showPaymentMethods && (flattened || input.section === "all")

  const tabs: ContactFinancialDetailTabSpec[] = []

  switch (input.section) {
    case "all":
      tabs.push(
        { id: "transactions", label: "Payments" },
        { id: "refunds", label: "Refunds" }
      )
      break
    case "donations":
      tabs.push(
        { id: "recurring", label: "Recurring" },
        { id: "pledges", label: "Pledges" },
        { id: "refunds", label: "Refunds" }
      )
      break
    case "programs":
    case "bookings":
    case "vendorHub":
      tabs.push(
        { id: "charges", label: "Charges" },
        { id: "transactions", label: "Payments" },
        { id: "refunds", label: "Refunds" }
      )
      break
    case "membership":
      return []
  }

  if (includePaymentMethods) {
    tabs.push({ id: "payment-methods", label: "Payment Methods" })
  }

  return tabs
}
