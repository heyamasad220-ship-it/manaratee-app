"use server"

import { revalidatePath } from "next/cache"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"

export async function getGivingGroupsEnabledAction(): Promise<boolean> {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return false

  const { data, error } = await access.supabase
    .from("donation_settings")
    .select("enable_giving_groups")
    .eq("organization_id", access.orgId)
    .maybeSingle()

  if (error || !data) return false
  return Boolean(data.enable_giving_groups)
}

export async function setGivingGroupsEnabledAction(
  enabled: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false, error: access.error }

  const { data: existing, error: existingError } = await access.supabase
    .from("donation_settings")
    .select("organization_id")
    .eq("organization_id", access.orgId)
    .maybeSingle()

  if (existingError) return { success: false, error: existingError.message }

  const write = existing
    ? access.supabase
        .from("donation_settings")
        .update({ enable_giving_groups: enabled })
        .eq("organization_id", access.orgId)
    : access.supabase.from("donation_settings").insert({
        organization_id: access.orgId,
        enable_giving_groups: enabled,
      })

  const { error } = await write
  if (error) return { success: false, error: error.message }

  revalidatePath("/donations/settings")
  return { success: true }
}
