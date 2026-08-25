import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { primaryInstructorNameByOffering } from "@/lib/programs/primary-instructor"
import type {
  ProgramStaffAssignment,
  ProgramStaffAssignmentWithDetails,
} from "@/lib/programs/program-staff-assignment-types"
import { createClient } from "@/lib/supabase/server"

function mapAssignmentWithDetails(row: Record<string, unknown>): ProgramStaffAssignmentWithDetails {
  const contact = row.contact as Record<string, unknown> | null
  const program = row.program as Record<string, unknown> | null
  const offering = row.offering as Record<string, unknown> | null
  const session = row.session as Record<string, unknown> | null

  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    contact_id: row.contact_id as string,
    program_id: row.program_id as string,
    offering_id: row.offering_id as string,
    session_id: (row.session_id as string | null) ?? null,
    assignment_role: row.assignment_role as ProgramStaffAssignmentWithDetails["assignment_role"],
    start_date: (row.start_date as string | null) ?? null,
    end_date: (row.end_date as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    is_active: Boolean(row.is_active),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    contact_name: (contact?.full_name as string) || "Unnamed contact",
    contact_email: (contact?.email as string | null) ?? null,
    program_name: (program?.name as string) || "Program",
    offering_name: (offering?.name as string) || "Offering",
    session_name: (session?.name as string | null) ?? null,
  }
}

const ASSIGNMENT_SELECT = `
  id,
  organization_id,
  contact_id,
  program_id,
  offering_id,
  session_id,
  assignment_role,
  start_date,
  end_date,
  notes,
  is_active,
  created_at,
  updated_at,
  contact:contact_id ( full_name, email ),
  program:program_id ( name ),
  offering:offering_id ( name ),
  session:session_id ( name )
`

export async function getStaffAssignmentsForOffering(
  offeringId: string,
  organizationId?: string
): Promise<ProgramStaffAssignmentWithDetails[]> {
  const supabase = await createClient()
  const orgId = organizationId ?? (await getSelectedOrganizationId())

  if (!orgId) {
    return []
  }

  const { data, error } = await supabase
    .from("program_staff_assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("organization_id", orgId)
    .eq("offering_id", offeringId)
    .eq("is_active", true)
    .order("assignment_role", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    console.error("getStaffAssignmentsForOffering:", error.message)
    return []
  }

  return (data || []).map((row) =>
    mapAssignmentWithDetails(row as Record<string, unknown>)
  )
}

export async function getStaffAssignmentsForContact(
  contactId: string,
  organizationId?: string
): Promise<ProgramStaffAssignmentWithDetails[]> {
  const supabase = await createClient()
  const orgId = organizationId ?? (await getSelectedOrganizationId())

  if (!orgId) {
    return []
  }

  const { data, error } = await supabase
    .from("program_staff_assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("getStaffAssignmentsForContact:", error.message)
    throw new Error("Failed to load staff assignments")
  }

  return (data || []).map((row) =>
    mapAssignmentWithDetails(row as Record<string, unknown>)
  )
}

export async function getStaffAssignmentsForCurrentContact(
  organizationId: string,
  authUserId: string
): Promise<ProgramStaffAssignmentWithDetails[]> {
  const { supabase } = await getCustomerPortalSupabase()

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("auth_user_id", authUserId)
    .maybeSingle()

  if (contactError || !contact?.id) {
    return []
  }

  return getStaffAssignmentsForContact(contact.id as string, organizationId)
}

export type StaffEligibleContact = {
  id: string
  full_name: string
  email: string | null
  roles: string[]
}

export async function searchStaffEligibleContacts(
  organizationId: string,
  search?: string,
  limit = 20
): Promise<StaffEligibleContact[]> {
  const supabase = await createClient()

  let query = supabase
    .from("contacts")
    .select(
      `
      id,
      full_name,
      email,
      contact_roles!inner ( role )
    `
    )
    .eq("organization_id", organizationId)
    .in("contact_roles.role", ["employee", "volunteer"])
    .order("full_name", { ascending: true })
    .limit(limit)

  const trimmedSearch = search?.trim()
  if (trimmedSearch) {
    const escaped = trimmedSearch.replace(/[%_\\,]/g, "\\$&")
    query = query.or(
      `full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`
    )
  }

  const { data, error } = await query

  if (error) {
    console.error("searchStaffEligibleContacts:", error.message)
    throw new Error("Failed to search contacts")
  }

  const byId = new Map<string, StaffEligibleContact>()

  for (const row of data || []) {
    const id = row.id as string
    const roles = ((row.contact_roles as Array<{ role: string }>) || [])
      .map((item) => item.role)
      .filter((role) => role === "employee" || role === "volunteer")

    const existing = byId.get(id)
    if (existing) {
      existing.roles = Array.from(new Set([...existing.roles, ...roles]))
      continue
    }

    byId.set(id, {
      id,
      full_name: (row.full_name as string) || "Unnamed contact",
      email: (row.email as string | null) ?? null,
      roles,
    })
  }

  return Array.from(byId.values())
}

/**
 * Employees assigned to a department (staff.department_id), as contact options
 * for program instructor assignment. Skips staff rows without a linked contact.
 */
export async function searchDepartmentEmployeeContacts(
  organizationId: string,
  departmentId: string,
  search?: string,
  limit = 100
): Promise<StaffEligibleContact[]> {
  const supabase = await createClient()

  let query = supabase
    .from("staff")
    .select(
      `
      contact_id,
      first_name,
      last_name,
      email,
      status,
      contact:contact_id ( id, full_name, email )
    `
    )
    .eq("organization_id", organizationId)
    .eq("department_id", departmentId)
    .not("contact_id", "is", null)
    .neq("status", "inactive")
    .order("last_name", { ascending: true })
    .limit(limit)

  const trimmedSearch = search?.trim()
  if (trimmedSearch) {
    const escaped = trimmedSearch.replace(/[%_\\,]/g, "\\$&")
    query = query.or(
      `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%`
    )
  }

  const { data, error } = await query

  if (error) {
    console.error("searchDepartmentEmployeeContacts:", error.message)
    throw new Error("Failed to load department employees")
  }

  const byId = new Map<string, StaffEligibleContact>()

  for (const row of data || []) {
    const contactId = row.contact_id as string | null
    if (!contactId) continue

    const contact = row.contact as
      | { id?: string; full_name?: string | null; email?: string | null }
      | null
    const staffName =
      `${(row.first_name as string | null)?.trim() || ""} ${(row.last_name as string | null)?.trim() || ""}`.trim()
    const fullName =
      (contact?.full_name as string | null)?.trim() ||
      staffName ||
      "Unnamed employee"
    const email =
      (contact?.email as string | null) ??
      ((row.email as string | null) ?? null)

    if (byId.has(contactId)) continue

    byId.set(contactId, {
      id: contactId,
      full_name: fullName,
      email,
      roles: ["employee"],
    })
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.full_name.localeCompare(b.full_name)
  )
}

export async function getOfferingEnrollmentCount(
  offeringId: string,
  organizationId: string
): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from("program_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("offering_id", offeringId)
    .neq("status", "cancelled")

  if (error) {
    console.error("getOfferingEnrollmentCount:", error.message)
    return 0
  }

  return count ?? 0
}

export type MyClassAssignment = ProgramStaffAssignmentWithDetails & {
  enrollment_count: number
}

export async function getMyClassAssignments(
  organizationId: string,
  authUserId: string
): Promise<MyClassAssignment[]> {
  const assignments = await getStaffAssignmentsForCurrentContact(
    organizationId,
    authUserId
  )

  const offeringIds = Array.from(new Set(assignments.map((item) => item.offering_id)))
  const counts = await Promise.all(
    offeringIds.map(async (offeringId) => ({
      offeringId,
      count: await getOfferingEnrollmentCount(offeringId, organizationId),
    }))
  )
  const countByOffering = Object.fromEntries(
    counts.map((item) => [item.offeringId, item.count])
  )

  return assignments.map((assignment) => ({
    ...assignment,
    enrollment_count: countByOffering[assignment.offering_id] ?? 0,
  }))
}

export type OfferingRosterEnrollment = {
  id: string
  child_name: string
  child_age: number | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  status: string | null
  enrollment_date: string | null
}

export async function getOfferingRosterEnrollments(
  offeringId: string,
  organizationId: string
): Promise<OfferingRosterEnrollment[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_enrollments")
    .select(
      "id, child_name, child_age, parent_name, parent_email, parent_phone, status, enrollment_date"
    )
    .eq("organization_id", organizationId)
    .eq("offering_id", offeringId)
    .neq("status", "cancelled")
    .order("child_name", { ascending: true })

  if (error) {
    // Personal-portal teachers are often not organization_members; without
    // SQL 183 they cannot read other families' enrollments. Prefer empty
    // roster over crashing /my-classes/[offeringId].
    console.error("getOfferingRosterEnrollments:", error.message)
    return []
  }

  return (data || []) as OfferingRosterEnrollment[]
}

export async function getPrimaryInstructorByOfferingIds(
  offeringIds: string[],
  organizationId: string
): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (offeringIds.length === 0) return names

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("program_staff_assignments")
    .select(
      "offering_id, assignment_role, is_active, session_id, created_at, updated_at, contact:contact_id ( full_name )"
    )
    .eq("organization_id", organizationId)
    .in("offering_id", offeringIds)
    .eq("is_active", true)
    .in("assignment_role", ["primary_instructor", "assistant_instructor", "instructor"])

  if (error) {
    console.error("getPrimaryInstructorByOfferingIds:", error.message)
    return names
  }

  return primaryInstructorNameByOffering(
    (data || []).map((row) => ({
      offering_id: row.offering_id as string,
      assignment_role: String(row.assignment_role || ""),
      is_active: true,
      session_id: (row.session_id as string | null) ?? null,
      created_at: (row.created_at as string | null) ?? null,
      updated_at: (row.updated_at as string | null) ?? null,
      contact_name: (
        (row.contact as { full_name?: string | null } | null)?.full_name || ""
      ).trim(),
    }))
  )
}

export async function getEnrollmentCountsByOfferingIds(
  offeringIds: string[],
  organizationId: string
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  for (const offeringId of offeringIds) counts.set(offeringId, 0)
  if (offeringIds.length === 0) return counts

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("program_enrollments")
    .select("offering_id")
    .eq("organization_id", organizationId)
    .in("offering_id", offeringIds)
    .in("status", ["enrolled", "active"])

  if (error) {
    console.error("getEnrollmentCountsByOfferingIds:", error.message)
    return counts
  }

  for (const row of data || []) {
    const offeringId = row.offering_id as string | null
    if (!offeringId) continue
    counts.set(offeringId, (counts.get(offeringId) || 0) + 1)
  }

  return counts
}

export function asProgramStaffAssignment(
  row: ProgramStaffAssignmentWithDetails
): ProgramStaffAssignment {
  const {
    contact_name: _contactName,
    contact_email: _contactEmail,
    program_name: _programName,
    offering_name: _offeringName,
    session_name: _sessionName,
    ...assignment
  } = row

  return assignment
}
