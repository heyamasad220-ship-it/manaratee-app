"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Calendar, Clock, Loader2, UsersRound } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import { fetchTeamMemberships, type HrTeamMembership } from "@/lib/hr/hr-team-actions"
import { membershipTeamDetailPath } from "@/lib/memberships/membership-module-label"
import { formatContactDate } from "@/lib/contacts/contact-profile-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { volunteerStatusStyles } from "@/lib/volunteers/volunteer-utils"

type ContactVolunteerDetailsProps = {
  contactId: string
}

export function ContactVolunteerDetails({ contactId }: ContactVolunteerDetailsProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [hoursServed, setHoursServed] = useState(0)
  const [upcomingCount, setUpcomingCount] = useState(0)
  const [teams, setTeams] = useState<HrTeamMembership[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) return

      const teamData = await fetchTeamMemberships({ contactId, includeInactive: false })
      setTeams(teamData)

      const { data: volunteer } = await supabase
        .from("volunteers")
        .select("id, status")
        .eq("organization_id", orgId)
        .eq("contact_id", contactId)
        .maybeSingle()

      if (!volunteer) {
        setStatus(null)
        setHoursServed(0)
        setUpcomingCount(0)
        return
      }

      setStatus(volunteer.status)

      const { data: historyRows } = await supabase
        .from("volunteer_history")
        .select("hours_worked")
        .eq("organization_id", orgId)
        .eq("volunteer_id", volunteer.id)

      setHoursServed(
        (historyRows || []).reduce((sum, row) => sum + (Number(row.hours_worked) || 0), 0)
      )

      const today = new Date().toISOString().slice(0, 10)
      const { count } = await supabase
        .from("volunteer_sign_ups")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("volunteer_id", volunteer.id)
        .gte("event_date", today)
        .in("status", ["pending", "confirmed"])

      setUpcomingCount(count || 0)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [contactId, supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading volunteer details...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Volunteer Details</h2>
          <Button variant="outline" size="sm" asChild>
            <Link href="/workforce/volunteers">View volunteers</Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-4 [&>*]:w-fit">
          <div>
            <p className="text-xs text-muted-foreground">Volunteer status</p>
            {status ? (
              <Badge className={`mt-1 ${volunteerStatusStyles[status as keyof typeof volunteerStatusStyles] || ""}`}>
                {status.replace(/_/g, " ")}
              </Badge>
            ) : (
              <p className="font-medium">Not on file</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Hours served</p>
            <p className="mt-1 flex items-center gap-1 font-medium">
              <Clock className="size-4 text-muted-foreground" />
              {hoursServed}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Upcoming assignments</p>
            <p className="mt-1 flex items-center gap-1 font-medium">
              <Calendar className="size-4 text-muted-foreground" />
              {upcomingCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Teams</p>
            <p className="mt-1 flex items-center gap-1 font-medium">
              <UsersRound className="size-4 text-muted-foreground" />
              {teams.length}
            </p>
          </div>
        </div>

        {teams.length > 0 && (
          <div className="mt-4 space-y-2">
            {teams.map((team) => (
              <div key={team.id} className="rounded-md border px-3 py-2 text-sm">
                <Link href={membershipTeamDetailPath(team.team_id)} className="font-medium hover:underline">
                  {team.team_name}
                </Link>
                <p className="text-muted-foreground">
                  {team.position_name}
                  {team.start_date ? ` · Joined ${formatContactDate(team.start_date)}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
