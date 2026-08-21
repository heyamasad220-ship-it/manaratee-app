import { PERMISSIONS, requireAnyPermission } from "@/lib/permissions/permissions"

export default async function DonationsPaymentsImportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAnyPermission(
    PERMISSIONS.DONATIONS_MANAGE,
    PERMISSIONS.DONATIONS_REPORTS_MANAGE
  )

  return <>{children}</>
}
