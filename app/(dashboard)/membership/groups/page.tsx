import { Header } from "@/components/layout/header"
import { HrTeamsPageClient } from "@/components/hr/hr-teams-page-client"
import { MEMBERSHIP_GROUPS_PATH } from "@/lib/memberships/membership-module-label"

export default async function MembershipGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams

  return (
    <>
      <Header title="Groups" />
      <HrTeamsPageClient initialTab={tab} basePath={MEMBERSHIP_GROUPS_PATH} />
    </>
  )
}
