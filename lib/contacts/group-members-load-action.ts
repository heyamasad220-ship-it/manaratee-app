"use server"

import {
  fetchGroupMembers,
  formatGroupMemberActionError,
  loadGroupMemberGivingStats,
} from "@/lib/contacts/group-membership-data"
import { requireContactsViewAccess } from "@/lib/contacts/group-member-access"
import type { GroupMemberGivingStat } from "@/lib/contacts/group-membership-data"
import { isRedirectError } from "next/dist/client/components/redirect-error"

export async function fetchGroupMembersAction(
  groupContactId: string,
  options?: { includeGivingStats?: boolean }
) {
  try {
    const access = await requireContactsViewAccess()
    if (!access.ok) {
      return { success: false as const, error: access.error }
    }

    return await fetchGroupMembers(access.supabase, access.organizationId, groupContactId, {
      includeGivingStats: options?.includeGivingStats ?? false,
      skipGroupValidation: true,
    })
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }
    return {
      success: false as const,
      error: formatGroupMemberActionError(error, "Could not load group members."),
    }
  }
}

export async function fetchGroupMemberGivingStatsAction(groupContactId: string) {
  try {
    const access = await requireContactsViewAccess()
    if (!access.ok) {
      return { success: false as const, error: access.error }
    }

    const stats = await loadGroupMemberGivingStats(
      access.supabase,
      access.organizationId,
      groupContactId
    )

    const givingByMemberId: Record<string, GroupMemberGivingStat> = {}
    for (const [memberContactId, stat] of stats.entries()) {
      givingByMemberId[memberContactId] = stat
    }

    return { success: true as const, givingByMemberId }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }
    return {
      success: false as const,
      error: formatGroupMemberActionError(error, "Could not load member giving totals."),
    }
  }
}
