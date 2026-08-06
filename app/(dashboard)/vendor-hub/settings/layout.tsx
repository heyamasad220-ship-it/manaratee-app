import { VendorHubSectionShell } from "@/components/vendor-hub/vendor-hub-section-shell"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"

export default async function VendorHubSettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireVendorHubManage()

  return (
    <VendorHubSectionShell
      title="Settings"
      description="Configure vendor hub defaults, booths, applications, payments, and public page."
      showEventSelector={false}
    >
      {children}
    </VendorHubSectionShell>
  )
}
