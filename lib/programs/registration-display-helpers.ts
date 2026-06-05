import { createClient } from "@/lib/supabase/server"

export type ContactSummary = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
}

export async function loadContactsByIds(
  organizationId: string,
  contactIds: string[]
) {
  const uniqueIds = [...new Set(contactIds.filter(Boolean))]

  if (uniqueIds.length === 0) {
    return new Map<string, ContactSummary>()
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("contacts")
    .select("id, full_name, email, phone")
    .eq("organization_id", organizationId)
    .in("id", uniqueIds)

  if (error) {
    console.error("loadContactsByIds:", error.message)
    return new Map<string, ContactSummary>()
  }

  const map = new Map<string, ContactSummary>()

  for (const row of data || []) {
    map.set(row.id as string, row as ContactSummary)
  }

  return map
}

export function contactLabel(
  contact: ContactSummary | undefined,
  fallback: string | null | undefined
) {
  if (contact?.full_name) return contact.full_name
  if (contact?.email) return contact.email
  return fallback || "Not linked"
}

const TERMINAL_ENROLLMENT_STATUSES = new Set([
  "cancelled",
  "canceled",
  "withdrawn",
  "transferred",
  "expired",
])

/** Enrollment statuses where payment tracking is no longer meaningful in the UI. */
export function isTerminalEnrollmentStatus(status: string | null | undefined) {
  return TERMINAL_ENROLLMENT_STATUSES.has((status || "").toLowerCase())
}

export function shouldShowEnrollmentPaymentStatus(
  enrollmentStatus: string | null | undefined
) {
  return !isTerminalEnrollmentStatus(enrollmentStatus)
}

/** Charge ledger line edits are blocked once enrollment is terminal (e.g. cancelled). */
export function canEditEnrollmentCharges(
  enrollmentStatus: string | null | undefined
) {
  return !isTerminalEnrollmentStatus(enrollmentStatus)
}
