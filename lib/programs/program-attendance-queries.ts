import { createClient } from "@/lib/supabase/server"
import type { ProgramAttendanceRecord } from "@/lib/programs/program-attendance-types"

function todayDateString() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Read attendance for an offering/date. Safe for RSC — does not throw. */
export async function getOfferingAttendanceForDate(input: {
  offeringId: string
  organizationId: string
  attendanceDate?: string
}): Promise<ProgramAttendanceRecord[]> {
  try {
    const supabase = await createClient()
    const attendanceDate = input.attendanceDate || todayDateString()

    const { data, error } = await supabase
      .from("program_attendance")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("offering_id", input.offeringId)
      .eq("attendance_date", attendanceDate)

    if (error) {
      console.error("getOfferingAttendanceForDate:", error.message)
      return []
    }

    return (data || []) as ProgramAttendanceRecord[]
  } catch (error) {
    console.error("getOfferingAttendanceForDate:", error)
    return []
  }
}
