"use server"

import { syncContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

/** Sync affiliations after staff create, update, or delete. */
export async function syncStaffContactAffiliations(staffId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return

  const { data: staff } = await supabase
    .from("staff")
    .select("contact_id")
    .eq("organization_id", organizationId)
    .eq("id", staffId)
    .maybeSingle()

  const contactId = staff?.contact_id as string | null
  if (contactId) {
    await syncContactAffiliations(contactId, organizationId, supabase)
  }
}

/** Sync affiliations after staff delete (pass contact id before row is removed). */
export async function syncStaffContactAffiliationsByContactId(contactId: string | null) {
  if (!contactId) return
  await syncContactAffiliations(contactId)
}
