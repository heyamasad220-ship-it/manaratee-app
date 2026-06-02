export type AttendanceStatus = "present" | "absent" | "late" | "excused"
export type LeaveType = "vacation" | "sick" | "personal" | "other"
export type TimeOffStatus = "approved" | "pending" | "rejected"
export type StaffType =
  | "full_time"
  | "part_time"
  | "temporary"
  | "contract"
  | "seasonal"

export type ReportStaffMember = {
  id: string
  first_name: string
  last_name: string
  staff_type: StaffType | string
  status: string
  hire_date: string | null
  department_id: string | null
  department_name: string | null
}

export type AttendanceRecord = {
  id: string
  staff_id: string
  staff_name: string
  department_name: string | null
  record_date: string
  status: AttendanceStatus
  notes: string | null
}

export type TimeOffRecord = {
  id: string
  staff_id: string
  staff_name: string
  department_name: string | null
  leave_type: LeaveType
  start_date: string
  end_date: string
  days_count: number
  status: TimeOffStatus
  notes: string | null
}

export type AttendanceFormState = {
  staff_id: string
  record_date: string
  status: AttendanceStatus
  notes: string
}

export type TimeOffFormState = {
  staff_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  days_count: string
  status: TimeOffStatus
  notes: string
}

export type DateRangeKey = "7d" | "30d" | "90d" | "1y"

export const STAFF_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-Time",
  part_time: "Part-Time",
  temporary: "Temporary",
  contract: "Contract",
  seasonal: "Seasonal",
}

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  vacation: "Vacation",
  sick: "Sick Leave",
  personal: "Personal",
  other: "Other",
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
}
