import { Header } from "@/components/layout/header"
import { DirectoryOverviewClient } from "@/components/directory/directory-overview-client"
import { fetchDirectoryNavSummary } from "@/lib/directory/directory-nav-summary"

export default async function DirectoryOverviewPage() {
  const summary = await fetchDirectoryNavSummary()

  return (
    <>
      <Header title="Directory" />
      <DirectoryOverviewClient initialSummary={summary} />
    </>
  )
}
