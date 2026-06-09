import Link from "next/link"
import { ArrowRight, Tags, UserCheck, UsersRound } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { fetchMembershipOverviewStats } from "@/lib/memberships/membership-overview-actions"
import {
  MEMBERSHIP_MEMBERS_PATH,
  MEMBERSHIP_MODULE_LABEL,
  MEMBERSHIP_SETTINGS_PATH,
  MEMBERSHIP_TEAMS_PATH,
} from "@/lib/memberships/membership-module-label"

export default async function MembershipOverviewPage() {
  const stats = await fetchMembershipOverviewStats()

  const metrics = [
    {
      label: "Active members",
      value: stats.activeMembers,
      hint: `${stats.pendingMembers} pending`,
    },
    {
      label: "Expiring soon",
      value: stats.expiringSoon,
      hint: "Within 30 days",
    },
    {
      label: "Teams",
      value: stats.teams.activeTeams,
      hint: `${stats.teams.totalMembers} team assignments`,
    },
    {
      label: "Lapsed",
      value: stats.lapsedMembers,
      hint: "Needs renewal follow-up",
    },
  ]

  const quickLinks = [
    {
      label: "Members",
      href: MEMBERSHIP_MEMBERS_PATH,
      description: "Membership records and renewals",
      icon: UserCheck,
    },
    {
      label: "Teams",
      href: MEMBERSHIP_TEAMS_PATH,
      description: "Optional member team assignments",
      icon: UsersRound,
    },
    {
      label: "Settings",
      href: MEMBERSHIP_SETTINGS_PATH,
      description: "Membership types and terms",
      icon: Tags,
    },
  ]

  return (
    <>
      <Header title={MEMBERSHIP_MODULE_LABEL} />
      <div className="flex flex-col gap-6 p-6">
        <Card className="border-dashed">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              {MEMBERSHIP_MODULE_LABEL} covers who belongs to MAS Dallas, their benefits, and
              optional team assignments. Program participants and workforce records stay in{" "}
              <Link href="/programs/registrations" className="font-medium text-primary hover:underline">
                Programs
              </Link>{" "}
              and{" "}
              <Link href="/workforce" className="font-medium text-primary hover:underline">
                Organization
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <StatCardsRow>
          {metrics.map((metric) => (
            <StatCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
            />
          ))}
        </StatCardsRow>

        <div className="grid gap-4 md:grid-cols-2">
          {quickLinks.map((link) => (
            <Card key={link.href}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </CardTitle>
                  <CardDescription>{link.description}</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={link.href}>
                    Open
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}
