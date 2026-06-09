"use server"

import { syncContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"

/** @deprecated Use syncContactAffiliations — kept for call-site compatibility. */
export async function syncMembershipContactRole(
  organizationId: string,
  contactId: string,
  supabaseClient?: Parameters<typeof syncContactAffiliations>[2]
) {
  await syncContactAffiliations(contactId, organizationId, supabaseClient)
}
