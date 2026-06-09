"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HrTeamPositionsManager } from "@/components/hr/hr-team-positions-manager"
import { HrTeamsManager } from "@/components/hr/hr-teams-manager"
import { HrTeamsOverview } from "@/components/hr/hr-teams-overview"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MEMBERSHIP_TEAMS_PATH } from "@/lib/memberships/membership-module-label"
import { LayoutGrid, UserCog, UsersRound } from "lucide-react"

const teamsTabValues = ["overview", "teams", "positions"] as const

type TeamsTabValue = (typeof teamsTabValues)[number]

function normalizeTab(value?: string | null): TeamsTabValue {
  if (value && teamsTabValues.includes(value as TeamsTabValue)) {
    return value as TeamsTabValue
  }
  return "overview"
}

export function HrTeamsPageClient({
  initialTab,
  basePath = MEMBERSHIP_TEAMS_PATH,
}: {
  initialTab?: string | null
  basePath?: string
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState<TeamsTabValue>(normalizeTab(initialTab))

  function handleTabChange(value: string) {
    const tab = normalizeTab(value)
    setActiveTab(tab)
    router.replace(`${basePath}?tab=${tab}`, { scroll: false })
  }

  function goToTeamsTab() {
    handleTabChange("teams")
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
        <p className="text-sm text-muted-foreground">
          Member teams and optional assignments. Team positions define roles within each group.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutGrid className="size-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-2">
            <UsersRound className="size-4" />
            Teams
          </TabsTrigger>
          <TabsTrigger value="positions" className="gap-2">
            <UserCog className="size-4" />
            Team Positions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <HrTeamsOverview onManageTeams={goToTeamsTab} />
        </TabsContent>

        <TabsContent value="teams">
          <HrTeamsManager showViewLinks includeInactive />
        </TabsContent>

        <TabsContent value="positions">
          <HrTeamPositionsManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
