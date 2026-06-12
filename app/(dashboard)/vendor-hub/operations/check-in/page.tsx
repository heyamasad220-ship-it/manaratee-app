import { VendorHubSectionPlaceholder } from "@/components/vendor-hub/vendor-hub-section-placeholder"

export default function EventCheckInPage() {
  return (
    <VendorHubSectionPlaceholder
      title="Vendor Check-In"
      description="Check vendors in on event day and update lifecycle status to checked_in."
      todo="Use vendor_hub_participant_status (migration 075) for check-in records and link to booth assignments."
    />
  )
}
