export type DirectoryRoleDistributionRow = {
  key: string
  label: string
  count: number
}

export type DirectoryCompletenessStats = {
  people: number
  missingEmail: number
  missingPhone: number
  missingAddress: number
  noRole: number
}

export type DirectoryGrowthPoint = {
  month: string
  people: number
  organizations: number
}

export type DirectoryDuplicateRow = {
  key: string
  matchType: "email" | "phone"
  value: string
  contactIds: string[]
  names: string[]
}
