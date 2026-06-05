import type { ProgramStatus } from "@/lib/programs/program-status"

type ProgramEnrollmentWindow = {
  enrollment_open_date?: string | null
  enrollment_close_date?: string | null
}

type ProgramRegistrationCapacity = {
  capacity?: number | null
  enrolled?: number | null
  waitlist?: number | null
}

export type ProgramRegistrationAvailabilityInput = ProgramEnrollmentWindow &
  ProgramRegistrationCapacity & {
    status: string
  }

function todayDateOnly() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function dateOnly(value?: string | null) {
  if (!value) return null
  return new Date(`${value}T00:00:00`)
}

export function isEnrollmentWindowOpen(
  open?: string | null,
  close?: string | null,
  today = todayDateOnly()
) {
  const openDate = dateOnly(open)
  const closeDate = dateOnly(close)

  if (!openDate && !closeDate) {
    return true
  }

  if (openDate && today < openDate) {
    return false
  }

  if (closeDate && today > closeDate) {
    return false
  }

  return true
}

export function isProgramAtCapacity(program: ProgramRegistrationCapacity) {
  const capacity = program.capacity ?? 0
  const enrolled = program.enrolled ?? 0

  return capacity > 0 && enrolled >= capacity
}

export function isProgramPublishedForRegistration(status: string) {
  return status === "active"
}

export function isProgramAcceptingRegistration(
  program: ProgramRegistrationAvailabilityInput
) {
  if (!isProgramPublishedForRegistration(program.status)) {
    return false
  }

  if (
    !isEnrollmentWindowOpen(
      program.enrollment_open_date,
      program.enrollment_close_date
    )
  ) {
    return false
  }

  if (isProgramAtCapacity(program)) {
    return false
  }

  return true
}

export function getProgramRegistrationAvailabilityLabel(
  program: ProgramRegistrationAvailabilityInput
) {
  if (!isProgramPublishedForRegistration(program.status)) {
    switch (program.status as ProgramStatus) {
      case "draft":
        return "Not accepting registrations"
      case "paused":
        return "Paused — not accepting registrations"
      case "archived":
        return "Archived — not accepting registrations"
      default:
        return "Not accepting registrations"
    }
  }

  if (
    !isEnrollmentWindowOpen(
      program.enrollment_open_date,
      program.enrollment_close_date
    )
  ) {
    return "Enrollment closed"
  }

  if (isProgramAtCapacity(program)) {
    return (program.waitlist ?? 0) > 0 ? "Full — waitlist open" : "Full"
  }

  return "Open for registration"
}

export function getTodayDateString() {
  return new Date().toISOString().slice(0, 10)
}

export function shouldCloseEnrollmentForStatus(status: string) {
  return status === "draft" || status === "paused" || status === "archived"
}
