"use server"

import { revalidatePath } from "next/cache"
import { normalizePhone } from "@/lib/contacts/contact-constants"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"

export async function updateDonorContactProfileAction(input: {
  donorId: string
  contactId?: string | null
  fullName: string
  email?: string | null
  phone?: string | null
  primaryContactName?: string | null
}) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  const fullName = input.fullName.trim()
  if (!fullName) {
    return { success: false as const, error: "Contact name is required" }
  }

  const email = input.email?.trim().toLowerCase() || null
  const phone = normalizePhone(input.phone) || null
  const primaryContactName = input.primaryContactName?.trim() || null

  const { data: donor, error: donorLoadError } = await access.supabase
    .from("donors")
    .select("id, contact_id, donor_type")
    .eq("organization_id", access.orgId)
    .eq("id", input.donorId)
    .maybeSingle()

  if (donorLoadError || !donor) {
    return { success: false as const, error: "Donor not found" }
  }

  const contactId = input.contactId || donor.contact_id

  const { error: donorUpdateError } = await access.supabase
    .from("donors")
    .update({
      full_name: fullName,
      email,
      phone,
    })
    .eq("organization_id", access.orgId)
    .eq("id", input.donorId)

  if (donorUpdateError) {
    return { success: false as const, error: donorUpdateError.message }
  }

  if (contactId) {
    const isOrganization = donor.donor_type === "organization"
    const { error: contactUpdateError } = await access.supabase
      .from("contacts")
      .update({
        full_name: fullName,
        email,
        phone,
        primary_contact_name: isOrganization ? primaryContactName : null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", access.orgId)
      .eq("id", contactId)

    if (contactUpdateError) {
      return { success: false as const, error: contactUpdateError.message }
    }
  }

  revalidatePath("/donations/donors")
  revalidatePath(`/donations/donors/individuals/${input.donorId}`)
  revalidatePath(`/donations/donors/organizations/${input.donorId}`)
  if (contactId) {
    revalidatePath(`/contacts/${contactId}`)
  }

  return { success: true as const }
}
