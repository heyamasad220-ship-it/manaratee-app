import { FULL_TIME_EMPLOYEE_DISCOUNT_TAG_NAME } from "@/lib/benefits/employee-benefit-constants"

/**
 * Discount tags that come from workforce / membership status — not staff-picked.
 * Mirror CONTACT_MANUAL_AFFILIATION_ROLES: employment & membership are activity-derived.
 */
const SYSTEM_MANAGED_DISCOUNT_TAG_NAMES = [
  FULL_TIME_EMPLOYEE_DISCOUNT_TAG_NAME,
  "Employee",
  "Staff",
  "Member",
  "Volunteer",
] as const

/** Special-case tags staff may still assign manually (same spirit as Donor affiliation). */
const MANUAL_SPECIAL_CASE_DISCOUNT_TAG_NAMES = [
  "Donor",
  "Service Provider",
] as const

function normalizeTagName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

const SYSTEM_MANAGED_NORMALIZED = new Set(
  SYSTEM_MANAGED_DISCOUNT_TAG_NAMES.map((name) => normalizeTagName(name))
)

const MANUAL_SPECIAL_CASE_NORMALIZED = new Set(
  MANUAL_SPECIAL_CASE_DISCOUNT_TAG_NAMES.map((name) => normalizeTagName(name))
)

export function isSystemManagedDiscountTagName(name: string | null | undefined) {
  if (!name) return false
  return SYSTEM_MANAGED_NORMALIZED.has(normalizeTagName(name))
}

export function isManualSpecialCaseDiscountTagName(
  name: string | null | undefined
) {
  if (!name) return false
  return MANUAL_SPECIAL_CASE_NORMALIZED.has(normalizeTagName(name))
}

/** True when staff may pick this tag on the contact profile. */
export function isManuallyAssignableDiscountTagName(
  name: string | null | undefined
) {
  if (!name) return false
  return !isSystemManagedDiscountTagName(name)
}

export function filterManuallyAssignableDiscountTags<T extends { name: string }>(
  tags: T[]
): T[] {
  return tags.filter((tag) => isManuallyAssignableDiscountTagName(tag.name))
}

export function filterSystemManagedDiscountTags<T extends { name: string }>(
  tags: T[]
): T[] {
  return tags.filter((tag) => isSystemManagedDiscountTagName(tag.name))
}

export function systemManagedDiscountTagAssignError(tagName: string) {
  const normalized = normalizeTagName(tagName)
  if (normalized === normalizeTagName(FULL_TIME_EMPLOYEE_DISCOUNT_TAG_NAME)) {
    return "Full-Time Employee is applied automatically when this person is an active full-time employee. Add them under Workforce first."
  }
  if (normalized === "member") {
    return "Member is applied automatically from an active membership. Add a membership first."
  }
  if (normalized === "employee" || normalized === "staff") {
    return "Employee/Staff tags are applied automatically from Workforce status. Add them as staff first."
  }
  if (normalized === "volunteer") {
    return "Volunteer is applied automatically from volunteer workforce status."
  }
  return `"${tagName}" is system-managed and cannot be assigned manually.`
}
