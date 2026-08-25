export type MoveOfferingTarget = {
  id: string
  name: string
}

export function canMoveEnrollmentStatus(status: string | null | undefined) {
  const value = String(status || "").toLowerCase()
  return !["cancelled", "withdrawn", "transferred", "expired"].includes(value)
}

export function formatMoveOfferingTargetLabel(input: {
  name: string
  instructor?: string | null
  enrolled: number
  capacity: number | null
}) {
  const countLabel =
    input.capacity && input.capacity > 0
      ? `${input.enrolled}/${input.capacity}`
      : `${input.enrolled}`
  const parts = [input.name]
  if (input.instructor) parts.push(input.instructor)
  parts.push(countLabel)
  return parts.join(" · ")
}
