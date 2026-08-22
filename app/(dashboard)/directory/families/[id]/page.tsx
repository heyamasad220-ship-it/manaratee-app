import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { FamilyGivingDetail } from "@/components/contacts/family-giving-detail"
import { fetchFamilyGivingRollupAction } from "@/lib/contacts/family-actions"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"

export default async function DirectoryFamilyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [rollupResult, canManage, canViewGiving] = await Promise.all([
    fetchFamilyGivingRollupAction(id),
    hasPermission(PERMISSIONS.CONTACTS_MANAGE),
    hasPermission(PERMISSIONS.DONATIONS_VIEW),
  ])

  if (!rollupResult.success) {
    notFound()
  }

  return (
    <>
      <Header title={rollupResult.rollup.familyName} />
      <div className="p-6">
        <FamilyGivingDetail
          rollup={rollupResult.rollup}
          canManage={canManage}
          showGiving={canViewGiving}
        />
      </div>
    </>
  )
}
