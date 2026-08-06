export type VendorHubEventStatus = "draft" | "published" | "completed" | "cancelled"

export type VendorHubCalendarStatus = "not_published" | "published" | "hidden"

export type VendorHubParticipantLifecycleStatus =
  | "lead"
  | "applied"
  | "under_review"
  | "approved"
  | "waitlisted"
  | "rejected"
  | "assigned"
  | "payment_pending"
  | "paid"
  | "checked_in"
  | "cancelled"

/** Event participation row — always keyed by CRM contact_id. */
export type VendorHubParticipantStatus = {
  id: string
  organization_id: string
  vendor_hub_event_id: string
  contact_id: string
  application_id: string | null
  lifecycle_status: VendorHubParticipantLifecycleStatus
  notes: string | null
}

export type VendorHubEventRecord = {
  id: string
  name: string
  event_date: string | null
  start_time: string | null
  end_time: string | null
  location: string | null
  description: string | null
  expected_attendees: number | null
  total_booths: number | null
  status: string | null
  calendar_status: string | null
  event_type: string | null
  flyer_url: string | null
  public_share_token: string | null
  organization_id: string | null
  internal_event_id: string | null
  organizer_contact_id: string | null
  organizer_name: string | null
  venue_id: string | null
  created_at: string | null
  updated_at: string | null
}

export type VendorHubOrganizerContact = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
}

export type VendorHubEventWithInternal = VendorHubEventRecord & {
  internal_event?: {
    id: string
    name: string
    start_at: string | null
    end_at: string | null
    location_label: string | null
    status: string
  } | null
  organizer_contact?: VendorHubOrganizerContact | null
  venue_name?: string | null
}

export type VendorHubDashboardMetrics = {
  applicationsPendingReview: number
  approvedVendors: number
  boothsTotal: number
  boothsAssigned: number
  revenueCollected: number
  outstandingBalance: number
  vendorsMissingDocuments: number
  vendorsMissingPayment: number
  vendorsPendingEvaluation: number
  vendorsParticipated: number
}

/** Booth reservation for a single bazaar event (approved org vendor, no re-application). */
export type BazaarEventReservationRow = {
  id: string
  contactId: string
  vendorName: string
  vendorEmail: string | null
  lifecycleStatus: string
  boothNumber: string | null
  feeAmount: number | null
  assignmentStatus: string | null
  reservedAt: string | null
}
