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
  /** Activity type shown in the Type column (Donation, Pledge, Programs, …). */
  eventType: string
  /** Specific activity label shown in the Description column. */
  description: string
  amount: number | null
  method: string | null
  status: string | null
  sourceModule: ContactFinancialSourceModule
  filterCategory: Exclude<ContactFinancialFilter, "all">
  href: string | null
  /** When set, Status column shows a link-to-pledge action instead of a badge. */
  statusAction?: "link_to_pledge" | null
  /** Set when a gift was counted toward a group (individual donors only). */
  attributedGroupContactId?: string | null
  attributedGroupName?: string | null
  /** Donation payment fields for report-style row actions on contact profile. */
  paymentActionRow?: {
    id: string
    amount: number
    refunded_amount: number | null
    payment_date: string
    source: string | null
    source_type: string | null
    status: string | null
    memo: string | null
    pledge_id: string | null
    import_batch_id: string | null
    stripe_payment_intent_id: string | null
    stripe_charge_id: string | null
  }
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
