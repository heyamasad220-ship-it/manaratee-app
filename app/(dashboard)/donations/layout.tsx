import { PERMISSIONS, requireAnyPermission } from "@/lib/permissions/permissions"

export default async function DonationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAnyPermission(
    PERMISSIONS.DONATIONS_VIEW,
    PERMISSIONS.DONATIONS_MANAGE
  )

  return <>{children}</>
}
