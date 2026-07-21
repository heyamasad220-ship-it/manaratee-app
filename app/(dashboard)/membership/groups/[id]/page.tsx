import { Header } from "@/components/layout/header"
import { HrTeamDetailClient } from "@/components/hr/hr-team-detail-client"

export default async function MembershipGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <>
      <Header title="Group" />
      <HrTeamDetailClient teamId={id} />
    </>
  )
}
