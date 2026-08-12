import { createClient } from "@/lib/supabase/server"
import type { ContactSummary } from "@/lib/programs/registration-display-status"

export type { ContactSummary }
export {
  contactLabel,
  isTerminalEnrollmentStatus,
  shouldShowEnrollmentPaymentStatus,
  canEditEnrollmentCharges,
} from "@/lib/programs/registration-display-status"

/** PostgREST `.in()` lists can blow URL limits; keep batches modest. */
const CONTACT_ID_CHUNK_SIZE = 100

export async function loadContactsByIds(
  organizationId: string,
  contactIds: string[]
) {
  const uniqueIds = [
    ...new Set(
      contactIds.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0
      )
    ),
  ]

  if (uniqueIds.length === 0) {
    return new Map<string, ContactSummary>()
  }

  const map = new Map<string, ContactSummary>()

  try {
    const supabase = await createClient()

    for (let index = 0; index < uniqueIds.length; index += CONTACT_ID_CHUNK_SIZE) {
      const chunk = uniqueIds.slice(index, index + CONTACT_ID_CHUNK_SIZE)
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name, email, phone")
        .eq("organization_id", organizationId)
        .in("id", chunk)

      if (error) {
        // Recoverable — callers already fall back to enrollment name fields.
        console.warn("loadContactsByIds:", error.message)
        continue
      }

      for (const row of data || []) {
        map.set(row.id as string, row as ContactSummary)
      }
    }
  } catch (error) {
    console.warn(
      "loadContactsByIds:",
      error instanceof Error ? error.message : error
    )
  }

  return map
}
