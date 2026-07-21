"use server"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"

export type DepartmentScheduleWeeklyRow = {
  id: string
  programId: string
  programName: string
  title: string
  dayOfWeek: string
  startTime: string
  endTime: string
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
  programs: Array<{ id: string; name: string }>
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
  departmentId: string
): Promise<DepartmentScheduleSummary> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { weekly: [], sessions: [], programs: [] }
  }

  const supabase = await createClient()
  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("department_id", departmentId)
    .in("status", ["draft", "active", "paused"])
    .order("name", { ascending: true })

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

  const [{ data: scheduleItems }, { data: sessions }, { data: offerings }] =
    await Promise.all([
      supabase
        .from("program_schedule_items")
        .select(
          "id, program_id, title, day_of_week, start_time, end_time, location, instructor_name"
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
        .select("id, name")
        .eq("organization_id", organizationId)
        .in("program_id", programIds),
    ])

  const offeringNameById = new Map(
    (offerings || []).map((row) => [
      row.id as string,
      (row.name as string) || "Offering",
    ])
  )

  const weekly: DepartmentScheduleWeeklyRow[] = (scheduleItems || [])
    .map((row) => ({
      id: row.id as string,
      programId: row.program_id as string,
      programName: programNameById.get(row.program_id as string) || "Program",
      title: (row.title as string) || "Class",
      dayOfWeek: (row.day_of_week as string) || "",
      startTime: (row.start_time as string) || "",
      endTime: (row.end_time as string) || "",
      location: (row.location as string | null) ?? null,
      instructorName: (row.instructor_name as string | null) ?? null,
    }))
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
    })),
  }
}

export async function fetchDepartmentScheduleAction(departmentId: string) {
  try {
    const summary = await fetchDepartmentSchedule(departmentId)
    return { success: true as const, summary }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load schedule.",
    }
  }
}
