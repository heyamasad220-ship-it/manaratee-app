import { redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import { PeopleManagementSettingsShell } from "@/components/hr/people-management-settings-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  MEMBERSHIP_BENEFITS_PATH,
  MEMBERSHIP_TEAMS_PATH,
} from "@/lib/memberships/membership-module-label"

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
    redirect("/settings/departments")
  }

  if (tab === "positions") {
    redirect("/settings/positions")
  }

  if (tab === "time-off" || tab === "work-schedule" || tab === "notifications") {
    redirect("/workforce/employees?tab=employees")
  }

  if (tab === "general" || tab === "roles") {
    redirect("/workforce/settings")
  }

  if (tab === "discount-policies") {
    redirect(MEMBERSHIP_BENEFITS_PATH)
  }

  return (
    <>
      <Header title="Settings" />
      <div className="p-6">
        <PeopleManagementSettingsShell>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workforce settings</CardTitle>
              <CardDescription>
                Member teams moved to Membership. Discount tags moved to Contacts → Settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Use Settings → Departments, Positions, and Applications for organization
              structure. Use Membership for members and teams. Use Contacts → Settings for
              discount tags and benefits.
            </CardContent>
          </Card>
        </PeopleManagementSettingsShell>
      </div>
    </>
  )
}
