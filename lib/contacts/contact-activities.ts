/**
 * Layer 3: Contact activities — transactions and interactions (NOT roles).
 * Customer behavior is inferred from activity records, never stored as a role.
 */

export const CONTACT_ACTIVITY_TYPES = {
  programs: ["registered_program", "attended_program"] as const,
  ticketing: ["purchased_ticket", "attended_event"] as const,
  spaces: ["booked_venue"] as const,
  vendorHub: ["vendor_application", "vendor_participation"] as const,
  donations: ["donation_made", "pledge_created"] as const,
} as const

export type ContactActivityModule = keyof typeof CONTACT_ACTIVITY_TYPES

export type ContactActivityRecord = {
  id: string
  module: ContactActivityModule
  activityType: string
  title: string
  subtitle?: string
  date?: string | null
  amount?: number | null
  status?: string | null
}

export type ContactActivitySummary = {
  programs: ContactActivityRecord[]
  ticketing: ContactActivityRecord[]
  spaces: ContactActivityRecord[]
  donations: ContactActivityRecord[]
  vendorHub: ContactActivityRecord[]
  hasTransactionalActivity: boolean
}

export function emptyActivitySummary(): ContactActivitySummary {
  return {
    programs: [],
    ticketing: [],
    spaces: [],
    donations: [],
    vendorHub: [],
    hasTransactionalActivity: false,
  }
}
