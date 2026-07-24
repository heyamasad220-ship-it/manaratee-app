import { redirect } from "next/navigation"
import {
  hrEmployeePositionsHref,
  hrOverviewHref,
} from "@/lib/hr/hr-overview-path"

export default async function HrEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; view?: string; staffTab?: string }>
}) {
  const params = await searchParams

  if (params.tab === "departments") {
    redirect(hrOverviewHref({ tab: "departments" }))
  }
  if (params.tab === "positions" || params.view === "positions") {
    redirect(hrEmployeePositionsHref())
  }

  const directoryView =
    params.view === "applications"
      ? params.view
      : params.tab === "applications"
        ? params.tab
        : null

  redirect(
    hrOverviewHref({
      tab: "employees",
      view: directoryView,
    })
  )
}
