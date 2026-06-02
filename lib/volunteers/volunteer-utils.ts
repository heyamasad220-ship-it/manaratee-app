import type {
  Volunteer,
  VolunteerHistoryRow,
  VolunteerPerformance,
  VolunteerRow,
  VolunteerSignUpRow,
  VolunteerSignUpStatus,
  VolunteerStatus,
} from "@/lib/volunteers/volunteer-types"

export function formatDisplayDate(value: string | null) {
  if (!value) return "-"

  const parsedDate = new Date(`${value.slice(0, 10)}T00:00:00`)
  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatStatusLabel(status: VolunteerStatus): Volunteer["status"] {
  if (status === "active") return "Active"
  if (status === "inactive") return "Inactive"
  return "Pending"
}

export function formatSignUpStatusLabel(
  status: VolunteerSignUpStatus
): Volunteer["signUps"][number]["status"] {
  if (status === "confirmed") return "Confirmed"
  if (status === "completed") return "Completed"
  if (status === "cancelled") return "Cancelled"
  return "Pending"
}

export function formatPerformanceLabel(
  performance: VolunteerPerformance
): Volunteer["history"][number]["performance"] {
  if (performance === "excellent") return "Excellent"
  if (performance === "average") return "Average"
  if (performance === "poor") return "Poor"
  return "Good"
}

export function parseListInput(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export function buildVolunteerFromRows(
  row: VolunteerRow,
  signUps: VolunteerSignUpRow[],
  history: VolunteerHistoryRow[]
): Volunteer {
  const volunteerSignUps = signUps
    .filter((signUp) => signUp.volunteer_id === row.id)
    .map((signUp) => ({
      id: signUp.id,
      eventName: signUp.event_name,
      date: formatDisplayDate(signUp.event_date),
      role: signUp.role || "-",
      hoursLogged: Number(signUp.hours_logged) || 0,
      status: formatSignUpStatusLabel(signUp.status),
    }))

  const volunteerHistory = history
    .filter((record) => record.volunteer_id === row.id)
    .map((record) => ({
      id: record.id,
      eventName: record.event_name,
      date: formatDisplayDate(record.event_date),
      role: record.role || "-",
      hoursWorked: Number(record.hours_worked) || 0,
      performance: formatPerformanceLabel(record.performance),
      notes: record.notes || undefined,
    }))

  const historyHours = volunteerHistory.reduce((sum, record) => sum + record.hoursWorked, 0)
  const completedSignUpHours = volunteerSignUps
    .filter((signUp) => signUp.status === "Completed")
    .reduce((sum, signUp) => sum + signUp.hoursLogged, 0)

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email || "",
    phone: row.phone || "",
    status: formatStatusLabel(row.status),
    joinDate: formatDisplayDate(row.join_date),
    joinDateRaw: row.join_date,
    totalHours: historyHours + completedSignUpHours,
    eventsVolunteered: volunteerHistory.length,
    skills: row.skills || [],
    availability: row.availability || [],
    notes: row.notes || "",
    signUps: volunteerSignUps.filter(
      (signUp) => signUp.status === "Confirmed" || signUp.status === "Pending"
    ),
    history: volunteerHistory,
  }
}

export const volunteerStatusStyles: Record<Volunteer["status"], string> = {
  Active: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Inactive: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  Pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
}

export const signUpStatusStyles: Record<string, string> = {
  Confirmed: "bg-emerald-100 text-emerald-700",
  Pending: "bg-amber-100 text-amber-700",
  Completed: "bg-blue-100 text-blue-700",
  Cancelled: "bg-red-100 text-red-700",
}

export const performanceStyles: Record<string, string> = {
  Excellent: "bg-emerald-100 text-emerald-700",
  Good: "bg-blue-100 text-blue-700",
  Average: "bg-amber-100 text-amber-700",
  Poor: "bg-red-100 text-red-700",
}
