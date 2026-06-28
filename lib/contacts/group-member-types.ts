export type GroupMemberRow = {
  id: string
  memberContactId: string
  memberName: string | null
  memberEmail: string | null
  memberPhone: string | null
  status: string
  notes: string | null
  totalDonations: number
  donationCount: number
  lastDonationDate: string | null
}

export type ContactGroupSummary = {
  id: string
  groupName: string | null
  memberStatus: string
}

export type GroupGivingRollup = {
  groupDirectTotal: number
  groupDirectCount: number
  groupDirectLast: string | null
  memberIndividualTotal: number
  memberIndividualCount: number
  combinedTotal: number
  memberCount: number
  members: GroupMemberRow[]
}
