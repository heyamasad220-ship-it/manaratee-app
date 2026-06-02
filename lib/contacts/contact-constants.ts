import type { LucideIcon } from "lucide-react"
import {
  Briefcase,
  Calendar,
  Heart,
  Store,
  UserCheck,
  Wrench,
} from "lucide-react"

/** Stable affiliations — customer is NOT a role (inferred from transactions). */
export const CONTACT_ROLE_VALUES = [
  "donor",
  "volunteer",
  "employee",
  "member",
  "vendor",
  "service_provider",
] as const

export type ContactRoleValue = (typeof CONTACT_ROLE_VALUES)[number]

export type ContactRoleLabel =
  | "Donor"
  | "Volunteer"
  | "Employee"
  | "Member"
  | "Vendor"
  | "Service Provider"

/** Legacy role values kept out of UI and new assignments. */
export const EXCLUDED_CONTACT_ROLES = ["customer"] as const

export type ContactRecordType = "individual" | "organization"

export type ContactStatus =
  | "Active"
  | "Inactive"
  | "VIP"
  | "Pending"
  | "Major Donor"

export const ROLE_VALUE_TO_LABEL: Record<ContactRoleValue, ContactRoleLabel> = {
  donor: "Donor",
  volunteer: "Volunteer",
  employee: "Employee",
  member: "Member",
  vendor: "Vendor",
  service_provider: "Service Provider",
}

export const ROLE_LABEL_TO_VALUE: Record<ContactRoleLabel, ContactRoleValue> = {
  Donor: "donor",
  Volunteer: "volunteer",
  Employee: "employee",
  Member: "member",
  Vendor: "vendor",
  "Service Provider": "service_provider",
}

export const ROLE_OPTIONS: { label: ContactRoleLabel; value: ContactRoleValue }[] =
  CONTACT_ROLE_VALUES.map((value) => ({
    label: ROLE_VALUE_TO_LABEL[value],
    value,
  }))

export const ROLE_COLORS: Record<ContactRoleLabel, string> = {
  Donor: "bg-rose-100 text-rose-700",
  Volunteer: "bg-emerald-100 text-emerald-700",
  Employee: "bg-sky-100 text-sky-700",
  Member: "bg-indigo-100 text-indigo-700",
  Vendor: "bg-amber-100 text-amber-700",
  "Service Provider": "bg-purple-100 text-purple-700",
}

export const ROLE_ICONS: Record<ContactRoleLabel, LucideIcon> = {
  Donor: Heart,
  Volunteer: Calendar,
  Employee: Briefcase,
  Member: UserCheck,
  Vendor: Store,
  "Service Provider": Wrench,
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

export function sanitizeRoleInput(roles: ContactRoleValue[]): ContactRoleValue[] {
  return filterContactRoles(roles)
}
