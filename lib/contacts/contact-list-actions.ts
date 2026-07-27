"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  type ContactRecordType,
  type ContactRoleLabel,
  type ContactRoleValue,
  type ContactStatus,
  filterContactRoles,
  getAllowedRolesForRecordType,
  mapRoleValue,
  mapStatus,
  normalizeContactRecordType,
} from "@/lib/contacts/contact-constants"

export type ContactListTeamSummary = {
  id: string
  name: string
}

export type ContactListRow = {
  id: string
  name: string
  email: string
  phone: string
  primaryContactName: string
  recordType: ContactRecordType
  roles: ContactRoleLabel[]
  roleValues: ContactRoleValue[]
  status: ContactStatus
  createdAt: string
  updatedAt: string | null
  lastActivity: string | null
  teams: ContactListTeamSummary[]
}

export type ContactListStats = {
  total: number
  people: number
  organizations: number
  groups: number
}

export type ContactListSortBy = "full_name" | "updated_at" | "created_at"

export type FetchContactsListInput = {
  search?: string
  nameFilter?: string
  role?: ContactRoleValue | "all"
  recordType?: ContactRecordType | "all"
  status?: ContactStatus | "all"
  teamId?: string | "all"
  sortBy?: ContactListSortBy
  sortAsc?: boolean
  page?: number
  pageSize?: number
  /** Page-scoped record type (e.g. People) — not treated as an active user filter. */
  lockedRecordType?: ContactRecordType
}

export type FetchContactsListResult = {
  contacts: ContactListRow[]
  total: number
  page: number
  pageSize: number
  isRecentView: boolean
}

const DEFAULT_PAGE_SIZE = 50

function escapeIlike(value: string) {
  return value.replace(/[%_\\,]/g, "\\$&")
}

function mapContactRow(row: any): ContactListRow {
  const recordType = normalizeContactRecordType(row.contact_type)

  const roleValues = row.contact_roles
    ? filterContactRoles(
        Array.from(
          new Set((row.contact_roles || []).map((r: any) => r.role as string).filter(Boolean))
        )
      ).filter((role) => getAllowedRolesForRecordType(recordType).includes(role))
    : []
  const roles = roleValues
    .map((value) => mapRoleValue(value))
    .filter(Boolean) as ContactRoleLabel[]

  const teamMap = new Map<string, ContactListTeamSummary>()
  for (const membership of row.hr_team_memberships || []) {
    if (membership.status !== "active") continue
    const teamId = membership.team_id as string | undefined
    const teamName = membership.hr_teams?.name as string | undefined
    if (teamId && teamName && !teamMap.has(teamId)) {
      teamMap.set(teamId, { id: teamId, name: teamName })
    }
  }

  const lastActivity =
    row.last_activity_at || row.updated_at || row.created_at || null

  return {
    id: row.id,
    name: row.full_name || row.email || row.phone || "Unnamed Contact",
    email: row.email || "",
    phone: row.phone || "",
    primaryContactName: row.primary_contact_name || "",
    recordType,
    roleValues,
    roles,
    status: mapStatus(row.status),
    createdAt: row.created_at,
    updatedAt: (row.updated_at as string | null) ?? row.created_at ?? null,
    lastActivity,
    teams: Array.from(teamMap.values()),
  }
}

function buildSelect(
  roleFilter: boolean,
  teamFilter: boolean,
  options?: {
    includeTeams?: boolean
    includeActivityColumns?: boolean
    includePrimaryContactName?: boolean
    includeRoles?: boolean
  }
) {
  const includeTeams = options?.includeTeams !== false
  const includeActivityColumns = options?.includeActivityColumns === true
  const includePrimaryContactName = options?.includePrimaryContactName !== false
  const includeRoles = options?.includeRoles === true

  const roles = includeRoles
    ? roleFilter
      ? "contact_roles!inner(role)"
      : "contact_roles(role)"
    : null
  const activityColumns = includeActivityColumns ? "last_activity_at," : ""
  const teams = includeTeams
    ? teamFilter
      ? "hr_team_memberships!inner(status, team_id, hr_teams:team_id(name))"
      : "hr_team_memberships(status, team_id, hr_teams:team_id(name))"
    : null

  const nested = teams ? `, ${teams}` : ""
  const roleSelect = roles ? `${roles},` : ""

  return `
    id,
    full_name,
    email,
    phone,
    ${includePrimaryContactName ? "primary_contact_name," : ""}
    contact_type,
    status,
    created_at,
    updated_at,
    ${activityColumns}
    ${roleSelect}
    ${nested}
  `
    .replace(/\n\s+/g, " ")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*$/, "")
    .trim()
}

function hasListFilters(input: FetchContactsListInput) {
  const recordTypeFiltered =
    input.recordType &&
    input.recordType !== "all" &&
    input.recordType !== input.lockedRecordType

  return Boolean(
    input.search?.trim() ||
      input.nameFilter?.trim() ||
      (input.role && input.role !== "all") ||
      recordTypeFiltered ||
      (input.status && input.status !== "all") ||
      (input.teamId && input.teamId !== "all") ||
      input.sortBy
  )
}

function applyContactListSort(query: any, input: FetchContactsListInput, options: QueryOptions) {
  if (input.sortBy === "full_name") {
    return query.order("full_name", { ascending: input.sortAsc ?? true })
  }

  if (input.sortBy === "updated_at") {
    return query.order("updated_at", {
      ascending: input.sortAsc ?? false,
      nullsFirst: false,
    })
  }

  if (input.sortBy === "created_at") {
    return query.order("created_at", { ascending: input.sortAsc ?? false })
  }

  if (options.includeActivityColumns) {
    return query
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
  }

  return query.order("created_at", { ascending: false })
}

function statusToFilterValue(status: ContactStatus | "all") {
  if (status === "all") return null
  return status.toLowerCase()
}

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  if (!error) return false
  if (error.code === "42703" || error.code === "PGRST204") return true
  const message = error.message?.toLowerCase() || ""
  return (
    message.includes("last_activity_at") ||
    message.includes("updated_at") ||
    message.includes("primary_contact_name") ||
    message.includes("does not exist")
  )
}

function isMissingTeamsRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false
  if (error.code === "42P01" || error.code === "PGRST200") return true
  return Boolean(error.message?.includes("hr_team_memberships"))
}

type QueryOptions = {
  includeTeams: boolean
  includeActivityColumns: boolean
  includePrimaryContactName: boolean
}

function resolveContactTypeFilter(input: FetchContactsListInput): ContactRecordType | null {
  if (input.recordType && input.recordType !== "all") {
    return input.recordType
  }
  if (input.lockedRecordType) {
    return input.lockedRecordType
  }
  return null
}

async function runDonorGivingContactsQuery(
  input: FetchContactsListInput,
  organizationId: string,
  from: number,
  to: number,
  options: QueryOptions
) {
  const supabase = await createClient()
  const pageSize = to - from + 1
  const statusValue = input.status ? statusToFilterValue(input.status) : null
  const contactType = resolveContactTypeFilter(input)

  const { data: idRows, error: idError } = await supabase.rpc("search_donor_giving_contact_ids", {
    p_org_id: organizationId,
    p_search: input.search?.trim() || null,
    p_contact_type: contactType,
    p_status: statusValue,
    p_limit: pageSize,
    p_offset: from,
  })

  if (idError) {
    console.warn(
      "search_donor_giving_contact_ids unavailable, falling back to donor affiliation filter:",
      idError.message
    )
    return runContactsQueryWithRoleFilter(input, organizationId, from, to, options, "donor")
  }

  const contactIds = (idRows || []).map((row: { contact_id: string }) => row.contact_id)
  const total = Number((idRows as { total_count?: number }[] | null)?.[0]?.total_count || 0)

  if (contactIds.length === 0) {
    return { data: [], error: null, count: total }
  }

  let query = supabase
    .from("contacts")
    .select(
      buildSelect(false, false, {
        includeTeams: options.includeTeams,
        includeActivityColumns: options.includeActivityColumns,
        includePrimaryContactName: options.includePrimaryContactName,
        includeRoles: true,
      })
    )
    .eq("organization_id", organizationId)
    .in("id", contactIds)

  if (options.includeActivityColumns) {
    query = query
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
  } else {
    query = query.order("created_at", { ascending: false })
  }

  const { data, error } = await query

  const byId = new Map((data || []).map((row: { id: string }) => [row.id, row]))
  const ordered = contactIds
    .map((id) => byId.get(id))
    .filter(Boolean)

  return { data: ordered, error, count: total }
}

async function runContactsQueryWithRoleFilter(
  input: FetchContactsListInput,
  organizationId: string,
  from: number,
  to: number,
  options: QueryOptions,
  role: ContactRoleValue
) {
  const supabase = await createClient()
  const teamFilter = input.teamId && input.teamId !== "all"

  let query = supabase
    .from("contacts")
    .select(
      buildSelect(true, Boolean(teamFilter), {
        includeTeams: options.includeTeams,
        includeActivityColumns: options.includeActivityColumns,
        includePrimaryContactName: options.includePrimaryContactName,
        includeRoles: true,
      }),
      { count: "exact" }
    )
    .eq("organization_id", organizationId)
    .eq("contact_roles.role", role)

  if (teamFilter && options.includeTeams) {
    query = query
      .eq("hr_team_memberships.team_id", input.teamId)
      .eq("hr_team_memberships.status", "active")
  }

  const contactType = resolveContactTypeFilter(input)
  if (contactType) {
    query = query.eq("contact_type", contactType)
  }

  const statusValue = input.status ? statusToFilterValue(input.status) : null
  if (statusValue) {
    query = query.eq("status", statusValue)
  }

  const trimmedSearch = input.search?.trim()
  if (trimmedSearch) {
    const pattern = `%${escapeIlike(trimmedSearch)}%`
    const searchFields = [
      `full_name.ilike.${pattern}`,
      `email.ilike.${pattern}`,
      `phone.ilike.${pattern}`,
    ]
    if (options.includePrimaryContactName) {
      searchFields.push(`primary_contact_name.ilike.${pattern}`)
    }
    query = query.or(searchFields.join(","))
  }

  const trimmedNameFilter = input.nameFilter?.trim()
  if (trimmedNameFilter) {
    query = query.ilike("full_name", `%${escapeIlike(trimmedNameFilter)}%`)
  }

  query = applyContactListSort(query, input, options)

  return query.range(from, to)
}

async function runContactsQuery(
  input: FetchContactsListInput,
  organizationId: string,
  from: number,
  to: number,
  options: QueryOptions
) {
  if (input.role === "donor") {
    return runDonorGivingContactsQuery(input, organizationId, from, to, options)
  }

  const supabase = await createClient()
  const roleFilter = input.role && input.role !== "all"
  const teamFilter = input.teamId && input.teamId !== "all"

  let query = supabase
    .from("contacts")
    .select(
      buildSelect(Boolean(roleFilter), Boolean(teamFilter), {
        includeTeams: options.includeTeams,
        includeActivityColumns: options.includeActivityColumns,
        includePrimaryContactName: options.includePrimaryContactName,
        includeRoles: true,
      }),
      { count: "exact" }
    )
    .eq("organization_id", organizationId)

  if (roleFilter) {
    query = query.eq("contact_roles.role", input.role)
  }

  if (teamFilter && options.includeTeams) {
    query = query
      .eq("hr_team_memberships.team_id", input.teamId)
      .eq("hr_team_memberships.status", "active")
  }

  const contactTypeFilter = resolveContactTypeFilter(input)
  if (contactTypeFilter) {
    query = query.eq("contact_type", contactTypeFilter)
  }

  const statusValue = input.status ? statusToFilterValue(input.status) : null
  if (statusValue) {
    query = query.eq("status", statusValue)
  }

  const trimmedSearch = input.search?.trim()
  if (trimmedSearch) {
    const pattern = `%${escapeIlike(trimmedSearch)}%`
    const searchFields = [
      `full_name.ilike.${pattern}`,
      `email.ilike.${pattern}`,
      `phone.ilike.${pattern}`,
    ]
    if (options.includePrimaryContactName) {
      searchFields.push(`primary_contact_name.ilike.${pattern}`)
    }
    query = query.or(searchFields.join(","))
  }

  const trimmedNameFilter = input.nameFilter?.trim()
  if (trimmedNameFilter) {
    query = query.ilike("full_name", `%${escapeIlike(trimmedNameFilter)}%`)
  }

  query = applyContactListSort(query, input, options)

  return query.range(from, to)
}

export async function fetchContactListStats(options?: {
  recordType?: ContactRecordType
}): Promise<ContactListStats> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return { total: 0, people: 0, organizations: 0, groups: 0 }
  }

  const [totalRes, peopleRes, organizationsRes, groupsRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("contact_type", "individual"),
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("contact_type", "organization"),
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("contact_type", "group"),
  ])

  const stats = {
    total: totalRes.count ?? 0,
    people: peopleRes.count ?? 0,
    organizations: organizationsRes.count ?? 0,
    groups: groupsRes.count ?? 0,
  }

  if (options?.recordType === "individual") {
    return { ...stats, total: stats.people }
  }

  if (options?.recordType === "organization") {
    return { ...stats, total: stats.organizations }
  }

  if (options?.recordType === "group") {
    return { ...stats, total: stats.groups }
  }

  return stats
}

export async function fetchContactsList(
  input: FetchContactsListInput
): Promise<FetchContactsListResult> {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return {
      contacts: [],
      total: 0,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      isRecentView: true,
    }
  }

  const page = Math.max(1, input.page ?? 1)
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const isRecentView = !hasListFilters(input)

  const queryPlans: QueryOptions[] = [
    { includeTeams: true, includeActivityColumns: true, includePrimaryContactName: true },
    { includeTeams: true, includeActivityColumns: false, includePrimaryContactName: true },
    { includeTeams: false, includeActivityColumns: false, includePrimaryContactName: true },
    { includeTeams: false, includeActivityColumns: false, includePrimaryContactName: false },
  ]

  let lastError: { message?: string } | null = null

  for (const plan of queryPlans) {
    const { data, error, count } = await runContactsQuery(
      input,
      organizationId,
      from,
      to,
      plan
    )

    if (!error) {
      const rows = data || []
      const uniqueRows = Array.from(
        new Map(rows.map((row: any) => [row.id as string, row])).values()
      )

      return {
        contacts: uniqueRows.map((row) =>
          mapContactRow({ ...row, hr_team_memberships: row.hr_team_memberships || [] })
        ),
        total: count ?? 0,
        page,
        pageSize,
        isRecentView,
      }
    }

    lastError = error

    const canRetry =
      (plan.includeActivityColumns && isMissingColumnError(error)) ||
      (plan.includePrimaryContactName && isMissingColumnError(error)) ||
      (plan.includeTeams && isMissingTeamsRelationError(error))

    if (!canRetry) {
      break
    }
  }

  console.error("fetchContactsList error:", lastError)
  throw new Error(lastError?.message || "Could not load contacts")
}
