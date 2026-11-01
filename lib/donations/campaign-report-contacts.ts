"use server"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type CampaignReportContact = {
  email: string | null
  phone: string | null
}

export async function loadCampaignReportContactsAction(
  rows: Array<{ id: string; donorId: string | null; contactId: string | null }>
): Promise<
  | { success: true; contacts: Record<string, CampaignReportContact> }
  | { success: false; error: string }
> {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false, error: access.error }

  const donorIds = [
    ...new Set(rows.map((row) => row.donorId).filter((id): id is string => Boolean(id))),
  ]
  const contactIds = [
    ...new Set(rows.map((row) => row.contactId).filter((id): id is string => Boolean(id))),
  ]

  const client = createServiceRoleClient()
  const donorById = new Map<
    string,
    { email: string | null; phone: string | null; contactId: string | null }
  >()
  if (donorIds.length > 0) {
    const { data, error } = await client
      .from("donors")
      .select("id, email, phone, contact_id")
      .eq("organization_id", access.orgId)
      .in("id", donorIds)
    if (error) return { success: false, error: error.message }
    for (const row of data || []) {
      const contactId = (row.contact_id as string | null) ?? null
      if (contactId) contactIds.push(contactId)
      donorById.set(row.id as string, {
        email: (row.email as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
        contactId,
      })
    }
  }

  const uniqueContactIds = [...new Set(contactIds)]
  const contactById = new Map<string, { email: string | null; phone: string | null }>()
  if (uniqueContactIds.length > 0) {
    const { data, error } = await client
      .from("contacts")
      .select("id, email, phone")
      .eq("organization_id", access.orgId)
      .in("id", uniqueContactIds)
    if (error) return { success: false, error: error.message }
    for (const row of data || []) {
      contactById.set(row.id as string, {
        email: (row.email as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
      })
    }
  }

  const contacts: Record<string, CampaignReportContact> = {}
  for (const row of rows) {
    const donor = row.donorId ? donorById.get(row.donorId) : undefined
    const contactId = row.contactId || donor?.contactId || null
    const contact = contactId ? contactById.get(contactId) : undefined
    const email = (contact?.email || donor?.email || "").trim() || null
    const phone = (contact?.phone || donor?.phone || "").trim() || null
    contacts[row.id] = { email, phone }
  }

  return { success: true, contacts }
}
