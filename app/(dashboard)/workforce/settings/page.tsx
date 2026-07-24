import { redirect } from "next/navigation"
import {
  hrEmployeePositionsHref,
  hrOverviewHref,
} from "@/lib/hr/hr-overview-path"
import {
  MEMBERSHIP_BENEFITS_PATH,
  MEMBERSHIP_TEAMS_PATH,
} from "@/lib/memberships/membership-module-label"

/** HR Settings hub removed — Positions live under Employees. */
export default async function HRSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams

  if (tab === "teams" || tab === "team-positions") {
    const query = tab === "team-positions" ? "?tab=positions" : "?tab=teams"
    redirect(`${MEMBERSHIP_TEAMS_PATH}${query}`)
  }

  if (tab === "departments") {
    redirect(hrOverviewHref({ tab: "departments" }))
  }

  if (tab === "positions" || !tab) {
    redirect(hrEmployeePositionsHref())
  }

  if (tab === "time-off" || tab === "work-schedule" || tab === "notifications") {
    redirect(hrOverviewHref({ tab: "employees" }))
  }

  if (tab === "discount-policies") {
    redirect(MEMBERSHIP_BENEFITS_PATH)
  }

  redirect(hrEmployeePositionsHref())
}
