"use server"

import { DEPARTMENT_WORKSPACE_PROGRAM_STATUSES } from "@/lib/departments/department-program-statuses"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { formatOfferingScheduleCompact } from "@/lib/programs/offering-schedule-summary"
import type { OfferingsManagementRow } from "@/lib/programs/offerings-management"
import { primaryInstructorNameByOffering } from "@/lib/programs/primary-instructor"
import { normalizeProgramKind, type ProgramKind } from "@/lib/programs/program-kind"
import type { OfferingDeliveryFormat } from "@/lib/programs/program-offering-attributes"
import { getOfferingRegistrationState } from "@/lib/programs/program-offering-display"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import type { ProgramOfferingStatus } from "@/lib/programs/program-offering-types"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"
import { createClient } from "@/lib/supabase/server"

type ProgramRow = {
  id: string
  name: string
  status: string
  program_kind: string | null
  department_id: string | null
  start_date: string | null
  end_date: string | null
  enrollment_open_date: string | null
  enrollment_close_date: string | null
}

function todayIsoDate() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

function isCurrentDateRange(
  start: string | null,
  end: string | null,
  today = todayIsoDate()
) {
  if (start && today < start) return false
  if (end && today > end) return false
  return true
}

function countByKey(ids: Array<string | null | undefined>) {
  const counts = new Map<string, number>()
  for (const id of ids) {
    if (!id) continue
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  return counts
}

/**
 * Org-wide staff view over existing `program_offerings` (not a second catalog).
 * Includes draft/closed/archived offerings under workspace programs.
 */
export async function getStaffOfferingsForManagement(): Promise<
  OfferingsManagementRow[]
> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const supabase = await createClient()

  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select(
      `
      id,
      name,
      status,
      program_kind,
      department_id,
      start_date,
      end_date,
      enrollment_open_date,
      enrollment_close_date
    `
    )
    .eq("organization_id", organizationId)
    .in("status", [...DEPARTMENT_WORKSPACE_PROGRAM_STATUSES])
    .order("name", { ascending: true })

  if (programsError) {
    console.error("getStaffOfferingsForManagement programs:", programsError)
    throw new Error("Failed to load programs for offerings")
  }

  const programRows = (programs || []) as ProgramRow[]
  if (programRows.length === 0) return []

  const programIds = programRows.map((row) => row.id)
  const programById = new Map(programRows.map((row) => [row.id, row]))
  const departmentIds = Array.from(
    new Set(
      programRows
        .map((row) => row.department_id)
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
        "getStaffOfferingsForManagement departments:",
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

  const { data: offerings, error: offeringsError } = await supabase
    .from("program_offerings")
    .select(
      `
      id,
      name,
      status,
      program_id,
      capacity_mode,
      capacity,
      delivery_format,
      start_date,
      end_date,
      enrollment_open_date,
      enrollment_close_date,
      inherit_dates
    `
    )
    .eq("organization_id", organizationId)
    .in("program_id", programIds)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (offeringsError) {
    console.error("getStaffOfferingsForManagement offerings:", offeringsError)
    throw new Error("Failed to load offerings")
  }

  const offeringRows = offerings || []
  const offeringIds = offeringRows.map((row) => row.id as string)
  if (offeringIds.length === 0) return []

  const [
    { data: assignments },
    { data: scheduleItems },
    { data: feePlans },
    { data: enrollments },
    { data: waitlistRows },
  ] = await Promise.all([
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
      .in("offering_id", offeringIds),
    supabase
      .from("program_offering_fee_plans")
      .select("id, offering_id, is_default, is_active, plan_type")
      .eq("organization_id", organizationId)
      .in("offering_id", offeringIds),
    supabase
      .from("program_enrollments")
      .select("offering_id")
      .eq("organization_id", organizationId)
      .in("offering_id", offeringIds)
      .in("status", ["enrolled", "active"]),
    supabase
      .from("program_waitlist")
      .select("offering_id")
      .eq("organization_id", organizationId)
      .in("offering_id", offeringIds)
      .in("status", ["waiting", "offered"]),
  ])

  const instructorByOffering = primaryInstructorNameByOffering(
    (assignments || []).map((row) => ({
      offering_id: row.offering_id as string,
      assignment_role: String(row.assignment_role || ""),
      is_active: true,
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
    Array<{
      id: string
      is_default: boolean
      is_active: boolean
      plan_type: string | null
    }>
  >()
  for (const row of feePlans || []) {
    const offeringId = row.offering_id as string
    if (!offeringId) continue
    const list = plansByOffering.get(offeringId) || []
    list.push({
      id: row.id as string,
      is_default: Boolean(row.is_default),
      is_active: row.is_active !== false,
      plan_type: (row.plan_type as string | null) ?? null,
    })
    plansByOffering.set(offeringId, list)
  }

  const defaultPlanByOffering = new Map<
    string,
    { id: string; plan_type: string | null }
  >()
  const defaultPlanIds: string[] = []
  for (const [offeringId, plans] of plansByOffering) {
    const defaultPlan =
      plans.find((plan) => plan.is_default && plan.is_active) ||
      plans.find((plan) => plan.is_default) ||
      plans.find((plan) => plan.is_active) ||
      plans[0]
    if (!defaultPlan) continue
    defaultPlanByOffering.set(offeringId, {
      id: defaultPlan.id,
      plan_type: defaultPlan.plan_type,
    })
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
      tuitionByPlanId.set(planId, (tuitionByPlanId.get(planId) || 0) + amount)
    }
  }

  const enrolledByOffering = countByKey(
    (enrollments || []).map((row) => row.offering_id as string)
  )
  const waitlistByOffering = countByKey(
    (waitlistRows || []).map((row) => row.offering_id as string)
  )

  return offeringRows.flatMap((offering) => {
    const program = programById.get(offering.program_id as string)
    if (!program) return []

    const departmentName = program.department_id
      ? departmentNameById.get(program.department_id) || null
      : null
    const inheritDates = offering.inherit_dates === true
    const dates = inheritDates
      ? {
          start_date: program.start_date,
          end_date: program.end_date,
          enrollment_open_date: program.enrollment_open_date,
          enrollment_close_date: program.enrollment_close_date,
        }
      : {
          start_date: (offering.start_date as string | null) ?? null,
          end_date: (offering.end_date as string | null) ?? null,
          enrollment_open_date:
            (offering.enrollment_open_date as string | null) ?? null,
          enrollment_close_date:
            (offering.enrollment_close_date as string | null) ?? null,
        }

    const offeringId = offering.id as string
    const programId = program.id
    const defaultPlan = defaultPlanByOffering.get(offeringId)
    const tuition =
      defaultPlan != null ? tuitionByPlanId.get(defaultPlan.id) ?? null : null
    const feeIsFree =
      defaultPlan?.plan_type === "free" ||
      (tuition != null && tuition === 0)

    const programKind: ProgramKind = normalizeProgramKind(program.program_kind)
    const status = (offering.status as ProgramOfferingStatus) || "draft"
    const deliveryFormat =
      (offering.delivery_format as OfferingDeliveryFormat | null) ?? "in_person"

    const row: OfferingsManagementRow = {
      id: offeringId,
      name: (offering.name as string) || "Offering",
      status,
      programId,
      programName: program.name || "Program",
      programKind,
      departmentId: program.department_id,
      departmentName,
      primaryInstructor: instructorByOffering.get(offeringId) || null,
      deliveryFormat,
      scheduleLabel: formatOfferingScheduleCompact(
        scheduleByOffering.get(offeringId) || []
      ),
      feeAmount: tuition,
      feeIsFree,
      feeAvailable: Boolean(defaultPlan),
      enrolled: enrolledByOffering.get(offeringId) || 0,
      capacityMode: (offering.capacity_mode as string | null) ?? "unlimited",
      capacity: (offering.capacity as number | null) ?? null,
      waitlistCount: waitlistByOffering.get(offeringId) || 0,
      registrationState: getOfferingRegistrationState({
        enrollment_open_date: dates.enrollment_open_date,
        enrollment_close_date: dates.enrollment_close_date,
      }),
      isCurrent: isCurrentDateRange(dates.start_date, dates.end_date),
      offeringHref: programOfferingManageHref(programId, offeringId),
      programHref: programWorkspaceHref(programId),
      editHref: programOfferingManageHref(programId, offeringId, { edit: true }),
    }
    return [row]
  })
}
