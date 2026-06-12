import { VendorNetworkSectionShell } from "@/components/vendor-hub/vendor-network-section-shell"
import { VENDOR_NETWORK_TABS } from "@/lib/vendor-hub/vendor-hub-nav"

export default function VendorNetworkLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <VendorNetworkSectionShell
      title="Vendor Network"
      description="Reusable vendor relationships across bazaars. CRM contacts are the source of truth for vendor identity."
      tabs={VENDOR_NETWORK_TABS}
    >
      {children}
    </VendorNetworkSectionShell>
  )
}
