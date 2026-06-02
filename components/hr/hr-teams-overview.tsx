"use client"

import * as React from "react"
import Link from "next/link"
import {
  fetchHrTeamDashboardStats,
  fetchHrTeams,
  type HrTeam,
  type HrTeamDashboardStats,
} from "@/lib/hr/hr-team-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Users, UsersRound, Crown, Activity, ArrowRight } from "lucide-react"

type HrTeamsOverviewProps = {
  onManageTeams?: () => void
}

export function HrTeamsOverview({ onManageTeams }: HrTeamsOverviewProps) {
  const [loading, setLoading] = React.useState(true)
  const [teams, setTeams] = React.useState<HrTeam[]>([])
  const [stats, setStats] = React.useState<HrTeamDashboardStats>({
    totalTeams: 0,
    activeTeams: 0,
    totalMembers: 0,
    teamLeaders: 0,
  })

  React.useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [teamsData, statsData] = await Promise.all([
        fetchHrTeams({ includeInactive: true }),
        fetchHrTeamDashboardStats(),
      ])
      setTeams(teamsData)
      setStats(statsData)
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "Could not load teams.")
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { label: "Total Teams", value: stats.totalTeams, icon: UsersRound },
    { label: "Active Teams", value: stats.activeTeams, icon: Activity },
    { label: "Team Members", value: stats.totalMembers, icon: Users },
    { label: "Team Leaders", value: stats.teamLeaders, icon: Crown },
  ]

  const previewTeams = teams.slice(0, 6)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="size-5 text-primary" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Teams at a Glance</CardTitle>
          {onManageTeams ? (
            <Button variant="outline" size="sm" onClick={onManageTeams}>
              Manage Teams
              <ArrowRight className="ml-2 size-4" />
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Active Members</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Loading teams...
                  </TableCell>
                </TableRow>
              ) : previewTeams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No teams yet. Create your first team in the Teams tab.
                  </TableCell>
                </TableRow>
              ) : (
                previewTeams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block size-3 rounded-full"
                          style={{ backgroundColor: team.color || "#6366f1" }}
                        />
                        <span className="font-medium">{team.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {team.description || "-"}
                    </TableCell>
                    <TableCell>{team.active_member_count || 0}</TableCell>
                    <TableCell>
                      <Badge variant={team.status === "active" ? "default" : "secondary"}>
                        {team.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/hr/teams/${team.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
