import Link from "next/link"
import { ArrowRight, Tags, UserCheck, UsersRound } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { fetchMembershipOverviewStats } from "@/lib/memberships/membership-overview-actions"
import {
  MEMBERSHIP_GROUPS_PATH,
  MEMBERSHIP_MEMBERS_PATH,
  MEMBERSHIP_MODULE_LABEL,
  MEMBERSHIP_SETTINGS_PATH,
} from "@/lib/memberships/membership-module-label"
import {
  isOrganizationModuleEnabled,
  loadOrganizationEnabledModuleSlugs,
} from "@/lib/modules/dashboard-module-access-server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

export default async function MembershipOverviewPage() {
  const stats = await fetchMembershipOverviewStats()
  const organizationId = await getSelectedOrganizationId()
  const enabledModuleSlugs = organizationId
    ? await loadOrganizationEnabledModuleSlugs(organizationId)
    : new Set<string>()
  const programsEnabled = isOrganizationModuleEnabled(enabledModuleSlugs, "programs")

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
      label: "Groups",
      value: stats.groups.activeGroups,
      hint: `${stats.groups.totalMembers} group assignments`,
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
      label: "Groups",
      href: MEMBERSHIP_GROUPS_PATH,
      description: "Member groups and optional assignments",
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
              {MEMBERSHIP_MODULE_LABEL} covers who belongs to your organization, their benefits,
              and member groups.
              {programsEnabled ? (
                <>
                  {" "}
                  Program participants stay in{" "}
                  <Link
                    href="/programs/registrations"
                    className="font-medium text-primary hover:underline"
                  >
                    Programs
                  </Link>
                  ; workforce records stay in{" "}
                </>
              ) : (
                <> Workforce records stay in </>
              )}
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
                    <link.icon className="h-4 w-4 text-muted-foreground" />
                    {link.label}
                  </CardTitle>
                  <CardDescription className="mt-1.5">{link.description}</CardDescription>
                </div>
                <Button asChild variant="ghost" size="icon" className="shrink-0">
                  <Link href={link.href} aria-label={`Open ${link.label}`}>
                    <ArrowRight className="h-4 w-4" />
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
