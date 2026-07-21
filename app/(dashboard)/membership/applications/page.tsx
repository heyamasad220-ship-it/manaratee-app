import { Suspense } from "react"

import { Header } from "@/components/layout/header"
import { HrCategoryApplicationsPanel } from "@/components/applications/hr-category-applications-panel"
import { MEMBERSHIP_APPLICATIONS_PATH } from "@/lib/applications/application-routes"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function MembershipApplicationsPage() {
  await requirePermission(PERMISSIONS.APPLICATIONS_VIEW)

  return (
    <>
      <Header title="Applications" />
      <div className="p-6">
        <Suspense>
          <HrCategoryApplicationsPanel
            applicationType="committee_member"
            syncPath={MEMBERSHIP_APPLICATIONS_PATH}
            title="Committee Applications"
            description="Review committee member application submissions."
          />
        </Suspense>
      </div>
    </>
  )
}
