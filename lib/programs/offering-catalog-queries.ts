"use server"

import { DEPARTMENT_OPEN_PROGRAM_STATUSES } from "@/lib/departments/department-active-programs"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  resolveEffectiveOfferingDates,
  resolveEffectiveOfferingEligibility,
} from "@/lib/programs/program-offering-inherit"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import { getOfferingEnrollmentCount } from "@/lib/programs/program-staff-assignment-queries"
import { createClient } from "@/lib/supabase/server"

export type OfferingCatalogCard = {
  id: string
  name: string
  status: ProgramOffering["status"]
  flyer_url: string | null
  background_color: string | null
  capacity_mode: string | null
  capacity: number | null
  start_date: string | null
  end_date: string | null
  enrollment_open_date: string | null
  enrollment_close_date: string | null
  inherit_dates: boolean
  inherit_eligibility: boolean
  gender: string | null
  min_age: number | null
  max_age: number | null
  program_id: string
  yearSeasonName: string
  department_id: string | null
  department_name: string | null
  enrolled: number
  /** Effective dates for display (after inherit resolution). */
  display_start_date: string | null
  display_end_date: string | null
  display_enrollment_open_date: string | null
  display_enrollment_close_date: string | null
  display_gender: string | null
  display_min_age: number | null
  display_max_age: number | null
}

export type OfferingCatalogFilters = {
  q?: string
  department?: string
}

function matchesOfferingCatalogFilters(
  row: OfferingCatalogCard,
  filters: OfferingCatalogFilters
) {
  const q = (filters.q || "").trim().toLowerCase()
  if (q) {
    const haystack = `${row.name} ${row.yearSeasonName} ${row.department_name || ""}`.toLowerCase()
    if (!haystack.includes(q)) return false
  }

  const department = filters.department || "all"
  if (department !== "all" && row.department_id !== department) {
    return false
  }

  return true
}

/**
 * Active offerings under open years/seasons for the org Programs catalog.
 */
export async function getActiveOfferingsForCatalog(
  filters: OfferingCatalogFilters = {}
): Promise<OfferingCatalogCard[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const supabase = await createClient()

  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select(
      `
      id,
      name,
      department_id,
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

  if (programsError || !programs?.length) {
    if (programsError) {
      console.error("getActiveOfferingsForCatalog programs:", programsError.message)
    }
    return []
  }

  const departmentIds = Array.from(
    new Set(
      programs
        .map((row) => (row.department_id as string | null) || null)
        .filter((id): id is string => Boolean(id))
    )
  )

  const departmentNameById = new Map<string, string>()
  if (departmentIds.length > 0) {
    const { data: departments, error: departmentsError } = await supabase
      .from("departments")
      .select("id, name")
      .eq("organization_id", organizationId)
      .in("id", departmentIds)

    if (departmentsError) {
      console.warn(
        "getActiveOfferingsForCatalog departments:",
        departmentsError.message
      )
    } else {
      for (const department of departments || []) {
        departmentNameById.set(
          department.id as string,
          (department.name as string) || "Department"
        )
      }
    }
  }

  const programIds = programs.map((row) => row.id as string)
  const programById = new Map(
    programs.map((row) => {
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

  const { data: offerings, error: offeringsError } = await supabase
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

  if (offeringsError) {
    // Columns may be missing until script 191 is applied — retry without branding.
    if (
      offeringsError.message.includes("flyer_url") ||
      offeringsError.message.includes("background_color") ||
      offeringsError.message.toLowerCase().includes("does not exist")
    ) {
      const { data: fallback, error: fallbackError } = await supabase
        .from("program_offerings")
        .select(
          `
          id,
          name,
          status,
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

      if (fallbackError || !fallback?.length) {
        console.error(
          "getActiveOfferingsForCatalog offerings:",
          fallbackError?.message || offeringsError.message
        )
        return []
      }

      return hydrateCatalogRows(fallback, programById, organizationId, filters, true)
    }

    console.error("getActiveOfferingsForCatalog offerings:", offeringsError.message)
    return []
  }

  if (!offerings?.length) return []

  return hydrateCatalogRows(offerings, programById, organizationId, filters, false)
}

async function hydrateCatalogRows(
  offerings: Record<string, unknown>[],
  programById: Map<string, Record<string, unknown>>,
  organizationId: string,
  filters: OfferingCatalogFilters,
  brandingMissing: boolean
): Promise<OfferingCatalogCard[]> {
  const enrollmentCounts = await Promise.all(
    offerings.map(async (row) => ({
      id: row.id as string,
      count: await getOfferingEnrollmentCount(row.id as string, organizationId),
    }))
  )
  const enrolledById = new Map(
    enrollmentCounts.map((item) => [item.id, item.count])
  )

  const cards: OfferingCatalogCard[] = []

  for (const row of offerings) {
    const programId = row.program_id as string
    const program = programById.get(programId)
    if (!program) continue

    const department = program.department as
      | { id?: string; name?: string }
      | { id?: string; name?: string }[]
      | null
    const departmentRow = Array.isArray(department) ? department[0] : department

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
      flyer_url: brandingMissing
        ? null
        : ((row.flyer_url as string | null) ?? null),
      background_color: brandingMissing
        ? null
        : ((row.background_color as string | null) ?? null),
      capacity_mode: (row.capacity_mode as string | null) ?? null,
      capacity:
        row.capacity == null ? null : Number(row.capacity),
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
      yearSeasonName: (program.name as string) || "Year/Season",
      department_id: (program.department_id as string | null) ?? null,
      department_name: (departmentRow?.name as string | null) ?? null,
      enrolled: enrolledById.get(row.id as string) ?? 0,
      display_start_date: dates.start_date,
      display_end_date: dates.end_date,
      display_enrollment_open_date: dates.enrollment_open_date,
      display_enrollment_close_date: dates.enrollment_close_date,
      display_gender: eligibility.gender,
      display_min_age: eligibility.min_age,
      display_max_age: eligibility.max_age,
    })
  }

  return cards.filter((card) => matchesOfferingCatalogFilters(card, filters))
}
