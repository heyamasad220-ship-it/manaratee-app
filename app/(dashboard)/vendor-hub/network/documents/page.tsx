import { VendorHubSectionPlaceholder } from "@/components/vendor-hub/vendor-hub-section-placeholder"

export default function VendorNetworkDocumentsPage() {
  return (
    <VendorHubSectionPlaceholder
      title="Vendor Documents"
      description="Insurance, permits, and application documents for vendors in your network."
      todo="Aggregate application_documents by application.contact_id. Open document details via the linked CRM contact profile."
    />
  )
}
