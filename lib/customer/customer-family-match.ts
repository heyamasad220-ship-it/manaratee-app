import { normalizeDateOfBirth } from "@/lib/dates/date-input-utils"

export type CustomerFamilyMemberIdentity = {
  firstName: string
  lastName: string
  gender?: string | null
  dateOfBirth?: string | null
  relationship: string
}

function normalizeName(value: string | null | undefined) {
  return (value || "").trim().toLowerCase()
}

function normalizeOptional(value: string | null | undefined) {
  return (value || "").trim().toLowerCase()
}

function normalizeBirthDate(value: string | null | undefined) {
  try {
    return normalizeDateOfBirth(value, { required: false }) || ""
  } catch {
    return (value || "").trim()
  }
}

export function isDuplicateCustomerFamilyMember(
  existing: CustomerFamilyMemberIdentity,
  incoming: CustomerFamilyMemberIdentity
) {
  return (
    normalizeName(existing.firstName) === normalizeName(incoming.firstName) &&
    normalizeName(existing.lastName) === normalizeName(incoming.lastName) &&
    normalizeOptional(existing.gender) === normalizeOptional(incoming.gender) &&
    normalizeBirthDate(existing.dateOfBirth) === normalizeBirthDate(incoming.dateOfBirth) &&
    normalizeOptional(existing.relationship) === normalizeOptional(incoming.relationship)
  )
}

export const DUPLICATE_FAMILY_MEMBER_ERROR = "This family member already exists."
