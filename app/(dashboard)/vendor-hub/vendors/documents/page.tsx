import { VendorHubSectionPlaceholder } from "@/components/vendor-hub/vendor-hub-section-placeholder"

export default function VendorHubDocumentsPage() {
  return (
    <VendorHubSectionPlaceholder
      title="Vendor Documents"
      description="Required documents and upload status for vendors in this event."
      todo="Aggregate application_documents by application.contact_id for vendor applications. Link to CRM contact profile for all document detail."
    />
  )
}
