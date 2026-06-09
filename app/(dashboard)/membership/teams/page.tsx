import { Header } from "@/components/layout/header"
import { HrTeamsPageClient } from "@/components/hr/hr-teams-page-client"
import { MEMBERSHIP_TEAMS_PATH } from "@/lib/memberships/membership-module-label"

export default async function MembershipTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams

  return (
    <>
      <Header title="Teams" />
      <HrTeamsPageClient initialTab={tab} basePath={MEMBERSHIP_TEAMS_PATH} />
    </>
  )
}
