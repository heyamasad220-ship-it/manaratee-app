"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { fetchHrTeamDashboardStats } from "@/lib/hr/hr-team-actions"

export type MembershipOverviewStats = {
  activeMembers: number
  pendingMembers: number
  lapsedMembers: number
  expiringSoon: number
  teams: {
    totalTeams: number
    activeTeams: number
    totalMembers: number
  }
}

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205"
}

export async function fetchMembershipOverviewStats(): Promise<MembershipOverviewStats> {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return {
      activeMembers: 0,
      pendingMembers: 0,
      lapsedMembers: 0,
      expiringSoon: 0,
      teams: { totalTeams: 0, activeTeams: 0, totalMembers: 0 },
    }
  }

  const supabase = await createClient()
  const teamStats = await fetchHrTeamDashboardStats()

  const statusCounts = {
    activeMembers: 0,
    pendingMembers: 0,
    lapsedMembers: 0,
    expiringSoon: 0,
  }

  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("status, end_date")
    .eq("organization_id", organizationId)

  if (!error && memberships) {
    const today = new Date()
    const soon = new Date(today)
    soon.setDate(soon.getDate() + 30)

    for (const row of memberships) {
      if (row.status === "active") statusCounts.activeMembers += 1
      if (row.status === "pending") statusCounts.pendingMembers += 1
      if (row.status === "lapsed") statusCounts.lapsedMembers += 1

      if (row.status === "active" && row.end_date) {
        const end = new Date(`${row.end_date}T00:00:00`)
        if (end >= today && end <= soon) {
          statusCounts.expiringSoon += 1
        }
      }
    }
  } else if (!isMissingTableError(error)) {
    console.error("fetchMembershipOverviewStats:", error)
  }

  return {
    ...statusCounts,
    teams: {
      totalTeams: teamStats.totalTeams,
      activeTeams: teamStats.activeTeams,
      totalMembers: teamStats.totalMembers,
    },
  }
}
