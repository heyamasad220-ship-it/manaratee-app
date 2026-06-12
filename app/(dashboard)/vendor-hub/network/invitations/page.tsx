import { VendorHubSectionPlaceholder } from "@/components/vendor-hub/vendor-hub-section-placeholder"

export default function VendorNetworkInvitationsPage() {
  return (
    <VendorHubSectionPlaceholder
      title="Vendor Invitations"
      description="Invite previous vendors to upcoming bazaars by event, category, or participation history."
      todo="Requires vendor_hub_invitations table (future migration). Invitations will always reference CRM contact_id."
    />
  )
}
