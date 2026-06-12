import { VendorHubSectionPlaceholder } from "@/components/vendor-hub/vendor-hub-section-placeholder"

export default function EventAttendancePage() {
  return (
    <VendorHubSectionPlaceholder
      title="Attendance"
      description="Track vendor booth attendance and no-shows during the event."
      todo="Add vendor_hub_attendance table with event_id, contact_id, and timestamp in a future migration."
    />
  )
}
