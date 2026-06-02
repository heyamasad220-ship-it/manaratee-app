import { Header } from "@/components/layout/header"
import { ApplicationDetailClient } from "@/components/applications/application-detail-client"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission(PERMISSIONS.APPLICATIONS_VIEW)
  const { id } = await params

  return (
    <>
      <Header title="Application Detail" />
      <ApplicationDetailClient applicationId={id} />
    </>
  )
}
