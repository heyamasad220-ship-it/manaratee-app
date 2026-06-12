import { VendorHubSectionPlaceholder } from "@/components/vendor-hub/vendor-hub-section-placeholder"

export default function EventAnnouncementsPage() {
  return (
    <VendorHubSectionPlaceholder
      title="Announcements"
      description="Broadcast announcements to vendors during the event."
      todo="Add vendor_hub_announcements table with event_id, message, and delivery status."
    />
  )
}
