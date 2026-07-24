import { redirect } from "next/navigation"
import {
  hrEmployeePositionsHref,
  hrOverviewHref,
} from "@/lib/hr/hr-overview-path"

export default async function HRSettingsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams

  if (tab === "departments") {
    redirect(hrOverviewHref({ tab: "departments" }))
  }
  if (tab === "positions") {
    redirect(hrEmployeePositionsHref())
  }

  const query = tab ? `?tab=${encodeURIComponent(tab)}` : ""
  redirect(`/workforce/settings${query}`)
}
