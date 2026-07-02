import type {
  ContactRecordType,
  ContactRoleValue,
  ContactStatus,
} from "@/lib/contacts/contact-constants"
import type { ContactListRow } from "@/lib/contacts/contact-list-actions"

export type ContactDirectoryReportFilters = {
  search?: string
  recordType?: ContactRecordType | "all"
  role?: ContactRoleValue | "all"
  status?: ContactStatus | "all"
  teamId?: string | "all"
}

export type ContactDirectoryReportSummary = {
  total: number
  people: number
  organizations: number
  groups: number
}

export type ContactDirectoryExportRow = ContactListRow & {
  address: string
  city: string
  state: string
  zip: string
  country: string
}

export type ContactReportTeamOption = {
  id: string
  name: string
}
