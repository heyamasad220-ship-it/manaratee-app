import { Header } from "@/components/layout/header"
import { DepartmentsManager } from "@/components/departments/departments-manager"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function SettingsDepartmentsPage() {
  await requirePermission(PERMISSIONS.STAFF_VIEW)

  return (
    <>
      <Header title="Departments" />
      <div className="p-6">
        <DepartmentsManager />
      </div>
    </>
  )
}
