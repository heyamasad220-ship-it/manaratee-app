import type { LucideIcon } from "lucide-react"
import {
  Baby,
  Briefcase,
  Building2,
  Calendar,
  GraduationCap,
  Heart,
  Store,
  Ticket,
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

/** Workforce roles managed under Workforce module — not assigned via Contacts CRM. */
export const CONTACT_WORKFORCE_ROLES = ["employee", "volunteer"] as const

/** Participation roles derived from enrollments, ticketing, rentals (not manual CRM picks). */
export const CONTACT_PARTICIPATION_DERIVED_ROLES = [
  "event_attendee",
  "program_participant",
  "venue_rental_customer",
] as const

/** All contact role values (including membership-derived member tag). */
export const CONTACT_ROLE_VALUES = [
  ...CONTACT_PERSON_AFFILIATION_ROLES,
  MEMBERSHIP_DERIVED_ROLE,
  "customer",
  ...CONTACT_WORKFORCE_ROLES,
  ...CONTACT_PARTICIPATION_DERIVED_ROLES,
] as const

export type ContactRoleValue = (typeof CONTACT_ROLE_VALUES)[number]

export type ContactRoleLabel =
  | "Donor"
  | "Customer (Venue Renter)"
  | "Volunteer"
  | "Employee"
  | "Member"
  | "Vendor"
  | "Child Care Provider"
  | "Service Provider"
  | "Program Participant"
  | "Event Attendee"
  | "Venue Rental Customer"

export type ContactRecordType = "individual" | "organization"

export type ContactStatus =
  | "Active"
  | "Inactive"
  | "VIP"
  | "Pending"
  | "Major Donor"

export const ROLE_VALUE_TO_LABEL: Record<ContactRoleValue, ContactRoleLabel> = {
  donor: "Donor",
  customer: "Customer (Venue Renter)",
  volunteer: "Volunteer",
  employee: "Employee",
  member: "Member",
  vendor: "Vendor",
  childcare_provider: "Child Care Provider",
  service_provider: "Service Provider",
  program_participant: "Program Participant",
  event_attendee: "Event Attendee",
  venue_rental_customer: "Venue Rental Customer",
}

export const ROLE_LABEL_TO_VALUE: Record<ContactRoleLabel, ContactRoleValue> = {
  Donor: "donor",
  "Customer (Venue Renter)": "customer",
  Volunteer: "volunteer",
  Employee: "employee",
  Member: "member",
  Vendor: "vendor",
  "Child Care Provider": "childcare_provider",
  "Service Provider": "service_provider",
  "Program Participant": "program_participant",
  "Event Attendee": "event_attendee",
  "Venue Rental Customer": "venue_rental_customer",
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

/** Affiliations staff can assign from Contacts add/edit forms (excludes workforce + membership). */
export function getContactsCrmRoleOptions(
  recordType: ContactRecordType | "all" = "all"
): { label: ContactRoleLabel; value: ContactRoleValue }[] {
  if (recordType === "organization") {
    return ORGANIZATION_ROLE_OPTIONS
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

export function getRoleOptionsForRecordType(
  recordType: ContactRecordType | "all" = "all"
): { label: ContactRoleLabel; value: ContactRoleValue }[] {
  if (recordType === "organization") {
    return ORGANIZATION_ROLE_OPTIONS
  }
  return INDIVIDUAL_ROLE_OPTIONS
}

export function getAllowedRolesForRecordType(
  recordType: ContactRecordType
): ContactRoleValue[] {
  if (recordType === "organization") {
    return [...CONTACT_ORGANIZATION_AFFILIATION_ROLES]
  }
  return CONTACT_ROLE_VALUES.filter((role) => role !== "customer") as ContactRoleValue[]
}

/** Roles staff may assign manually (membership manages the member tag). */
export function getEditableAllowedRolesForRecordType(
  recordType: ContactRecordType
): ContactRoleValue[] {
  return getAllowedRolesForRecordType(recordType).filter(
    (role) =>
      role !== MEMBERSHIP_DERIVED_ROLE &&
      !(CONTACT_PARTICIPATION_DERIVED_ROLES as readonly string[]).includes(role)
  )
}

export const ROLE_COLORS: Record<ContactRoleLabel, string> = {
  Donor: "bg-rose-100 text-rose-700",
  "Customer (Venue Renter)": "bg-orange-100 text-orange-700",
  Volunteer: "bg-emerald-100 text-emerald-700",
  Employee: "bg-sky-100 text-sky-700",
  Member: "bg-indigo-100 text-indigo-700",
  Vendor: "bg-amber-100 text-amber-700",
  "Child Care Provider": "bg-teal-100 text-teal-700",
  "Service Provider": "bg-purple-100 text-purple-700",
  "Program Participant": "bg-violet-100 text-violet-700",
  "Event Attendee": "bg-cyan-100 text-cyan-700",
  "Venue Rental Customer": "bg-orange-100 text-orange-800",
}

export const ROLE_ICONS: Record<ContactRoleLabel, LucideIcon> = {
  Donor: Heart,
  "Customer (Venue Renter)": Building2,
  Volunteer: Calendar,
  Employee: Briefcase,
  Member: UserCheck,
  Vendor: Store,
  "Child Care Provider": Baby,
  "Service Provider": Wrench,
  "Program Participant": GraduationCap,
  "Event Attendee": Ticket,
  "Venue Rental Customer": Building2,
}

export const STATUS_COLORS: Record<ContactStatus, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-gray-100 text-gray-700",
  VIP: "bg-yellow-100 text-yellow-700",
  Pending: "bg-orange-100 text-orange-700",
  "Major Donor": "bg-purple-100 text-purple-700",
}

export const STATUS_OPTIONS: { label: ContactStatus; value: string }[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "VIP", value: "vip" },
  { label: "Pending", value: "pending" },
  { label: "Major Donor", value: "major_donor" },
]

export function isContactRole(value: string): value is ContactRoleValue {
  return (CONTACT_ROLE_VALUES as readonly string[]).includes(value)
}

export function filterContactRoles(roles: string[]): ContactRoleValue[] {
  return Array.from(new Set(roles.filter(isContactRole)))
}

export function mapRoleValue(role?: string | null): ContactRoleLabel | null {
  if (role && isContactRole(role)) {
    return ROLE_VALUE_TO_LABEL[role]
  }
  return null
}

export function mapStatus(status?: string | null): ContactStatus {
  const cleanStatus = (status || "active").toLowerCase()

  if (cleanStatus === "inactive") return "Inactive"
  if (cleanStatus === "pending") return "Pending"
  if (cleanStatus === "vip") return "VIP"
  if (cleanStatus === "major_donor" || cleanStatus === "major donor") return "Major Donor"

  return "Active"
}

export function statusToDbValue(status: ContactStatus) {
  if (status === "Major Donor") return "major_donor"
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
