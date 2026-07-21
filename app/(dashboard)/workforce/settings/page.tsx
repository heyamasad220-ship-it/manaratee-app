import { redirect } from "next/navigation"

import {
  MEMBERSHIP_BENEFITS_PATH,
  MEMBERSHIP_TEAMS_PATH,
} from "@/lib/memberships/membership-module-label"

const HR_SETTINGS_DEFAULT = "/workforce/settings/positions"

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
    redirect("/workforce/departments")
  }

  if (tab === "positions") {
    redirect("/workforce/settings/positions")
  }

  if (tab === "time-off" || tab === "work-schedule" || tab === "notifications") {
    redirect("/workforce/employees")
  }

  if (tab === "discount-policies") {
    redirect(MEMBERSHIP_BENEFITS_PATH)
  }

  redirect(HR_SETTINGS_DEFAULT)
}
