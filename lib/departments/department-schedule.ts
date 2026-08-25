"use server"

import { DEPARTMENT_WORKSPACE_PROGRAM_STATUSES } from "@/lib/departments/department-active-programs"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"

export type DepartmentScheduleWeeklyRow = {
  id: string
  programId: string
  programName: string
  offeringId: string | null
  offeringName: string | null
  title: string
  dayOfWeek: string
  startTime: string
  endTime: string
  /** Booked facility space name when `venue_id` is set. */
  spaceName: string | null
  location: string | null
  instructorName: string | null
}

export type DepartmentScheduleSessionRow = {
  id: string
  programId: string
  programName: string
  offeringId: string | null
  offeringName: string | null
  name: string
  startDate: string | null
  endDate: string | null
  status: string
  capacity: number
  enrolled: number
}

export type DepartmentScheduleSummary = {
  weekly: DepartmentScheduleWeeklyRow[]
  sessions: DepartmentScheduleSessionRow[]
  programs: Array<{ id: string; name: string; defaultOfferingId: string | null }>
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

export async function fetchDepartmentSchedule(
  departmentId: string,
  options?: { programId?: string }
): Promise<DepartmentScheduleSummary> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { weekly: [], sessions: [], programs: [] }
  }

  const supabase = await createClient()
  let programsQuery = supabase
    .from("programs")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("department_id", departmentId)
    .in("status", [...DEPARTMENT_WORKSPACE_PROGRAM_STATUSES])
    .order("name", { ascending: true })

  if (options?.programId) {
    programsQuery = programsQuery.eq("id", options.programId)
  }

  const { data: programs, error: programsError } = await programsQuery

  if (programsError) {
    throw new Error(programsError.message || "Could not load programs.")
  }

  const programRows = programs || []
  if (programRows.length === 0) {
    return { weekly: [], sessions: [], programs: [] }
  }

  const programIds = programRows.map((row) => row.id as string)
  const programNameById = new Map(
    programRows.map((row) => [row.id as string, (row.name as string) || "Program"])
  )

  const [{ data: scheduleItems, error: scheduleError }, { data: sessions }, { data: offerings }] =
    await Promise.all([
      supabase
        .from("program_schedule_items")
        .select(
          "id, program_id, offering_id, title, day_of_week, start_time, end_time, location, instructor_name, venue_id, venues(name)"
        )
        .eq("organization_id", organizationId)
        .in("program_id", programIds),
      supabase
        .from("program_sessions")
        .select(
          "id, program_id, offering_id, name, start_date, end_date, status, capacity, enrolled"
        )
        .eq("organization_id", organizationId)
        .in("program_id", programIds)
        .neq("status", "archived")
        .order("start_date", { ascending: true }),
      supabase
        .from("program_offerings")
        .select("id, name, program_id, is_default, status")
        .eq("organization_id", organizationId)
        .in("program_id", programIds)
        .neq("status", "archived"),
    ])

  let scheduleRows = scheduleItems || []
  if (
    scheduleError &&
    (scheduleError.message?.includes("venue_id") ||
      scheduleError.code === "42703" ||
      scheduleError.code === "PGRST200")
  ) {
    const { data: fallbackItems, error: fallbackError } = await supabase
      .from("program_schedule_items")
      .select(
        "id, program_id, offering_id, title, day_of_week, start_time, end_time, location, instructor_name"
      )
      .eq("organization_id", organizationId)
      .in("program_id", programIds)
    if (fallbackError) {
      throw new Error(fallbackError.message || "Could not load schedule items.")
    }
    scheduleRows = fallbackItems || []
  } else if (scheduleError) {
    throw new Error(scheduleError.message || "Could not load schedule items.")
  }

  const offeringNameById = new Map(
    (offerings || []).map((row) => [
      row.id as string,
      (row.name as string) || "Offering",
    ])
  )

  const defaultOfferingByProgram = new Map<string, string>()
  for (const row of offerings || []) {
    if (row.is_default === true) {
      defaultOfferingByProgram.set(row.program_id as string, row.id as string)
    }
  }
  for (const row of offerings || []) {
    const programId = row.program_id as string
    if (!defaultOfferingByProgram.has(programId)) {
      defaultOfferingByProgram.set(programId, row.id as string)
    }
  }

  const weekly: DepartmentScheduleWeeklyRow[] = scheduleRows
    .map((row) => {
      const venueEmbed = (row as { venues?: unknown }).venues as
        | { name?: string | null }
        | { name?: string | null }[]
        | null
        | undefined
      const venueName = Array.isArray(venueEmbed)
        ? venueEmbed[0]?.name
        : venueEmbed?.name

      return {
        id: row.id as string,
        programId: row.program_id as string,
        programName: programNameById.get(row.program_id as string) || "Program",
        offeringId: (row.offering_id as string | null) ?? null,
        offeringName: row.offering_id
          ? offeringNameById.get(row.offering_id as string) || null
          : null,
        title: (row.title as string) || "Class",
        dayOfWeek: (row.day_of_week as string) || "",
        startTime: (row.start_time as string) || "",
        endTime: (row.end_time as string) || "",
        spaceName: (venueName as string | null | undefined) ?? null,
        location: (row.location as string | null) ?? null,
        instructorName: (row.instructor_name as string | null) ?? null,
      }
    })
    .sort((a, b) => {
      const dayDiff =
        (DAY_ORDER[a.dayOfWeek.toLowerCase()] || 99) -
        (DAY_ORDER[b.dayOfWeek.toLowerCase()] || 99)
      if (dayDiff !== 0) return dayDiff
      return a.startTime.localeCompare(b.startTime)
    })

  const sessionRows: DepartmentScheduleSessionRow[] = (sessions || []).map(
    (row) => ({
      id: row.id as string,
      programId: row.program_id as string,
      programName: programNameById.get(row.program_id as string) || "Program",
      offeringId: (row.offering_id as string | null) ?? null,
      offeringName: row.offering_id
        ? offeringNameById.get(row.offering_id as string) || null
        : null,
      name: (row.name as string) || "Session",
      startDate: (row.start_date as string | null) ?? null,
      endDate: (row.end_date as string | null) ?? null,
      status: (row.status as string) || "active",
      capacity: Number(row.capacity || 0),
      enrolled: Number(row.enrolled || 0),
    })
  )

  return {
    weekly,
    sessions: sessionRows,
    programs: programRows.map((row) => ({
      id: row.id as string,
      name: (row.name as string) || "Program",
      defaultOfferingId: defaultOfferingByProgram.get(row.id as string) || null,
    })),
  }
}

export async function fetchDepartmentScheduleAction(
  departmentId: string,
  options?: { programId?: string }
) {
  try {
    const summary = await fetchDepartmentSchedule(departmentId, options)
    return { success: true as const, summary }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load schedule.",
    }
  }
}
