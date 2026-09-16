import type {
  ContactRecordType,
  ContactRoleValue,
  ContactStatus,
} from "@/lib/contacts/contact-constants"
import type { ContactListRow, ContactListSortBy } from "@/lib/contacts/contact-list-types"

export type ContactDirectoryReportFilters = {
  search?: string
  nameFilter?: string
  recordType?: ContactRecordType | "all"
  lockedRecordType?: ContactRecordType
  role?: ContactRoleValue | "all"
  status?: ContactStatus | "all"
  teamId?: string | "all"
  sortBy?: ContactListSortBy
  sortAsc?: boolean
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
