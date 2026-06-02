import { Header } from "@/components/layout/header"
import { HrTeamsPageClient } from "@/components/hr/hr-teams-page-client"

export default async function HrTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams

  return (
    <>
      <Header title="Teams" />
      <HrTeamsPageClient initialTab={tab} />
    </>
  )
}
