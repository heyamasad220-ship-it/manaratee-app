import { Suspense } from "react"

import { Header } from "@/components/layout/header"
import { DirectoryOverviewClient } from "@/components/directory/directory-overview-client"
import { fetchDirectoryNavSummary } from "@/lib/directory/directory-nav-summary"

export default async function DirectoryOverviewPage() {
  const summary = await fetchDirectoryNavSummary()

  return (
    <>
      <Header title="All Contacts" />
      <Suspense
        fallback={<div className="p-6 text-sm text-muted-foreground">Loading directory...</div>}
      >
        <DirectoryOverviewClient initialSummary={summary} />
      </Suspense>
    </>
  )
}
