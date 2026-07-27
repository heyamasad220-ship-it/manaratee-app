"use server"

import { revalidatePath } from "next/cache"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import { ensureCampaignDonationFund } from "@/lib/donations/ensure-campaign-donation-fund"

/** Creates (or reuses) a fund under General Donation named after the campaign. */
export async function ensureCampaignDonationFundAction(campaignName: string) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) {
    return { success: false as const, error: access.error }
  }

  const result = await ensureCampaignDonationFund(
    access.supabase,
    access.orgId,
    campaignName
  )

  if (!result.success) {
    return result
  }

  revalidatePath("/donations/settings")
  revalidatePath("/donations/campaigns")

  return result
}
