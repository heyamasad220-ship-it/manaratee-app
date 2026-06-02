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
