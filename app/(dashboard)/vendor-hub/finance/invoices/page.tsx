import { VendorHubSectionPlaceholder } from "@/components/vendor-hub/vendor-hub-section-placeholder"

export default function FinanceInvoicesPage() {
  return (
    <VendorHubSectionPlaceholder
      title="Invoices"
      description="Booth fee invoices derived from booth assignments."
      todo="Treat vendor_hub_booth_assignments.fee_amount as invoice line items until a dedicated vendor_hub_invoices table is added."
    />
  )
}
