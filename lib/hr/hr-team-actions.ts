"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

export type HrTeamStatus = "active" | "inactive"
export type TeamMembershipStatus = "active" | "inactive"

export type HrTeam = {
  id: string
  name: string
  description: string | null
  status: HrTeamStatus
  color: string | null
  sort_order: number
  member_count?: number
  active_member_count?: number
}

export type HrTeamPosition = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
  membership_count?: number
}

export type HrTeamMembership = {
  id: string
  team_id: string
  contact_id: string
  team_position_id: string
  status: TeamMembershipStatus
  start_date: string | null
  end_date: string | null
  team_name?: string
  team_color?: string | null
  position_name?: string
  contact_name?: string
  contact_email?: string | null
  contact_phone?: string | null
  contact_roles?: string[]
}

export type HrTeamDetail = HrTeam & {
  members: HrTeamMembership[]
  stats: {
    totalMembers: number
    leaders: number
    assistants: number
    coordinators: number
  }
}

export type HrTeamDashboardStats = {
  totalTeams: number
  activeTeams: number
  totalMembers: number
  teamLeaders: number
}

function revalidateTeamPaths() {
  revalidatePath("/hr/teams")
  revalidatePath("/hr/settings")
  revalidatePath("/hr/members")
  revalidatePath("/hr")
  revalidatePath("/contacts")
}

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === "42P01"
}

export async function fetchHrTeams(options?: {
  includeInactive?: boolean
  includeDeleted?: boolean
}): Promise<HrTeam[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  let query = supabase
    .from("hr_teams")
    .select("id, name, description, status, color, sort_order")
    .eq("organization_id", organizationId)
    .order("sort_order")
    .order("name")

  if (!options?.includeDeleted) {
    query = query.is("deleted_at", null)
  }

  if (!options?.includeInactive) {
    query = query.eq("status", "active")
  }

  const { data, error } = await query

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message || "Failed to load teams")
  }

  const { data: membershipRows } = await supabase
    .from("hr_team_memberships")
    .select("team_id, status")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  const totalCounts = new Map<string, number>()
  const activeCounts = new Map<string, number>()

  for (const row of membershipRows || []) {
    totalCounts.set(row.team_id, (totalCounts.get(row.team_id) || 0) + 1)
    if (row.status === "active") {
      activeCounts.set(row.team_id, (activeCounts.get(row.team_id) || 0) + 1)
    }
  }

  return (data || []).map((team) => ({
    ...team,
    status: team.status as HrTeamStatus,
    member_count: totalCounts.get(team.id) || 0,
    active_member_count: activeCounts.get(team.id) || 0,
  }))
}

export async function fetchHrTeamById(teamId: string): Promise<HrTeamDetail | null> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return null

  const { data: team, error } = await supabase
    .from("hr_teams")
    .select("id, name, description, status, color, sort_order")
    .eq("id", teamId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message || "Failed to load team")
  }

  if (!team) return null

  const members = await fetchTeamMemberships({ teamId, includeInactive: true })

  const countByPosition = (name: string) =>
    members.filter(
      (member) =>
        member.status === "active" &&
        member.position_name?.toLowerCase() === name.toLowerCase()
    ).length

  return {
    ...team,
    status: team.status as HrTeamStatus,
    members,
    stats: {
      totalMembers: members.filter((member) => member.status === "active").length,
      leaders: countByPosition("Team Leader"),
      assistants: countByPosition("Assistant"),
      coordinators: countByPosition("Coordinator"),
    },
  }
}

export async function createHrTeam(input: {
  name: string
  description?: string
  status?: HrTeamStatus
  color?: string
  sort_order?: number
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { error } = await supabase.from("hr_teams").insert({
    organization_id: organizationId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    status: input.status ?? "active",
    color: input.color?.trim() || null,
    sort_order: input.sort_order ?? 0,
  })

  if (error) throw new Error(error.message || "Failed to create team")
  revalidateTeamPaths()
}

export async function updateHrTeam(input: {
  id: string
  name: string
  description?: string
  status?: HrTeamStatus
  color?: string
  sort_order?: number
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { error } = await supabase
    .from("hr_teams")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      status: input.status ?? "active",
      color: input.color?.trim() || null,
      sort_order: input.sort_order ?? 0,
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  if (error) throw new Error(error.message || "Failed to update team")
  revalidateTeamPaths()
  revalidatePath(`/hr/teams/${input.id}`)
}

export async function archiveHrTeam(id: string) {
  return updateHrTeamStatus(id, "inactive")
}

export async function reactivateHrTeam(id: string) {
  return updateHrTeamStatus(id, "active")
}

async function updateHrTeamStatus(id: string, status: HrTeamStatus) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { error } = await supabase
    .from("hr_teams")
    .update({ status })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  if (error) throw new Error(error.message || "Failed to update team status")
  revalidateTeamPaths()
  revalidatePath(`/hr/teams/${id}`)
}

export async function deleteHrTeam(id: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { error } = await supabase
    .from("hr_teams")
    .update({ deleted_at: new Date().toISOString(), status: "inactive" })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  if (error) throw new Error(error.message || "Failed to delete team")
  revalidateTeamPaths()
}

export async function fetchHrTeamPositions(includeInactive = false): Promise<HrTeamPosition[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  let query = supabase
    .from("hr_team_positions")
    .select("id, name, description, is_active, sort_order")
    .eq("organization_id", organizationId)
    .order("sort_order")
    .order("name")

  if (!includeInactive) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message || "Failed to load team positions")
  }

  const { data: membershipRows } = await supabase
    .from("hr_team_memberships")
    .select("team_position_id")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  const counts = new Map<string, number>()
  for (const row of membershipRows || []) {
    counts.set(row.team_position_id, (counts.get(row.team_position_id) || 0) + 1)
  }

  return (data || []).map((row) => ({
    ...row,
    membership_count: counts.get(row.id) || 0,
  }))
}

export async function createHrTeamPosition(input: {
  name: string
  description?: string
  is_active?: boolean
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { error } = await supabase.from("hr_team_positions").insert({
    organization_id: organizationId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    is_active: input.is_active ?? true,
  })

  if (error) throw new Error(error.message || "Failed to create team position")
  revalidateTeamPaths()
}

export async function updateHrTeamPosition(input: {
  id: string
  name: string
  description?: string
  is_active?: boolean
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { error } = await supabase
    .from("hr_team_positions")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      is_active: input.is_active ?? true,
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) throw new Error(error.message || "Failed to update team position")
  revalidateTeamPaths()
}

export async function archiveHrTeamPosition(id: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { count, error: countError } = await supabase
    .from("hr_team_memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("team_position_id", id)
    .eq("status", "active")
    .is("deleted_at", null)

  if (countError) throw new Error(countError.message || "Could not check position usage")
  if ((count || 0) > 0) {
    throw new Error("This position is assigned to active team members. Reassign them first.")
  }

  const { error } = await supabase
    .from("hr_team_positions")
    .update({ is_active: false })
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) throw new Error(error.message || "Failed to archive team position")
  revalidateTeamPaths()
}

export async function fetchTeamMemberships(options?: {
  teamId?: string
  contactId?: string
  includeInactive?: boolean
  includeDeleted?: boolean
}): Promise<HrTeamMembership[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  let query = supabase
    .from("hr_team_memberships")
    .select(`
      id,
      team_id,
      contact_id,
      team_position_id,
      status,
      start_date,
      end_date,
      hr_teams:team_id (
        name,
        color,
        deleted_at
      ),
      hr_team_positions:team_position_id (
        name
      ),
      contacts:contact_id (
        full_name,
        email,
        phone,
        contact_roles(role)
      )
    `)
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: false, nullsFirst: false })

  if (options?.teamId) {
    query = query.eq("team_id", options.teamId)
  }

  if (options?.contactId) {
    query = query.eq("contact_id", options.contactId)
  }

  if (!options?.includeDeleted) {
    query = query.is("deleted_at", null)
  }

  if (!options?.includeInactive) {
    query = query.eq("status", "active")
  }

  const { data, error } = await query

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message || "Failed to load team memberships")
  }

  return (data || [])
    .filter((row: any) => !row.hr_teams?.deleted_at)
    .map((row: any) => ({
      id: row.id,
      team_id: row.team_id,
      contact_id: row.contact_id,
      team_position_id: row.team_position_id,
      status: row.status as TeamMembershipStatus,
      start_date: row.start_date,
      end_date: row.end_date,
      team_name: row.hr_teams?.name || "Unknown Team",
      team_color: row.hr_teams?.color || null,
      position_name: row.hr_team_positions?.name || "Unknown Position",
      contact_name: row.contacts?.full_name || "Unknown Contact",
      contact_email: row.contacts?.email || null,
      contact_phone: row.contacts?.phone || null,
      contact_roles: (row.contacts?.contact_roles || [])
        .map((role: any) => role.role)
        .filter(Boolean),
    }))
}

export async function addTeamMembership(input: {
  team_id: string
  contact_id: string
  team_position_id: string
  status?: TeamMembershipStatus
  start_date?: string
  end_date?: string
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { data: existing } = await supabase
    .from("hr_team_memberships")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("team_id", input.team_id)
    .eq("contact_id", input.contact_id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle()

  if (existing) {
    throw new Error("This contact already has an active membership on this team.")
  }

  const { error } = await supabase.from("hr_team_memberships").insert({
    organization_id: organizationId,
    team_id: input.team_id,
    contact_id: input.contact_id,
    team_position_id: input.team_position_id,
    status: input.status ?? "active",
    start_date: input.start_date || null,
    end_date: input.end_date || null,
  })

  if (error) throw new Error(error.message || "Failed to add team member")
  revalidateTeamPaths()
  revalidatePath(`/hr/teams/${input.team_id}`)
  revalidatePath(`/contacts/${input.contact_id}`)
}

export async function updateTeamMembership(input: {
  id: string
  team_position_id: string
  status: TeamMembershipStatus
  start_date?: string | null
  end_date?: string | null
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { data: membership, error: fetchError } = await supabase
    .from("hr_team_memberships")
    .select("team_id, contact_id")
    .eq("id", input.id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message || "Could not load membership")
  if (!membership) throw new Error("Membership not found")

  if (input.status === "active") {
    const { data: existing } = await supabase
      .from("hr_team_memberships")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("team_id", membership.team_id)
      .eq("contact_id", membership.contact_id)
      .eq("status", "active")
      .is("deleted_at", null)
      .neq("id", input.id)
      .maybeSingle()

    if (existing) {
      throw new Error("This contact already has another active membership on this team.")
    }
  }

  const { error } = await supabase
    .from("hr_team_memberships")
    .update({
      team_position_id: input.team_position_id,
      status: input.status,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) throw new Error(error.message || "Failed to update team membership")
  revalidateTeamPaths()
  revalidatePath(`/hr/teams/${membership.team_id}`)
  revalidatePath(`/contacts/${membership.contact_id}`)
}

export async function endTeamMembership(id: string, endDate?: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { data: membership, error: fetchError } = await supabase
    .from("hr_team_memberships")
    .select("team_id, contact_id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message || "Could not load membership")
  if (!membership) throw new Error("Membership not found")

  const { error } = await supabase
    .from("hr_team_memberships")
    .update({
      status: "inactive",
      end_date: endDate || new Date().toISOString().slice(0, 10),
    })
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) throw new Error(error.message || "Failed to end team membership")
  revalidateTeamPaths()
  revalidatePath(`/hr/teams/${membership.team_id}`)
  revalidatePath(`/contacts/${membership.contact_id}`)
}

export async function removeTeamMembership(id: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { data: membership, error: fetchError } = await supabase
    .from("hr_team_memberships")
    .select("team_id, contact_id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message || "Could not load membership")
  if (!membership) throw new Error("Membership not found")

  const { error } = await supabase
    .from("hr_team_memberships")
    .update({ deleted_at: new Date().toISOString(), status: "inactive" })
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) throw new Error(error.message || "Failed to remove team membership")
  revalidateTeamPaths()
  revalidatePath(`/hr/teams/${membership.team_id}`)
  revalidatePath(`/contacts/${membership.contact_id}`)
}

export async function fetchHrTeamDashboardStats(): Promise<HrTeamDashboardStats> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { totalTeams: 0, activeTeams: 0, totalMembers: 0, teamLeaders: 0 }
  }

  const { data: teams, error: teamsError } = await supabase
    .from("hr_teams")
    .select("id, status")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  if (teamsError) {
    if (isMissingTableError(teamsError)) {
      return { totalTeams: 0, activeTeams: 0, totalMembers: 0, teamLeaders: 0 }
    }
    throw new Error(teamsError.message || "Failed to load team stats")
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from("hr_team_memberships")
    .select(`
      contact_id,
      status,
      hr_team_positions:team_position_id (name)
    `)
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .is("deleted_at", null)

  if (membershipsError) {
    if (isMissingTableError(membershipsError)) {
      return {
        totalTeams: teams?.length || 0,
        activeTeams: (teams || []).filter((team) => team.status === "active").length,
        totalMembers: 0,
        teamLeaders: 0,
      }
    }
    throw new Error(membershipsError.message || "Failed to load membership stats")
  }

  const activeMemberships = memberships || []
  const uniqueContacts = new Set(activeMemberships.map((row: any) => row.contact_id))

  return {
    totalTeams: teams?.length || 0,
    activeTeams: (teams || []).filter((team) => team.status === "active").length,
    totalMembers: uniqueContacts.size,
    teamLeaders: activeMemberships.filter(
      (row: any) => row.hr_team_positions?.name?.toLowerCase() === "team leader"
    ).length,
  }
}

export async function fetchAllTeamMembershipsForFilter(): Promise<HrTeamMembership[]> {
  return fetchTeamMemberships({ includeInactive: true })
}
