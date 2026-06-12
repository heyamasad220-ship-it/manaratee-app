import { VendorHubSectionPlaceholder } from "@/components/vendor-hub/vendor-hub-section-placeholder"

export default function VendorHubWaitlistPage() {
  return (
    <VendorHubSectionPlaceholder
      title="Waitlist"
      description="Vendors on the waitlist for this event will appear here."
      todo="Use vendor_hub_participant_status with contact_id and lifecycle_status = waitlisted (migration 075/076)."
    />
  )
}
