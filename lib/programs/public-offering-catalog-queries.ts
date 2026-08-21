import { DEPARTMENT_OPEN_PROGRAM_STATUSES } from "@/lib/departments/department-program-statuses"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import {
  resolveEffectiveOfferingDates,
  resolveEffectiveOfferingEligibility,
} from "@/lib/programs/program-offering-inherit"
import { getJoinOrganizationBySlug } from "@/lib/organizations/join-organization-actions"
// Types only — offering-catalog-queries is a "use server" module.
import type {
  OfferingCatalogCard,
  OfferingCatalogFilters,
} from "@/lib/programs/offering-catalog-queries"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import { YEAR_SEASON_LABEL } from "@/lib/programs/program-display-labels"

export type PublicProgramCatalogOrg = {
  id: string
  name: string
  slug: string
}

export type PublicProgramCatalogDepartment = {
  id: string
  name: string
}

function matchesAudienceFilter(
  minAge: number | null,
  maxAge: number | null,
  audience: string
) {
  if (!audience || audience === "all") return true
  if (minAge == null && maxAge == null) return true
  if (audience === "youth") {
    if (maxAge != null) return maxAge < 18
    return minAge != null && minAge < 18
  }
  if (audience === "adult") {
    if (minAge != null) return minAge >= 18
    return maxAge != null && maxAge >= 18
  }
  return true
}

function matchesAgeFilter(
  minAge: number | null,
  maxAge: number | null,
  ageRaw: string | undefined
) {
  const trimmed = (ageRaw || "").trim()
  if (!trimmed) return true
  const age = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(age) || age < 0) return true
  if (minAge != null && age < minAge) return false
  if (maxAge != null && age > maxAge) return false
  return true
}

function matchesGenderFilter(
  gender: string | null,
  filterGender: string | undefined
) {
  const selected = filterGender || "all"
  if (selected === "all") return true
  const normalized = !gender || gender === "All" ? "All" : gender
  return normalized === selected || normalized === "All"
}

function matchesPublicFilters(
  row: OfferingCatalogCard,
  filters: OfferingCatalogFilters
) {
  const q = (filters.q || "").trim().toLowerCase()
  if (q) {
    const haystack =
      `${row.name} ${row.yearSeasonName} ${row.department_name || ""}`.toLowerCase()
    if (!haystack.includes(q)) return false
  }

  const department = filters.department || "all"
  if (department !== "all" && row.department_id !== department) {
    return false
  }

  if (!matchesGenderFilter(row.display_gender, filters.gender)) {
    return false
  }

  if (
    !matchesAudienceFilter(
      row.display_min_age,
      row.display_max_age,
      filters.audience || "all"
    )
  ) {
    return false
  }

  if (
    (filters.audience || "all") === "youth" &&
    !matchesAgeFilter(row.display_min_age, row.display_max_age, filters.age)
  ) {
    return false
  }

  return true
}

async function countOfferingEnrollments(
  organizationId: string,
  offeringIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (offeringIds.length === 0) return counts

  const admin = getServiceRoleClient()
  const { data, error } = await admin
    .from("program_enrollments")
    .select("offering_id")
    .eq("organization_id", organizationId)
    .in("offering_id", offeringIds)
    .neq("status", "cancelled")

  if (error) {
    console.error("public catalog enrollment counts:", error.message)
    return counts
  }

  for (const row of data || []) {
    const offeringId = row.offering_id as string
    counts.set(offeringId, (counts.get(offeringId) || 0) + 1)
  }
  return counts
}

/**
 * Public (no-login) Program Catalog for an organization slug.
 * Only programs with visibility = public.
 */
export async function getPublicProgramCatalogBySlug(
  orgSlug: string,
  filters: OfferingCatalogFilters = {}
): Promise<{
  organization: PublicProgramCatalogOrg | null
  offerings: OfferingCatalogCard[]
  departments: PublicProgramCatalogDepartment[]
}> {
  const organization = await getJoinOrganizationBySlug(orgSlug)
  if (!organization) {
    return { organization: null, offerings: [], departments: [] }
  }

  const admin = getServiceRoleClient()
  const organizationId = organization.id

  const { data: programs, error: programsError } = await admin
    .from("programs")
    .select(
      `
      id,
      name,
      department_id,
      flyer_url,
      visibility,
      start_date,
      end_date,
      enrollment_open_date,
      enrollment_close_date,
      gender,
      min_age,
      max_age,
      program_type,
      grade_levels,
      min_grade,
      max_grade,
      require_guardian,
      require_grade,
      require_emergency_contact,
      enable_waitlist,
      waitlist_capacity,
      waitlist_offer_deadline_days
    `
    )
    .eq("organization_id", organizationId)
    .in("status", [...DEPARTMENT_OPEN_PROGRAM_STATUSES])
    .eq("visibility", "public")

  if (programsError) {
    console.error("getPublicProgramCatalogBySlug programs:", programsError.message)
    return { organization, offerings: [], departments: [] }
  }

  const programRows = programs || []
  if (programRows.length === 0) {
    return { organization, offerings: [], departments: [] }
  }

  const departmentIds = Array.from(
    new Set(
      programRows
        .map((row) => (row.department_id as string | null) || null)
        .filter((id): id is string => Boolean(id))
    )
  )

  const departments: PublicProgramCatalogDepartment[] = []
  const departmentNameById = new Map<string, string>()
  if (departmentIds.length > 0) {
    const { data: departmentRows } = await admin
      .from("departments")
      .select("id, name")
      .eq("organization_id", organizationId)
      .in("id", departmentIds)
      .order("name", { ascending: true })

    for (const row of departmentRows || []) {
      const id = row.id as string
      const name = (row.name as string) || "Department"
      departmentNameById.set(id, name)
      departments.push({ id, name })
    }
  }

  const programIds = programRows.map((row) => row.id as string)
  const programById = new Map(
    programRows.map((row) => {
      const departmentId = (row.department_id as string | null) ?? null
      return [
        row.id as string,
        {
          ...row,
          department: departmentId
            ? {
                id: departmentId,
                name: departmentNameById.get(departmentId) || null,
              }
            : null,
        },
      ]
    })
  )

  const { data: offerings, error: offeringsError } = await admin
    .from("program_offerings")
    .select(
      `
      id,
      name,
      status,
      flyer_url,
      background_color,
      capacity_mode,
      capacity,
      start_date,
      end_date,
      enrollment_open_date,
      enrollment_close_date,
      inherit_dates,
      inherit_eligibility,
      gender,
      min_age,
      max_age,
      audience_type,
      grade_levels,
      min_grade,
      max_grade,
      require_guardian,
      require_grade,
      require_emergency_contact,
      program_id
    `
    )
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .in("program_id", programIds)
    .order("name", { ascending: true })

  if (offeringsError || !offerings?.length) {
    if (offeringsError) {
      console.error(
        "getPublicProgramCatalogBySlug offerings:",
        offeringsError.message
      )
    }
    return { organization, offerings: [], departments }
  }

  const enrollmentById = await countOfferingEnrollments(
    organizationId,
    offerings.map((row) => row.id as string)
  )

  const cards: OfferingCatalogCard[] = []
  for (const row of offerings) {
    const programId = row.program_id as string
    const program = programById.get(programId)
    if (!program) continue

    const department = program.department as
      | { id?: string; name?: string }
      | null
    const offeringLike = row as unknown as ProgramOffering
    const dates = resolveEffectiveOfferingDates(offeringLike, program as never)
    const eligibility = resolveEffectiveOfferingEligibility(
      offeringLike,
      program as never
    )

    cards.push({
      id: row.id as string,
      name: (row.name as string) || "Program",
      status: (row.status as ProgramOffering["status"]) || "active",
      flyer_url:
        ((row.flyer_url as string | null) ?? null) ||
        ((program.flyer_url as string | null) ?? null),
      background_color: (row.background_color as string | null) ?? null,
      capacity_mode: (row.capacity_mode as string | null) ?? null,
      capacity: row.capacity == null ? null : Number(row.capacity),
      start_date: (row.start_date as string | null) ?? null,
      end_date: (row.end_date as string | null) ?? null,
      enrollment_open_date: (row.enrollment_open_date as string | null) ?? null,
      enrollment_close_date:
        (row.enrollment_close_date as string | null) ?? null,
      inherit_dates: Boolean(row.inherit_dates),
      inherit_eligibility: Boolean(row.inherit_eligibility),
      gender: (row.gender as string | null) ?? null,
      min_age: row.min_age == null ? null : Number(row.min_age),
      max_age: row.max_age == null ? null : Number(row.max_age),
      program_id: programId,
      yearSeasonName: (program.name as string) || YEAR_SEASON_LABEL,
      department_id: (program.department_id as string | null) ?? null,
      department_name: (department?.name as string | null) ?? null,
      enrolled: enrollmentById.get(row.id as string) ?? 0,
      display_start_date: dates.start_date,
      display_end_date: dates.end_date,
      display_enrollment_open_date: dates.enrollment_open_date,
      display_enrollment_close_date: dates.enrollment_close_date,
      display_gender: eligibility.gender,
      display_min_age: eligibility.min_age,
      display_max_age: eligibility.max_age,
    })
  }

  return {
    organization,
    offerings: cards.filter((card) => matchesPublicFilters(card, filters)),
    departments,
  }
}
