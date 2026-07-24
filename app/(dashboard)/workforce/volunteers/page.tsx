import { redirect } from "next/navigation"
import { hrOverviewHref } from "@/lib/hr/hr-overview-path"

function directoryApplicationsView(params: {
  tab?: string
  view?: string
}): "applications" | null {
  if (params.view === "applications" || params.tab === "applications") {
    return "applications"
  }
  return null
}

export default async function HrVolunteersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; view?: string }>
}) {
  const params = await searchParams

  redirect(
    hrOverviewHref({
      tab: "volunteers",
      view: directoryApplicationsView(params),
    })
  )
}
