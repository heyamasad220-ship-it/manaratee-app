import type { ChildcareRegistration } from "@/lib/child-care/childcare-registration-types"

function formatEventTimeRange(start: string | null, end: string | null) {
  if (start && end) return `${start} - ${end}`
  return start || end || "—"
}

export function formatChildcareDate(value: string | null) {
  if (!value) return "—"
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatChildcareTimeRange(registration: ChildcareRegistration) {
  return formatEventTimeRange(registration.start_time, registration.end_time)
}
