import { Suspense } from "react"

import { Header } from "@/components/layout/header"
import { DepartmentsManager } from "@/components/departments/departments-manager"
import { DepartmentsSectionNav } from "@/components/departments/departments-section-nav"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function WorkforceDepartmentsPage() {
  await requirePermission(PERMISSIONS.STAFF_VIEW)

  return (
    <>
      <Header title="Departments" />
      <Suspense fallback={null}>
        <DepartmentsSectionNav />
      </Suspense>
      <div className="flex flex-col gap-6 p-6">
        <DepartmentsManager />
      </div>
    </>
  )
}
