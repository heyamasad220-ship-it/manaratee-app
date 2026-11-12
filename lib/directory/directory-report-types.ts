export type DirectoryDuplicateRow = {
  key: string
  matchType: "email" | "phone"
  value: string
  contactIds: string[]
  names: string[]
}

export type DirectoryNewContactPeriod = "month" | "30d" | "12m"

export type DirectoryNewContactRow = {
  id: string
  name: string
  kind: "person" | "organization"
  createdAt: string
}

export type DirectoryNewContactsPage = {
  period: DirectoryNewContactPeriod
  peopleCount: number
  organizationCount: number
  total: number
  page: number
  pageSize: number
  contacts: DirectoryNewContactRow[]
}
