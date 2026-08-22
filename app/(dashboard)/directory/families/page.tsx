import { Suspense } from "react"

import { Header } from "@/components/layout/header"
import { DirectoryFamiliesClient } from "@/components/directory/directory-families-client"

export default function DirectoryFamiliesPage() {
  return (
    <>
      <Header title="Families" />
      <Suspense
        fallback={<div className="p-6 text-sm text-muted-foreground">Loading families...</div>}
      >
        <DirectoryFamiliesClient />
      </Suspense>
    </>
  )
}
