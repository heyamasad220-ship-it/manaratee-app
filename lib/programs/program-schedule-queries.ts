import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

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

export async function getProgramScheduleItems(programId: string) {
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

  return data
}

type ScheduleConflictInput = {
  programId: string
  dayOfWeek: string
  startTime: string
  endTime: string
  instructorName?: string
  excludeItemId?: string
}

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