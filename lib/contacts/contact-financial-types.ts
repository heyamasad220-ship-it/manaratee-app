import type { ContactProfileModuleFlags } from "@/lib/contacts/contact-profile-module-access"

export type ContactFinancialFilter =
  | "all"
  | "donations"
  | "pledges"
  | "programs"
  | "venue_rentals"
  | "membership"
  | "other"

export type ContactFinancialSourceModule =
  | "donations"
  | "programs"
  | "venue_rentals"
  | "membership"
  | "other"

export type ContactFinancialSummaryMetrics = {
  totalPaid: number
  lifetimeContributions: number
  outstandingBalance: number
  lastActivityDate: string | null
  /** True when total paid equals donation totals only (no other modules in sum). */
  donationsOnlyTotalPaid: boolean
}

export type ContactOpenBalanceRow = {
  id: string
  type: string
  description: string
  originalAmount: number | null
  paidAmount: number | null
  balanceRemaining: number
  status: string | null
  sourceModule: ContactFinancialSourceModule
  href: string | null
}

export type ContactFinancialTimelineEvent = {
  id: string
  date: string
  /** Module label shown in the Type column (e.g. Donations, Programs). */
  eventType: string
  /** Specific activity label shown in the Description column (e.g. One-Time Donation). */
  description: string
  amount: number | null
  method: string | null
  status: string | null
  sourceModule: ContactFinancialSourceModule
  filterCategory: Exclude<ContactFinancialFilter, "all">
  href: string | null
}

export type ContactFinancialSummaryPayload = {
  metrics: ContactFinancialSummaryMetrics
  openBalances: ContactOpenBalanceRow[]
  timeline: ContactFinancialTimelineEvent[]
  availableFilters: ContactFinancialFilter[]
  moduleNotes: {
    programsReady: boolean
    rentalsReady: boolean
    membershipReady: boolean
  }
}

export type LoadContactFinancialSummaryInput = {
  contactId: string
  donorId?: string | null
  personId?: string | null
  modules: ContactProfileModuleFlags
  isGroup?: boolean
}
