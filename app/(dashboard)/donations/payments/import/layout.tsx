import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function DonationsPaymentsImportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermission(PERMISSIONS.DONATIONS_MANAGE)

  return <>{children}</>
}
