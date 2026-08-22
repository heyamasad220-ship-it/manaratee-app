import type {
  ContactRecordType,
  ContactRoleLabel,
  ContactRoleValue,
  ContactStatus,
} from "@/lib/contacts/contact-constants"

export type ContactListTeamSummary = {
  id: string
  name: string
}

export type ContactListRow = {
  id: string
  name: string
  email: string
  phone: string
  primaryContactName: string
  recordType: ContactRecordType
  roles: ContactRoleLabel[]
  roleValues: ContactRoleValue[]
  status: ContactStatus
  createdAt: string
  updatedAt: string | null
  lastActivity: string | null
  teams: ContactListTeamSummary[]
  /** Directory role-view lookup fields (lifetime giving, department, etc.). */
  roleSummary?: { cells: Record<string, string> }
}

export type ContactListStats = {
  total: number
  people: number
  organizations: number
  groups: number
}

export type ContactListSortBy = "full_name" | "updated_at" | "created_at"

export type FetchContactsListInput = {
  search?: string
  nameFilter?: string
  role?: ContactRoleValue | "all"
  recordType?: ContactRecordType | "all"
  status?: ContactStatus | "all"
  teamId?: string | "all"
  sortBy?: ContactListSortBy
  sortAsc?: boolean
  page?: number
  pageSize?: number
  /** Page-scoped record type (e.g. People) — not treated as an active user filter. */
  lockedRecordType?: ContactRecordType
  /** Restrict to these contact ids (Directory derived role views). */
  contactIds?: string[]
}

export type FetchContactsListResult = {
  contacts: ContactListRow[]
  total: number
  page: number
  pageSize: number
  isRecentView: boolean
}
