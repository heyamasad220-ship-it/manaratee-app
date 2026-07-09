"use server"

import { revalidatePath } from "next/cache"

import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import { validateCustomerDonationAttribution } from "@/lib/donations/donation-fund-status"
import { normalizePaymentSourceChannel } from "@/lib/donations/payment-source-channel"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"

export async function recordCustomerPortalDonationAction(input: {
  amount: number
  campaignId?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
  paymentMethodName: string
  memo?: string | null
}) {
  const { supabase, session } = await getCustomerPortalSupabase()
  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    return { success: false as const, error: "No active organization" }
  }

  const organizationId = activeOrganization.organization_id
  const amount = Number(input.amount)

  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false as const, error: "Enter a valid donation amount." }
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, full_name, email, organization_id")
    .eq("auth_user_id", session.effectiveUserId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (contactError || !contact) {
    return { success: false as const, error: "Contact not found" }
  }

  const attributionCheck = await validateCustomerDonationAttribution(supabase, organizationId, {
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
  })

  if (!attributionCheck.ok) {
    return { success: false as const, error: attributionCheck.error }
  }

  const donorId = await ensureDonorExtensionForContact(organizationId, contact.id)
  if (!donorId) {
    return { success: false as const, error: "Could not resolve your donor profile." }
  }

  const paymentDate = new Date().toISOString().split("T")[0]
  const paymentMethodName = input.paymentMethodName.trim() || "Portal"

  const { data, error } = await supabase
    .from("payments")
    .insert({
      organization_id: organizationId,
      contact_id: contact.id,
      donor_id: donorId,
      pledge_id: null,
      sender_name: contact.full_name || contact.email || null,
      amount,
      payment_date: `${paymentDate}T12:00:00`,
      source: normalizePaymentSourceChannel(paymentMethodName),
      source_type: "portal",
      status: "unallocated",
      is_verified: false,
      campaign_id: input.campaignId || null,
      category_id: input.categoryId || null,
      subcategory_id: input.subcategoryId || null,
      memo: input.memo?.trim() || `Offline donation recorded (${paymentMethodName})`,
    })
    .select("id, amount, payment_date, source, status, memo")
    .single()

  if (error || !data) {
    return {
      success: false as const,
      error: error?.message || "Donation could not be saved. Please try again.",
    }
  }

  revalidatePath("/customer/donation")
  revalidatePath("/customer/dashboard")

  return { success: true as const, payment: data }
}
