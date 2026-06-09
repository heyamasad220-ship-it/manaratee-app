"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import type { MembershipStatus } from "@/lib/memberships/membership-constants"

export type MembershipType = {
  id: string
  name: string
  description: string | null
  default_duration_months: number | null
  is_active: boolean
  sort_order: number
}

export type MembershipRecord = {
  id: string
  organization_id: string
  contact_id: string
  membership_type_id: string | null
  status: MembershipStatus
  start_date: string
  end_date: string | null
  renewal_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  membership_type?: { name: string } | null
}

export type MembershipListRow = {
  membershipId: string
  contactId: string
  contactName: string
  email: string
  phone: string
  membershipTypeName: string
  status: MembershipStatus
  startDate: string
  endDate: string | null
  renewalDate: string | null
  teams: { id: string; name: string }[]
}

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205"
}

export async function fetchMembershipTypes(options?: {
  includeInactive?: boolean
}): Promise<MembershipType[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) return []

  let query = supabase
    .from("membership_types")
    .select("id, name, description, default_duration_months, is_active, sort_order")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (!options?.includeInactive) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message || "Could not load membership types")
  }

  return (data || []) as MembershipType[]
}

export async function fetchContactMemberships(contactId: string): Promise<MembershipRecord[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) return []

  const { data, error } = await supabase
    .from("memberships")
    .select(`
      id,
      organization_id,
      contact_id,
      membership_type_id,
      status,
      start_date,
      end_date,
      renewal_date,
      notes,
      created_at,
      updated_at,
      membership_type:membership_type_id (name)
    `)
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .order("start_date", { ascending: false })

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message || "Could not load memberships")
  }

  return (data || []) as unknown as MembershipRecord[]
}

export async function fetchActiveMembershipForContact(
  contactId: string
): Promise<MembershipRecord | null> {
  const memberships = await fetchContactMemberships(contactId)
  return memberships.find((row) => row.status === "active") ?? null
}

export async function contactHasActiveMembership(
  organizationId: string,
  contactId: string
): Promise<boolean> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("memberships")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("status", "active")
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) {
      const { data: roleRow } = await supabase
        .from("contact_roles")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .eq("role", "member")
        .maybeSingle()
      return Boolean(roleRow)
    }
    return false
  }

  return Boolean(data)
}

export async function userHasActiveMembership(
  organizationId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient()

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("auth_user_id", userId)
    .maybeSingle()

  if (contactError || !contact?.id) return false

  return contactHasActiveMembership(organizationId, contact.id as string)
}

export type FetchMembershipsListInput = {
  search?: string
  status?: MembershipStatus | "all"
  membershipTypeId?: string | "all"
  teamId?: string | "all"
  page?: number
  pageSize?: number
}

export async function fetchMembershipsList(input: FetchMembershipsListInput = {}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return { rows: [] as MembershipListRow[], total: 0, page: 1, pageSize: 50 }
  }

  const page = Math.max(1, input.page ?? 1)
  const pageSize = input.pageSize ?? 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from("memberships")
    .select(
      `
      id,
      status,
      start_date,
      end_date,
      renewal_date,
      contact_id,
      contacts:contact_id (
        id,
        full_name,
        email,
        phone,
        hr_team_memberships (
          status,
          team_id,
          hr_teams:team_id (name)
        )
      ),
      membership_type:membership_type_id (name)
    `,
      { count: "exact" }
    )
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: false })

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status)
  }

  if (input.membershipTypeId && input.membershipTypeId !== "all") {
    query = query.eq("membership_type_id", input.membershipTypeId)
  }

  const trimmedSearch = input.search?.trim()
  if (trimmedSearch) {
    const pattern = `%${trimmedSearch.replace(/[%_\\,]/g, "\\$&")}%`
    const { data: matchingContacts } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .or(`full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)

    const contactIds = (matchingContacts || []).map((row) => row.id as string)
    if (contactIds.length === 0) {
      return { rows: [], total: 0, page, pageSize }
    }

    query = query.in("contact_id", contactIds)
  }

  const { data, error, count } = await query.range(from, to)

  if (error) {
    if (isMissingTableError(error)) {
      return { rows: [], total: 0, page, pageSize }
    }
    throw new Error(error.message || "Could not load memberships")
  }

  let rows = (data || []).map((row: any) => {
    const contact = row.contacts || {}
    const teamMap = new Map<string, { id: string; name: string }>()

    for (const membership of contact.hr_team_memberships || []) {
      if (membership.status !== "active") continue
      const teamId = membership.team_id as string | undefined
      const teamName = membership.hr_teams?.name as string | undefined
      if (teamId && teamName) {
        teamMap.set(teamId, { id: teamId, name: teamName })
      }
    }

    const typeRel = row.membership_type
    const typeName = Array.isArray(typeRel)
      ? typeRel[0]?.name
      : typeRel?.name

    return {
      membershipId: row.id as string,
      contactId: contact.id as string,
      contactName: (contact.full_name as string) || "Unnamed",
      email: (contact.email as string) || "",
      phone: (contact.phone as string) || "",
      membershipTypeName: typeName || "—",
      status: row.status as MembershipStatus,
      startDate: row.start_date as string,
      endDate: (row.end_date as string | null) ?? null,
      renewalDate: (row.renewal_date as string | null) ?? null,
      teams: Array.from(teamMap.values()),
    } satisfies MembershipListRow
  })

  if (input.teamId && input.teamId !== "all") {
    rows = rows.filter((row) => row.teams.some((team) => team.id === input.teamId))
  }

  return {
    rows,
    total: count ?? rows.length,
    page,
    pageSize,
  }
}
