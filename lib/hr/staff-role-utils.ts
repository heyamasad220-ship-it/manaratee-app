import type { ContactRoleValue } from "@/lib/contacts/contact-constants"

export const EMPLOYMENT_STAFF_TYPES = [
  "full_time",
  "part_time",
  "temporary",
  "contract",
  "seasonal",
] as const

export type EmploymentStaffType = (typeof EMPLOYMENT_STAFF_TYPES)[number]

/** Legacy values stored in staff.staff_type before employment vs program role was split. */
export const LEGACY_PROGRAM_STAFF_TYPES = [
  "instructor",
  "assistant",
  "volunteer",
] as const

export type LegacyProgramStaffType = (typeof LEGACY_PROGRAM_STAFF_TYPES)[number]

export type ProgramRole =
  | "instructor"
  | "assistant"
  | "volunteer"
  | "childcare"

export const PROGRAM_ROLE_OPTIONS: { value: ProgramRole; label: string }[] = [
  { value: "instructor", label: "Instructor" },
  { value: "assistant", label: "Assistant" },
  { value: "volunteer", label: "Volunteer" },
  { value: "childcare", label: "Child Care" },
]

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentStaffType, string> = {
  full_time: "Full-Time",
  part_time: "Part-Time",
  temporary: "Temporary",
  contract: "Contract",
  seasonal: "Seasonal",
}

export const PROGRAM_ROLE_LABELS: Record<ProgramRole, string> = {
  instructor: "Instructor",
  assistant: "Assistant",
  volunteer: "Volunteer",
  childcare: "Child Care",
}

const PROGRAM_ROLE_KEYWORDS: Record<ProgramRole, string[]> = {
  instructor: ["instructor", "teacher"],
  assistant: ["assistant", "aide"],
  volunteer: ["volunteer"],
  childcare: ["child care", "childcare", "child-care"],
}

export function isEmploymentStaffType(value: string | null | undefined): value is EmploymentStaffType {
  return Boolean(value && EMPLOYMENT_STAFF_TYPES.includes(value as EmploymentStaffType))
}

export function isLegacyProgramStaffType(
  value: string | null | undefined
): value is LegacyProgramStaffType {
  return Boolean(value && LEGACY_PROGRAM_STAFF_TYPES.includes(value as LegacyProgramStaffType))
}

export function normalizeEmploymentStaffType(
  staffType: string | null | undefined
): EmploymentStaffType {
  if (isEmploymentStaffType(staffType)) {
    return staffType
  }
  return "full_time"
}

function matchProgramRoleFromText(value: string | null | undefined): ProgramRole | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null

  for (const role of PROGRAM_ROLE_OPTIONS) {
    const keywords = PROGRAM_ROLE_KEYWORDS[role.value]
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return role.value
    }
  }

  return null
}

export function resolveProgramRole(input: {
  staffType?: string | null
  hrJobRoleName?: string | null
  contactRoles?: ContactRoleValue[]
}): ProgramRole | null {
  if (isLegacyProgramStaffType(input.staffType)) {
    return input.staffType
  }

  const fromJobRole = matchProgramRoleFromText(input.hrJobRoleName)
  if (fromJobRole) return fromJobRole

  if (input.contactRoles?.includes("childcare_provider")) {
    return "childcare"
  }

  if (input.contactRoles?.includes("volunteer")) {
    return "volunteer"
  }

  return null
}

export function canHaveProgramStaffAssignments(input: {
  staffType?: string | null
  hrJobRoleName?: string | null
  contactRoles?: ContactRoleValue[]
}): boolean {
  return resolveProgramRole(input) !== null
}

export function findHrJobRoleIdForProgramRole(
  hrJobRoles: { id: string; name: string }[],
  programRole: ProgramRole | null
): string | null {
  if (!programRole) return null

  const exact = hrJobRoles.find(
    (role) => role.name.trim().toLowerCase() === PROGRAM_ROLE_LABELS[programRole].toLowerCase()
  )
  if (exact) return exact.id

  const fuzzy = hrJobRoles.find((role) => matchProgramRoleFromText(role.name) === programRole)
  return fuzzy?.id ?? null
}

export function getEmploymentTypeLabel(staffType: string | null | undefined): string | null {
  if (!isEmploymentStaffType(staffType)) return null
  return EMPLOYMENT_TYPE_LABELS[staffType]
}

export function getProgramRoleLabel(input: {
  staffType?: string | null
  hrJobRoleName?: string | null
  contactRoles?: ContactRoleValue[]
}): string | null {
  const role = resolveProgramRole(input)
  return role ? PROGRAM_ROLE_LABELS[role] : null
}
