import {
  displayEnrollmentStatusLabel,
} from "@/lib/programs/enrollment-process"
import {
  REGISTRATION_COLUMN_DEFINITIONS,
  type RegistrationColumnId,
} from "@/lib/programs/registration-table-columns"

/** Fields the registration table/CSV need — kept client-safe (no server imports). */
export type RegistrationTableValueRow = {
  studentName: string
  studentEmail: string | null
  studentPhone: string | null
  isYouth: boolean
  showsGuardian: boolean
  parentName: string | null
  parentEmail: string | null
  parentPhone: string | null
  teacherName: string | null
  courseName: string
  yearSeasonName: string
  status: string | null
  registeredAt: string | null
  dateOfBirth: string | null
  age: number | null
  gender: string | null
  allergies: string | null
  photoConsent: string | null
}

export const EMPTY_CELL = "—"

export function displayCell(value: string | number | null | undefined): string {
  if (value == null) return EMPTY_CELL
  const text = String(value).trim()
  return text ? text : EMPTY_CELL
}

export function formatRegistrationDate(value: string | null | undefined): string {
  if (!value) return EMPTY_CELL
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match) {
    const date = new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    )
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return EMPTY_CELL
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatDateOfBirth(value: string | null | undefined): string {
  if (!value) return EMPTY_CELL
  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return EMPTY_CELL
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function registrationContactEmail(row: RegistrationTableValueRow) {
  return row.isYouth ? row.parentEmail : row.studentEmail
}

export function registrationContactPhone(row: RegistrationTableValueRow) {
  return row.isYouth ? row.parentPhone : row.studentPhone
}

export function registrationColumnLabel(id: RegistrationColumnId) {
  return (
    REGISTRATION_COLUMN_DEFINITIONS.find((column) => column.id === id)?.label ||
    id
  )
}

function csvText(value: string | number | null | undefined) {
  if (value == null) return ""
  return String(value).trim()
}

export function getRegistrationCsvValue(
  row: RegistrationTableValueRow,
  columnId: RegistrationColumnId
): string {
  switch (columnId) {
    case "participant":
      return csvText(row.studentName)
    case "email":
      return csvText(registrationContactEmail(row))
    case "phone":
      return csvText(registrationContactPhone(row))
    case "guardian":
      return row.showsGuardian ? csvText(row.parentName) : ""
    case "dob":
      return csvText(row.dateOfBirth)?.slice(0, 10) || ""
    case "age":
      return row.age == null ? "" : String(row.age)
    case "gender":
      return csvText(row.gender)
    case "allergies":
      return csvText(row.allergies)
    case "photoConsent":
      return csvText(row.photoConsent)
    case "program":
      return csvText(row.yearSeasonName)
    case "offering":
      return csvText(row.courseName)
    case "teacher":
      return csvText(row.teacherName)
    case "status":
      return displayEnrollmentStatusLabel(row.status)
    case "registered":
      return csvText(row.registeredAt)?.slice(0, 10) || csvText(row.registeredAt)
    case "actions":
      return ""
  }
}

export function getRegistrationDisplayValue(
  row: RegistrationTableValueRow,
  columnId: RegistrationColumnId
): string {
  switch (columnId) {
    case "participant":
      return displayCell(row.studentName)
    case "email":
      return displayCell(registrationContactEmail(row))
    case "phone":
      return displayCell(registrationContactPhone(row))
    case "guardian":
      return row.showsGuardian ? displayCell(row.parentName) : EMPTY_CELL
    case "dob":
      return formatDateOfBirth(row.dateOfBirth)
    case "age":
      return displayCell(row.age)
    case "gender":
      return displayCell(row.gender)
    case "allergies":
      return displayCell(row.allergies)
    case "photoConsent":
      return displayCell(row.photoConsent)
    case "program":
      return displayCell(row.yearSeasonName)
    case "offering":
      return displayCell(row.courseName)
    case "teacher":
      return displayCell(row.teacherName)
    case "status":
      return displayEnrollmentStatusLabel(row.status)
    case "registered":
      return formatRegistrationDate(row.registeredAt)
    case "actions":
      return ""
  }
}

export function registrationDateKey(value: string | null | undefined) {
  if (!value) return null
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value)
  return match?.[1] || null
}
