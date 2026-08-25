"use server"

import { loadDepartmentWorkspacePrograms } from "@/lib/departments/department-active-programs"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getOfferingsForProgram } from "@/lib/programs/program-offering-queries"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import { primaryInstructorNameByOffering } from "@/lib/programs/primary-instructor"
import { getOfferingEnrollmentCount } from "@/lib/programs/program-staff-assignment-queries"
import { createClient } from "@/lib/supabase/server"

export type DepartmentProgramsYear = {
  id: string
  name: string
  status: string
  program_kind: "academic" | "seasonal"
  start_date: string | null
  end_date: string | null
  enrollment_open_date: string | null
  enrollment_close_date: string | null
}

export type DepartmentProgramsOfferingRow = {
  offering: ProgramOffering
  enrolled: number
  yearProgramId: string
  yearProgramName: string
  primaryInstructor: string | null
  tuitionAmount: number | null
  daysLabel: string | null
  timesLabel: string | null
}

export type DepartmentProgramsBundle = {
  years: DepartmentProgramsYear[]
  offerings: DepartmentProgramsOfferingRow[]
}

const DAY_ORDER: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
}

const DAY_SHORT: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
}

function formatTimeCompact(value: string | null | undefined) {
  if (!value) return ""
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value).trim())
  if (!match) return String(value)
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return String(value)
  const period = hour >= 12 ? "pm" : "am"
  const hour12 = hour % 12 || 12
  if (minute === 0) return `${hour12}${period}`
  return `${hour12}:${String(minute).padStart(2, "0")}${period}`
}

function formatDaysLabel(
  items: Array<{ day_of_week: string | null }>
): string | null {
  const days = [
    ...new Set(
      items
        .map((item) => String(item.day_of_week || "").toLowerCase())
        .filter((day) => Boolean(DAY_SHORT[day]))
    ),
  ].sort((a, b) => (DAY_ORDER[a] || 99) - (DAY_ORDER[b] || 99))

  if (days.length === 0) return null
  return days.map((day) => DAY_SHORT[day]).join(", ")
}

function formatTimesLabel(
  items: Array<{ start_time: string | null; end_time: string | null }>
): string | null {
  const ranges = [
    ...new Set(
      items
        .map((item) => {
          const start = formatTimeCompact(item.start_time)
          const end = formatTimeCompact(item.end_time)
          if (!start || !end) return ""
          return `${start}-${end}`
        })
        .filter(Boolean)
    ),
  ]
  if (ranges.length === 0) return null
  return ranges.join(", ")
}

async function loadOpenYearsWithEnrollmentDates(
  organizationId: string,
  departmentId: string
): Promise<DepartmentProgramsYear[]> {
  const open = await loadDepartmentWorkspacePrograms(organizationId, departmentId)
  if (open.length === 0) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("programs")
    .select(
      "id, name, status, program_kind, start_date, end_date, enrollment_open_date, enrollment_close_date"
    )
    .eq("organization_id", organizationId)
    .in(
      "id",
      open.map((row) => row.id)
    )

  if (error) {
    throw new Error(error.message || "Could not load department years.")
  }

  const byId = new Map(
    (data || []).map((row) => [
      row.id as string,
      {
        id: row.id as string,
        name: (row.name as string) || "Year",
        status: (row.status as string) || "active",
        program_kind:
          (row.program_kind as string) === "seasonal" ? "seasonal" : "academic",
        start_date: (row.start_date as string | null) ?? null,
        end_date: (row.end_date as string | null) ?? null,
        enrollment_open_date:
          (row.enrollment_open_date as string | null) ?? null,
        enrollment_close_date:
          (row.enrollment_close_date as string | null) ?? null,
      } satisfies DepartmentProgramsYear,
    ])
  )

  // Preserve open-programs sort order (start_date desc, name).
  return open
    .map((row) => byId.get(row.id))
    .filter((row): row is DepartmentProgramsYear => Boolean(row))
}

export async function fetchDepartmentPrograms(
  departmentId: string
): Promise<DepartmentProgramsBundle> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { years: [], offerings: [] }
  }

  const years = await loadOpenYearsWithEnrollmentDates(
    organizationId,
    departmentId
  )
  if (years.length === 0) {
    return { years: [], offerings: [] }
  }

  const offerings: DepartmentProgramsOfferingRow[] = []
  const programIds = years.map((year) => year.id)

  for (const year of years) {
    const programOfferings = await getOfferingsForProgram(year.id)
    const counts = await Promise.all(
      programOfferings.map(async (offering) => ({
        offeringId: offering.id,
        enrolled: await getOfferingEnrollmentCount(
          offering.id,
          organizationId
        ),
      }))
    )
    const enrolledById = new Map(
      counts.map((row) => [row.offeringId, row.enrolled])
    )

    for (const offering of programOfferings) {
      offerings.push({
        offering,
        enrolled: enrolledById.get(offering.id) || 0,
        yearProgramId: year.id,
        yearProgramName: year.name,
        primaryInstructor: null,
        tuitionAmount: null,
        daysLabel: null,
        timesLabel: null,
      })
    }
  }

  const offeringIds = offerings.map((row) => row.offering.id)
  if (offeringIds.length === 0) {
    return { years, offerings }
  }

  const supabase = await createClient()
  const [{ data: assignments }, { data: scheduleItems }, { data: feePlans }] =
    await Promise.all([
      supabase
        .from("program_staff_assignments")
        .select(
        "offering_id, assignment_role, is_active, session_id, created_at, updated_at, contact:contact_id ( full_name )"
        )
        .eq("organization_id", organizationId)
        .in("offering_id", offeringIds)
        .eq("is_active", true)
        .in("assignment_role", ["primary_instructor", "instructor"]),
      supabase
        .from("program_schedule_items")
        .select("offering_id, day_of_week, start_time, end_time")
        .eq("organization_id", organizationId)
        .in("program_id", programIds)
        .in("offering_id", offeringIds),
      supabase
        .from("program_offering_fee_plans")
        .select("id, offering_id, is_default, is_active")
        .eq("organization_id", organizationId)
        .in("offering_id", offeringIds),
    ])

  const instructorByOffering = primaryInstructorNameByOffering(
    (assignments || []).map((row) => ({
      offering_id: row.offering_id as string,
      assignment_role: String(row.assignment_role || ""),
      is_active: row.is_active !== false,
      session_id: (row.session_id as string | null) ?? null,
      created_at: (row.created_at as string | null) ?? null,
      updated_at: (row.updated_at as string | null) ?? null,
      contact: row.contact as { full_name?: string | null } | null,
    }))
  )

  const scheduleByOffering = new Map<
    string,
    Array<{
      day_of_week: string | null
      start_time: string | null
      end_time: string | null
    }>
  >()
  for (const row of scheduleItems || []) {
    const offeringId = row.offering_id as string
    if (!offeringId) continue
    const list = scheduleByOffering.get(offeringId) || []
    list.push({
      day_of_week: (row.day_of_week as string | null) ?? null,
      start_time: (row.start_time as string | null) ?? null,
      end_time: (row.end_time as string | null) ?? null,
    })
    scheduleByOffering.set(offeringId, list)
  }

  const plansByOffering = new Map<
    string,
    Array<{ id: string; is_default: boolean; is_active: boolean }>
  >()
  for (const row of feePlans || []) {
    const offeringId = row.offering_id as string
    if (!offeringId) continue
    const list = plansByOffering.get(offeringId) || []
    list.push({
      id: row.id as string,
      is_default: Boolean(row.is_default),
      is_active: row.is_active !== false,
    })
    plansByOffering.set(offeringId, list)
  }

  const defaultPlanIdByOffering = new Map<string, string>()
  const defaultPlanIds: string[] = []
  for (const [offeringId, plans] of plansByOffering) {
    const defaultPlan =
      plans.find((plan) => plan.is_default && plan.is_active) ||
      plans.find((plan) => plan.is_default) ||
      plans.find((plan) => plan.is_active) ||
      plans[0]
    if (!defaultPlan) continue
    defaultPlanIdByOffering.set(offeringId, defaultPlan.id)
    defaultPlanIds.push(defaultPlan.id)
  }

  const tuitionByPlanId = new Map<string, number>()
  if (defaultPlanIds.length > 0) {
    const { data: tuitionComponents } = await supabase
      .from("program_offering_fee_plan_components")
      .select("fee_plan_id, amount, is_active")
      .eq("organization_id", organizationId)
      .in("fee_plan_id", defaultPlanIds)
      .eq("component_type", "tuition")

    for (const row of tuitionComponents || []) {
      if (row.is_active === false) continue
      const planId = row.fee_plan_id as string
      const amount = Number(row.amount)
      if (!Number.isFinite(amount)) continue
      tuitionByPlanId.set(
        planId,
        (tuitionByPlanId.get(planId) || 0) + amount
      )
    }
  }

  for (const row of offerings) {
    row.primaryInstructor = instructorByOffering.get(row.offering.id) || null
    const schedule = scheduleByOffering.get(row.offering.id) || []
    row.daysLabel = formatDaysLabel(schedule)
    row.timesLabel = formatTimesLabel(schedule)
    const planId = defaultPlanIdByOffering.get(row.offering.id)
    row.tuitionAmount =
      planId != null ? tuitionByPlanId.get(planId) ?? null : null
  }

  return { years, offerings }
}

export async function fetchDepartmentProgramsAction(departmentId: string) {
  try {
    const result = await fetchDepartmentPrograms(departmentId)
    return { success: true as const, ...result }
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Could not load department programs.",
    }
  }
}
