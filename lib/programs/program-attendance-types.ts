/**
 * Program attendance (F5) — teacher class-page marking.
 */

export type ProgramAttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "excused"

export const PROGRAM_ATTENDANCE_STATUS_LABELS: Record<
  ProgramAttendanceStatus,
  string
> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
}

export const PROGRAM_ATTENDANCE_STATUS_OPTIONS: Array<{
  value: ProgramAttendanceStatus
  label: string
}> = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
]

export type ProgramAttendanceRecord = {
  id: string
  organization_id: string
  offering_id: string
  enrollment_id: string
  attendance_date: string
  status: ProgramAttendanceStatus
  marked_by_contact_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
