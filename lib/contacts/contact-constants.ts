import type { LucideIcon } from "lucide-react"
import {
  Baby,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Heart,
  Store,
  UserCheck,
  Wrench,
} from "lucide-react"

/** Affiliations staff can add or remove manually on a contact profile. */
export const CONTACT_MANUAL_AFFILIATION_ROLES = [
  "donor",
  "service_provider",
] as const

/** All stored affiliation roles for individual contacts (manual + activity-derived). */
export const CONTACT_PERSON_AFFILIATION_ROLES = [
  ...CONTACT_MANUAL_AFFILIATION_ROLES,
  "vendor",
  "childcare_provider",
] as const

/** @deprecated Use CONTACT_MANUAL_AFFILIATION_ROLES for editable forms. */
export const CONTACT_AFFILIATION_ROLES = CONTACT_MANUAL_AFFILIATION_ROLES

/** Derived from active membership records — not manually assigned. */
export const MEMBERSHIP_DERIVED_ROLE = "member" as const

/** Affiliations for organization contacts only. */
export const CONTACT_ORGANIZATION_AFFILIATION_ROLES = [
  "donor",
  "customer",
  "service_provider",
] as const

/** Affiliations for group contacts (community collectives). */
export const CONTACT_GROUP_AFFILIATION_ROLES = CONTACT_ORGANIZATION_AFFILIATION_ROLES

/** Workforce roles managed under Workforce module — not assigned via Contacts CRM. */
export const CONTACT_WORKFORCE_ROLES = ["employee", "volunteer"] as const

/** Activity-derived customer role (events/ticketing + venue rentals). */
export const CONTACT_CUSTOMER_ROLE = "customer" as const

/** Activity-derived Programs affiliation (enrollments: participant or parent registrant). */
export const CONTACT_PROGRAM_PARTICIPANT_ROLE = "program_participant" as const

/** Participation roles derived from enrollments, ticketing, rentals (not manual CRM picks). */
export const CONTACT_PARTICIPATION_DERIVED_ROLES = [
  CONTACT_CUSTOMER_ROLE,
  CONTACT_PROGRAM_PARTICIPANT_ROLE,
] as const

/** All contact role values (including membership-derived member tag). */
export const CONTACT_ROLE_VALUES = [
  ...CONTACT_PERSON_AFFILIATION_ROLES,
  MEMBERSHIP_DERIVED_ROLE,
  CONTACT_CUSTOMER_ROLE,
  CONTACT_PROGRAM_PARTICIPANT_ROLE,
  ...CONTACT_WORKFORCE_ROLES,
] as const

export type ContactRoleValue = (typeof CONTACT_ROLE_VALUES)[number]

export type ContactRoleLabel =
  | "Donor"
  | "Customer"
  | "Programs"
  | "Volunteer"
  | "Employee"
  | "Member"
  | "Vendor"
  | "Child Care Provider"
  | "Service Provider"

export type ContactRecordType = "individual" | "organization" | "group"

export function normalizeContactRecordType(
  value: string | null | undefined
): ContactRecordType {
  if (value === "organization") return "organization"
  if (value === "group") return "group"
  return "individual"
}

export function isEntityContactType(
  value: ContactRecordType | string | null | undefined
): value is "organization" | "group" {
  return value === "organization" || value === "group"
}

export function usesPrimaryContactField(
  value: ContactRecordType | string | null | undefined
): boolean {
  return isEntityContactType(value)
}

export function getContactRecordTypeLabel(value: ContactRecordType | string | null | undefined): string {
  const type = normalizeContactRecordType(value)
  if (type === "organization") return "Organization"
  if (type === "group") return "Group"
  return "Individual"
}

export type ContactStatus = "Active" | "Inactive"

export const ROLE_VALUE_TO_LABEL: Record<ContactRoleValue, ContactRoleLabel> = {
  donor: "Donor",
  customer: "Customer",
  program_participant: "Programs",
  volunteer: "Volunteer",
  employee: "Employee",
  member: "Member",
  vendor: "Vendor",
  childcare_provider: "Child Care Provider",
  service_provider: "Service Provider",
}

export const ROLE_LABEL_TO_VALUE: Record<ContactRoleLabel, ContactRoleValue> = {
  Donor: "donor",
  Customer: "customer",
  Programs: "program_participant",
  Volunteer: "volunteer",
  Employee: "employee",
  Member: "member",
  Vendor: "vendor",
  "Child Care Provider": "childcare_provider",
  "Service Provider": "service_provider",
}

const INDIVIDUAL_AFFILIATION_OPTIONS: { label: ContactRoleLabel; value: ContactRoleValue }[] =
  CONTACT_MANUAL_AFFILIATION_ROLES.map((value) => ({
    label: ROLE_VALUE_TO_LABEL[value],
    value,
  }))

const INDIVIDUAL_ROLE_OPTIONS: { label: ContactRoleLabel; value: ContactRoleValue }[] = [
  ...INDIVIDUAL_AFFILIATION_OPTIONS,
  ...CONTACT_WORKFORCE_ROLES.map((value) => ({
    label: ROLE_VALUE_TO_LABEL[value],
    value,
  })),
]

const ORGANIZATION_ROLE_OPTIONS: { label: ContactRoleLabel; value: ContactRoleValue }[] =
  CONTACT_ORGANIZATION_AFFILIATION_ROLES.map((value) => ({
    label: ROLE_VALUE_TO_LABEL[value],
    value,
  }))

const GROUP_ROLE_OPTIONS: { label: ContactRoleLabel; value: ContactRoleValue }[] =
  CONTACT_GROUP_AFFILIATION_ROLES.map((value) => ({
    label: ROLE_VALUE_TO_LABEL[value],
    value,
  }))

/** Affiliations staff can assign from Contacts add/edit forms (excludes workforce + membership). */
export function getContactsCrmRoleOptions(
  recordType: ContactRecordType | "all" = "all"
): { label: ContactRoleLabel; value: ContactRoleValue }[] {
  if (recordType === "organization") {
    return ORGANIZATION_ROLE_OPTIONS
  }
  if (recordType === "group") {
    return GROUP_ROLE_OPTIONS
  }
  return INDIVIDUAL_AFFILIATION_OPTIONS
}

/** Affiliations staff can assign manually on the contact profile (membership is managed separately). */
export function getEditableRoleOptionsForRecordType(
  recordType: ContactRecordType | "all" = "all"
): { label: ContactRoleLabel; value: ContactRoleValue }[] {
  return getContactsCrmRoleOptions(recordType)
}

export function isWorkforceRole(role: ContactRoleValue): role is (typeof CONTACT_WORKFORCE_ROLES)[number] {
  return (CONTACT_WORKFORCE_ROLES as readonly string[]).includes(role)
}

/** Default role picker options (people + mixed contact lists). */
export const ROLE_OPTIONS = INDIVIDUAL_ROLE_OPTIONS

/** Role filter options for contact list pages (includes activity-derived roles). */
export function getRoleFilterOptionsForRecordType(
  recordType: ContactRecordType | "all" = "all"
): { label: ContactRoleLabel; value: ContactRoleValue }[] {
  if (recordType === "organization") {
    return ORGANIZATION_ROLE_OPTIONS
  }
  if (recordType === "group") {
    return GROUP_ROLE_OPTIONS
  }
  if (recordType === "individual") {
    return getAllowedRolesForRecordType("individual")
      .map((value) => ({
        label: ROLE_VALUE_TO_LABEL[value],
        value,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }

  const values = new Set<ContactRoleValue>()
  for (const role of getAllowedRolesForRecordType("individual")) {
    values.add(role)
  }
  for (const role of CONTACT_ORGANIZATION_AFFILIATION_ROLES) {
    values.add(role)
  }

  return Array.from(values)
    .map((value) => ({
      label: ROLE_VALUE_TO_LABEL[value],
      value,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function getRoleOptionsForRecordType(
  recordType: ContactRecordType | "all" = "all"
): { label: ContactRoleLabel; value: ContactRoleValue }[] {
  if (recordType === "organization") {
    return ORGANIZATION_ROLE_OPTIONS
  }
  if (recordType === "group") {
    return GROUP_ROLE_OPTIONS
  }
  return INDIVIDUAL_ROLE_OPTIONS
}

export function getAllowedRolesForRecordType(
  recordType: ContactRecordType
): ContactRoleValue[] {
  if (recordType === "organization") {
    return [...CONTACT_ORGANIZATION_AFFILIATION_ROLES]
  }
  if (recordType === "group") {
    return [...CONTACT_GROUP_AFFILIATION_ROLES]
  }
  return [...CONTACT_ROLE_VALUES]
}

/** Roles staff may assign manually (membership manages the member tag). */
export function getEditableAllowedRolesForRecordType(
  recordType: ContactRecordType
): ContactRoleValue[] {
  return getAllowedRolesForRecordType(recordType).filter((role) => {
    if (role === MEMBERSHIP_DERIVED_ROLE) return false
    if (
      recordType === "individual" &&
      (CONTACT_PARTICIPATION_DERIVED_ROLES as readonly string[]).includes(role)
    ) {
      return false
    }
    return true
  })
}

export const ROLE_COLORS: Record<ContactRoleLabel, string> = {
  Donor: "bg-rose-100 text-rose-700",
  Customer: "bg-orange-100 text-orange-700",
  Programs: "bg-blue-100 text-blue-700",
  Volunteer: "bg-emerald-100 text-emerald-700",
  Employee: "bg-sky-100 text-sky-700",
  Member: "bg-indigo-100 text-indigo-700",
  Vendor: "bg-amber-100 text-amber-700",
  "Child Care Provider": "bg-teal-100 text-teal-700",
  "Service Provider": "bg-purple-100 text-purple-700",
}

export const ROLE_ICONS: Record<ContactRoleLabel, LucideIcon> = {
  Donor: Heart,
  Customer: Building2,
  Programs: BookOpen,
  Volunteer: Calendar,
  Employee: Briefcase,
  Member: UserCheck,
  Vendor: Store,
  "Child Care Provider": Baby,
  "Service Provider": Wrench,
}

export const STATUS_COLORS: Record<ContactStatus, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-gray-100 text-gray-700",
}

export const STATUS_OPTIONS: { label: ContactStatus; value: string }[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
]

export function isContactRole(value: string): value is ContactRoleValue {
  return (CONTACT_ROLE_VALUES as readonly string[]).includes(value)
}

export function filterContactRoles(roles: string[]): ContactRoleValue[] {
  return Array.from(new Set(roles.filter(isContactRole)))
}

export function mapRoleValue(role?: string | null): ContactRoleLabel | null {
  if (role === "program_participant") {
    return "Programs"
  }
  if (role === "event_attendee" || role === "venue_rental_customer") {
    return "Customer"
  }
  if (role && isContactRole(role)) {
    return ROLE_VALUE_TO_LABEL[role]
  }
  return null
}

export function mapStatus(status?: string | null): ContactStatus {
  const cleanStatus = (status || "active").toLowerCase()
  if (cleanStatus === "inactive") return "Inactive"
  return "Active"
}

export function statusToDbValue(status: ContactStatus) {
  return status.toLowerCase()
}

export function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { first_name: "Unknown", last_name: "" }
  }
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: "" }
  }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  }
}

/** Re-export person-name casing helpers used by contact create/update flows. */
export {
  properCasePersonNameIfNeeded,
  shouldProperCasePersonName,
  toProperPersonName,
} from "@/lib/contacts/proper-case-name"

export function normalizePhone(phone?: string | null) {
  return (phone || "").replace(/[^\d]/g, "")
}

export function sanitizeRoleInput(
  roles: ContactRoleValue[],
  recordType: ContactRecordType = "individual"
): ContactRoleValue[] {
  const allowed = new Set(getAllowedRolesForRecordType(recordType))
  return filterContactRoles(roles).filter((role) => allowed.has(role))
}
