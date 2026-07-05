export type FamilyMemberRole =
  | "head"
  | "spouse"
  | "child"
  | "parent"
  | "sibling"
  | "guardian"
  | "other"
  | "member"

export type FamilyMemberGivingRow = {
  id: string
  contactId: string
  memberName: string | null
  role: string
  totalDonations: number
  donationCount: number
  lastDonationDate: string | null
}

export type FamilyRecentGiftRow = {
  id: string
  contactId: string
  memberName: string | null
  amount: number
  paymentDate: string
  campaignName: string | null
}

export type FamilyGivingRollup = {
  familyId: string
  familyName: string
  status: string
  primaryContactId: string | null
  primaryName: string | null
  lifetimeTotal: number
  giftCount: number
  lastGiftDate: string | null
  memberCount: number
  members: FamilyMemberGivingRow[]
  recentGifts: FamilyRecentGiftRow[]
}

export type FamilyListSummary = {
  id: string
  name: string
  status: string
  primaryContactId: string | null
  primaryName: string | null
  primaryEmail: string | null
  memberCount: number
  lifetimeTotal: number
  giftCount: number
  lastGiftDate: string | null
}

export type HouseholdGivingReportRow = {
  familyId: string
  familyName: string
  primaryContactId: string | null
  primaryName: string
  memberCount: number
  totalDonations: number
  donationCount: number
  lastDonationDate: string | null
}
