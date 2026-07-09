"use server"

import { revalidatePath } from "next/cache"

import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import {
  validatePledgePaymentPlanInput,
  type PledgePlanFrequency,
} from "@/lib/donations/pledge-payment-plan"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"

async function getCustomerDonorContext() {
  const { supabase, session } = await getCustomerPortalSupabase()
  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    return { ok: false as const, error: "No active organization" }
  }

  const organizationId = activeOrganization.organization_id

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, organization_id")
    .eq("auth_user_id", session.effectiveUserId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (contactError || !contact) {
    return { ok: false as const, error: "Contact not found" }
  }

  const donorId = await ensureDonorExtensionForContact(organizationId, contact.id)
  if (!donorId) {
    return { ok: false as const, error: "Could not resolve your donor profile." }
  }

  return {
    ok: true as const,
    supabase,
    organizationId,
    contactId: contact.id as string,
    donorId,
  }
}

export async function createCustomerPledgeAction(input: {
  campaignId: string
  totalAmount: number
}) {
  try {
    const context = await getCustomerDonorContext()
    if (!context.ok) return context

    const { supabase, organizationId, donorId } = context
    const campaignId = input.campaignId?.trim()

    if (!campaignId) {
      return { success: false as const, error: "Please select a campaign." }
    }

    const totalAmount = Number(input.totalAmount)
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return { success: false as const, error: "Enter a valid total pledge amount." }
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, name, status")
      .eq("organization_id", organizationId)
      .eq("id", campaignId)
      .maybeSingle()

    if (campaignError || !campaign) {
      return { success: false as const, error: "Selected campaign was not found." }
    }

    if (String(campaign.status).toLowerCase() !== "active") {
      return { success: false as const, error: "Selected campaign is not available for pledges." }
    }

    const pledgeDate = new Date().toISOString().split("T")[0]

    const { data, error } = await supabase
      .from("pledges")
      .insert({
        organization_id: organizationId,
        donor_id: donorId,
        campaign_id: campaignId,
        category_id: null,
        subcategory_id: null,
        amount_pledged: totalAmount,
        installment_amount: null,
        total_payments: null,
        pledge_date: pledgeDate,
        first_payment_date: null,
        next_payment_date: null,
        pledge_type: "one_time",
        frequency: "one_time",
        status: "open",
        notes: null,
      })
      .select("id")
      .single()

    if (error) {
      return { success: false as const, error: error.message || "Pledge could not be saved." }
    }

    revalidatePath("/customer/donation")
    return { success: true as const, pledgeId: data.id as string }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function updateCustomerPledgePaymentPlanAction(input: {
  pledgeId: string
  installmentAmount: number
  numberOfPayments: number
  frequency: PledgePlanFrequency
  firstPaymentDate: string
}) {
  try {
    const context = await getCustomerDonorContext()
    if (!context.ok) return context

    const { supabase, organizationId, donorId } = context
    const pledgeId = input.pledgeId?.trim()

    if (!pledgeId) {
      return { success: false as const, error: "Pledge not found." }
    }

    const { data: pledge, error: pledgeError } = await supabase
      .from("pledge_status_view")
      .select("id, amount_pledged, balance_remaining, calculated_status")
      .eq("organization_id", organizationId)
      .eq("donor_id", donorId)
      .eq("id", pledgeId)
      .maybeSingle()

    if (pledgeError || !pledge) {
      return { success: false as const, error: "Pledge not found." }
    }

    if (String(pledge.calculated_status).toLowerCase() === "fulfilled") {
      return { success: false as const, error: "This pledge is already fulfilled." }
    }

    const totalAmount = Number(pledge.amount_pledged || 0)

    const validated = validatePledgePaymentPlanInput(totalAmount, {
      installmentAmount: input.installmentAmount,
      numberOfPayments: input.numberOfPayments,
      frequency: input.frequency,
      firstPaymentDate: input.firstPaymentDate,
    })

    if (!validated.ok) {
      return { success: false as const, error: validated.error }
    }

    const { installmentAmount, totalPayments, frequency, firstPaymentDate } = validated.plan

    const { error } = await supabase
      .from("pledges")
      .update({
        installment_amount: installmentAmount,
        total_payments: totalPayments,
        first_payment_date: firstPaymentDate,
        next_payment_date: firstPaymentDate,
        pledge_type: frequency,
        frequency,
      })
      .eq("id", pledgeId)
      .eq("organization_id", organizationId)
      .eq("donor_id", donorId)

    if (error) {
      return { success: false as const, error: error.message || "Could not save payment plan." }
    }

    revalidatePath("/customer/donation")
    return { success: true as const }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}
