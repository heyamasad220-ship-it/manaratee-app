import { createClient } from "@/lib/supabase/server"

export type ContactLookupResult = {
  contactId: string | null
  warning: string | null
}

export async function lookupContactByPersonId(
  organizationId: string,
  personId: string
): Promise<ContactLookupResult> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("person_id", personId)
    .maybeSingle()

  if (error) {
    console.error("lookupContactByPersonId failed", {
      organizationId,
      personId,
      message: error.message,
    })
    return {
      contactId: null,
      warning: "Could not verify participant contact record.",
    }
  }

  if (!data?.id) {
    console.warn("Missing contact for person — migration required", {
      organizationId,
      personId,
    })
    return {
      contactId: null,
      warning:
        "This participant does not have a linked contact record yet. Ask your organization administrator to link or migrate contacts before registering.",
    }
  }

  return { contactId: data.id, warning: null }
}

export async function lookupContactsByPersonIds(
  organizationId: string,
  personIds: string[]
) {
  if (personIds.length === 0) {
    return new Map<string, string>()
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("contacts")
    .select("id, person_id")
    .eq("organization_id", organizationId)
    .in("person_id", personIds)

  if (error) {
    console.error("lookupContactsByPersonIds failed", error.message)
    return new Map<string, string>()
  }

  const map = new Map<string, string>()
  for (const row of data || []) {
    if (row.person_id) {
      map.set(row.person_id as string, row.id as string)
    }
  }

  return map
}

export async function verifyContactInOrganization(
  organizationId: string,
  contactId: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("contacts")
    .select("id, person_id, full_name, email, phone")
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data
}
