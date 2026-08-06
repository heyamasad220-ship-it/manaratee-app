import type {
  ContactDonorStats,
  ContactRentalStats,
  ContactTimelineItem,
  ContactVendorStats,
} from "@/lib/contacts/contact-profile-data"

/** Timeline modules that alone do not block contact deletion. */
const DELETE_ALLOWED_TIMELINE_MODULES = new Set(["Contacts", "Roles"])

export type ContactDeleteBlockersInput = {
  familyMemberCount: number
  timeline: ContactTimelineItem[]
  donorStats: ContactDonorStats | null | undefined
  rentalStats: ContactRentalStats | null | undefined
  vendorStats: ContactVendorStats | null | undefined
  enrollmentCount: number
  activeTeamsCount: number
}

export type ContactDeleteEligibility = {
  allowed: boolean
  reasons: string[]
}

/**
 * Contacts may be deleted only when they have no family members, no financial /
 * module activity, and no non-core timeline events (Notes, Donations, etc.).
 */
export function getContactDeleteEligibility(
  input: ContactDeleteBlockersInput
): ContactDeleteEligibility {
  const reasons: string[] = []

  if (input.familyMemberCount > 0) {
    reasons.push(
      input.familyMemberCount === 1
        ? "This contact has a family member"
        : `This contact has ${input.familyMemberCount} family members`
    )
  }

  const donor = input.donorStats
  if (
    donor &&
    (donor.donationCount > 0 || donor.totalDonated > 0 || donor.pledgeCount > 0)
  ) {
    reasons.push("This contact has donation or pledge activity")
  }

  if ((input.rentalStats?.rentalCount ?? 0) > 0) {
    reasons.push("This contact has venue rental activity")
  }

  const vendor = input.vendorStats
  if (
    vendor &&
    (vendor.activityCount > 0 ||
      vendor.paymentCount > 0 ||
      vendor.participationCount > 0 ||
      vendor.applicationCount > 0)
  ) {
    reasons.push("This contact has Vendor Hub activity")
  }

  if (input.enrollmentCount > 0) {
    reasons.push("This contact has program enrollments")
  }

  if (input.activeTeamsCount > 0) {
    reasons.push("This contact has membership group activity")
  }

  const blockingTimeline = input.timeline.filter(
    (item) => !DELETE_ALLOWED_TIMELINE_MODULES.has(item.module)
  )
  if (blockingTimeline.length > 0) {
    reasons.push("This contact has notes or other recorded activity")
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  }
}
