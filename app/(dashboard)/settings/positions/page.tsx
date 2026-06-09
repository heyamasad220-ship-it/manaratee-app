import { Header } from "@/components/layout/header"
import { HrPositionsManager } from "@/components/hr/hr-positions-manager"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function SettingsPositionsPage() {
  await requirePermission(PERMISSIONS.STAFF_VIEW)

  return (
    <>
      <Header title="Positions" />
      <div className="p-6">
        <HrPositionsManager />
      </div>
    </>
  )
}
