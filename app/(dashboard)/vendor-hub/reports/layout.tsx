import { VendorHubSectionShell } from "@/components/vendor-hub/vendor-hub-section-shell"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function VendorHubReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermission(PERMISSIONS.REPORTS_VIEW)

  return (
    <VendorHubSectionShell
      title="Reports"
      description="Live booth fees, payments, and utilization from Vendor Hub events."
      showEventSelector={false}
    >
      {children}
    </VendorHubSectionShell>
  )
}
