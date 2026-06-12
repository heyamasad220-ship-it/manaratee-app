import type { ApplicationStatus } from "@/lib/applications/application-types"
import type { VendorHubParticipantLifecycleStatus } from "@/lib/vendor-hub/vendor-hub-types"

/** Maps application workflow statuses to event-scoped vendor lifecycle labels. */
export function applicationStatusToLifecycleStatus(
  status: ApplicationStatus
): VendorHubParticipantLifecycleStatus {
  switch (status) {
    case "draft":
      return "lead"
    case "submitted":
      return "applied"
    case "pending_review":
      return "under_review"
    case "approved":
      return "approved"
    case "rejected":
      return "rejected"
    case "withdrawn":
      return "cancelled"
    default:
      return "lead"
  }
}

export const VENDOR_LIFECYCLE_LABELS: Record<VendorHubParticipantLifecycleStatus, string> = {
  lead: "Lead",
  applied: "Applied",
  under_review: "Under Review",
  approved: "Approved",
  waitlisted: "Waitlisted",
  rejected: "Rejected",
  assigned: "Assigned",
  payment_pending: "Payment Pending",
  paid: "Paid",
  checked_in: "Checked In",
  cancelled: "Cancelled",
}
