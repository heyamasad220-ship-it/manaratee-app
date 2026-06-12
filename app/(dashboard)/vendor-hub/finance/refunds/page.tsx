import { VendorHubSectionPlaceholder } from "@/components/vendor-hub/vendor-hub-section-placeholder"

export default function FinanceRefundsPage() {
  return (
    <VendorHubSectionPlaceholder
      title="Refunds"
      description="Refund requests and processed refunds for vendor payments."
      todo="Add refund status tracking on vendor_hub_payments or a vendor_hub_refunds table."
    />
  )
}
