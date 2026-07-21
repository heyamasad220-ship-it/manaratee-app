import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import type { ProgramScheduleItem } from "@/lib/programs/program-schedule-types"

function timeToMinutes(value: string) {
  if (!value) return 0

  if (value.includes(":") && !value.includes("AM") && !value.includes("PM")) {
    const [hours, minutes] = value.split(":").map(Number)
    return hours * 60 + minutes
  }

  const match = value.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i)
  if (!match) return 0

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const period = match[3].toUpperCase()

  if (period === "PM" && hours !== 12) hours += 12
  if (period === "AM" && hours === 12) hours = 0

  return hours * 60 + minutes
}

function timesOverlap(
  existingStart: string,
  existingEnd: string,
  newStart: string,
  newEnd: string
) {
  return (
    timeToMinutes(existingStart) < timeToMinutes(newEnd) &&
    timeToMinutes(existingEnd) > timeToMinutes(newStart)
  )
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

function sortScheduleItems<T extends { day_of_week?: string; start_time?: string }>(
  items: T[]
) {
  return [...items].sort((a, b) => {
    const dayDiff =
      (DAY_ORDER[(a.day_of_week || "").toLowerCase()] || 99) -
      (DAY_ORDER[(b.day_of_week || "").toLowerCase()] || 99)
    if (dayDiff !== 0) return dayDiff
    return String(a.start_time || "").localeCompare(String(b.start_time || ""))
  })
}

/** Weekly slots for one offering (Schedule tab editor). */
export async function getOfferingScheduleItems(
  offeringId: string
): Promise<ProgramScheduleItem[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) return []

  const { data, error } = await supabase
    .from("program_schedule_items")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("offering_id", offeringId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true })

  if (error) {
    console.error(error)
    throw new Error("Failed to load offering schedule")
  }

  return sortScheduleItems((data || []) as ProgramScheduleItem[])
}

/** All weekly slots under a program (any offering) — department / customer / briefs. */
export async function getProgramScheduleItems(
  programId: string
): Promise<ProgramScheduleItem[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) return []

  const { data, error } = await supabase
    .from("program_schedule_items")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("program_id", programId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true })

  if (error) {
    console.error(error)
    throw new Error("Failed to load schedule")
  }

  return sortScheduleItems((data || []) as ProgramScheduleItem[])
}

type ScheduleConflictInput = {
  programId: string
  dayOfWeek: string
  startTime: string
  endTime: string
  instructorName?: string
  excludeItemId?: string
}

/** Instructor conflicts across offerings of the same program. */
export async function getInstructorScheduleConflicts({
  programId,
  dayOfWeek,
  startTime,
  endTime,
  instructorName,
  excludeItemId,
}: ScheduleConflictInput) {
  if (!instructorName) return []

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) return []

  let query = supabase
    .from("program_schedule_items")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("program_id", programId)
    .eq("day_of_week", dayOfWeek)
    .ilike("instructor_name", instructorName)

  if (excludeItemId) {
    query = query.neq("id", excludeItemId)
  }

  const { data, error } = await query

  if (error) {
    console.error(error)
    throw new Error("Failed to check schedule conflicts")
  }

  return (data || []).filter((item) =>
    timesOverlap(item.start_time, item.end_time, startTime, endTime)
  )
}
