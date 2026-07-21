import { Header } from "@/components/layout/header"
import { DepartmentsManager } from "@/components/departments/departments-manager"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function WorkforceDepartmentsPage() {
  await requirePermission(PERMISSIONS.STAFF_VIEW)

  return (
    <>
      <Header title="Departments" />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Departments</h1>
          <p className="text-sm text-muted-foreground">
            Organize staff and programs by department.
          </p>
        </div>
        <DepartmentsManager />
      </div>
    </>
  )
}
