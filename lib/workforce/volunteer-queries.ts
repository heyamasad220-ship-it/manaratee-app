"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import type { VolunteerStatus } from "@/lib/volunteers/volunteer-types"

export type VolunteerListRow = {
  volunteerId: string
  contactId: string | null
  name: string
  email: string
  phone: string
  status: VolunteerStatus
  joinDate: string
  skills: string[]
}

export type FetchVolunteersListInput = {
  search?: string
  status?: VolunteerStatus | "all"
  page?: number
  pageSize?: number
}

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205"
}

export async function fetchVolunteersList(input: FetchVolunteersListInput = {}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return { rows: [] as VolunteerListRow[], total: 0, page: 1, pageSize: 50 }
  }

  const page = Math.max(1, input.page ?? 1)
  const pageSize = input.pageSize ?? 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from("volunteers")
    .select(
      "id, contact_id, first_name, last_name, email, phone, status, join_date, skills",
      { count: "exact" }
    )
    .eq("organization_id", organizationId)
    .order("join_date", { ascending: false })

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status)
  }

  const trimmedSearch = input.search?.trim()
  if (trimmedSearch) {
    const pattern = `%${trimmedSearch.replace(/[%_\\,]/g, "\\$&")}%`
    query = query.or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`
    )
  }

  const { data, error, count } = await query.range(from, to)

  if (error) {
    if (isMissingTableError(error)) {
      return { rows: [], total: 0, page, pageSize }
    }
    throw new Error(error.message || "Could not load volunteers")
  }

  const rows: VolunteerListRow[] = (data || []).map((row) => ({
    volunteerId: row.id as string,
    contactId: (row.contact_id as string | null) ?? null,
    name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Unnamed",
    email: (row.email as string) || "",
    phone: (row.phone as string) || "",
    status: row.status as VolunteerStatus,
    joinDate: row.join_date as string,
    skills: (row.skills as string[]) || [],
  }))

  return {
    rows,
    total: count ?? rows.length,
    page,
    pageSize,
  }
}
