"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  Building2,
  Home,
  Users,
} from "lucide-react"

import { ContactsCrmList } from "@/components/contacts/contacts-crm-list"
import { DirectoryAddMenu } from "@/components/directory/directory-add-menu"
import { DirectoryFamiliesClient } from "@/components/directory/directory-families-client"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard, StatCardsRow, type StatCardTone } from "@/components/ui/stat-card"
import { cn } from "@/lib/utils"
import {
  directoryContactsTabPath,
  directoryRolePath,
  parseDirectoryContactsTab,
  type DirectoryContactsTab,
} from "@/lib/directory/directory-paths"
import {
  populatedDirectoryRoles,
  type DirectoryDynamicRoleKey,
  type DirectoryNavSummary,
} from "@/lib/directory/directory-roles"
import { fetchDirectoryOverviewAction } from "@/lib/directory/directory-search"

const METRIC_TONES: Record<"People" | "Families" | "Organizations", StatCardTone> = {
  People: "blue",
  Families: "emerald",
  Organizations: "violet",
}

const ROLE_TONES: Record<DirectoryDynamicRoleKey, StatCardTone> = {
  employees: "sky",
  volunteers: "teal",
  members: "amber",
  donors: "emerald",
  sponsors: "indigo",
  parents: "rose",
  vendors: "orange",
  "service-providers": "slate",
  "childcare-providers": "violet",
  "rental-customers": "blue",
}

export function DirectoryOverviewClient({
  initialSummary,
}: {
  initialSummary: DirectoryNavSummary
}) {
  const searchParams = useSearchParams()
  const activeTab = parseDirectoryContactsTab(searchParams.get("tab"))
  const [summary, setSummary] = useState(initialSummary)

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      const result = await fetchDirectoryOverviewAction()
      if (!cancelled && result.success) setSummary(result.summary)
    }
    void refresh()
    return () => {
      cancelled = true
    }
  }, [])

  const activeRoles = useMemo(
    () =>
      populatedDirectoryRoles(summary.roles, {
        facilitiesEnabled: summary.facilitiesEnabled,
        directoryNav: true,
      }),
    [summary.roles, summary.facilitiesEnabled]
  )

  const metrics: Array<{
    label: string
    tab: DirectoryContactsTab
    value: number
    icon: typeof Users
  }> = [
    {
      label: "People",
      tab: "people",
      value: summary.people,
      icon: Users,
    },
    {
      label: "Families",
      tab: "families",
      value: summary.families,
      icon: Home,
    },
    {
      label: "Organizations",
      tab: "organizations",
      value: summary.organizations,
      icon: Building2,
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">All Contacts</h1>
        <DirectoryAddMenu />
      </div>

      <div className="flex flex-col gap-3">
      <StatCardsRow equal columns={3}>
        {metrics.map((metric) => (
          <Link key={metric.label} href={directoryContactsTabPath(metric.tab)} className="min-w-0">
            <StatCard
              label={metric.label}
              value={metric.value.toLocaleString()}
              icon={metric.icon}
              layout="header"
              fill
              tone={METRIC_TONES[metric.label as "People" | "Families" | "Organizations"]}
              className={cn(
                "transition-shadow hover:shadow-sm",
                activeTab === metric.tab && "ring-2 ring-primary"
              )}
            />
          </Link>
        ))}
      </StatCardsRow>

      {activeTab === "families" ? (
        <DirectoryFamiliesClient embedded />
      ) : (
        <ContactsCrmList
          embedded
          lockedRecordType={activeTab === "organizations" ? "organization" : "individual"}
          showStats={false}
          facilitiesEnabled={summary.facilitiesEnabled}
          emptyTitle={activeTab === "organizations" ? "No organizations yet" : "No people yet"}
          emptyDescription={
            activeTab === "organizations"
              ? "Add businesses, partners, sponsors, vendors, and other organizations to your directory."
              : "Add people to your directory. One person can have many roles without creating duplicate records."
          }
        />
      )}
      </div>

      {activeRoles.length > 0 ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Active Directory Categories</h2>
            <p className="text-sm text-muted-foreground">
              Role views appear when this organization has matching records. One person or
              organization can belong to several categories.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeRoles.map((role) => {
              const count = summary.roles[role.key] ?? 0
              return (
                <Link key={role.key} href={directoryRolePath(role.key)} className="min-w-0">
                  <StatCard
                    label={role.label}
                    value={count.toLocaleString()}
                    hint={count === 1 ? "record" : "records"}
                    layout="header"
                    fill
                    tone={ROLE_TONES[role.key]}
                    className="transition-shadow hover:shadow-sm"
                  />
                </Link>
              )
            })}
          </div>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Role views such as Employees, Donors, and Vendors appear here after the first matching
            record exists. Use Add to create a person or organization and assign a role.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
