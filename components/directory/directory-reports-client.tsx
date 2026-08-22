"use client"

import Link from "next/link"
import { AlertTriangle, BarChart3, PieChart, UserX } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import type {
  DirectoryCompletenessStats,
  DirectoryDuplicateRow,
  DirectoryGrowthPoint,
  DirectoryRoleDistributionRow,
} from "@/lib/directory/directory-report-types"

function formatMonth(value: string) {
  const [year, month] = value.split("-")
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

export function DirectoryReportsClient({
  uniquePeople,
  roleDistribution,
  completeness,
  growth,
  duplicates,
}: {
  uniquePeople: number
  roleDistribution: DirectoryRoleDistributionRow[]
  completeness: DirectoryCompletenessStats
  growth: DirectoryGrowthPoint[]
  duplicates: DirectoryDuplicateRow[]
}) {
  const populatedRoles = roleDistribution.filter((row) => row.count > 0)
  const maxGrowth = Math.max(
    1,
    ...growth.map((point) => point.people + point.organizations)
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Directory Reports</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Analytics for identity data. Role counts overlap — a person can be a donor and a
          volunteer, so totals are not unique people.
        </p>
      </div>

      <StatCardsRow equal columns={4}>
        <StatCard label="People" value={uniquePeople.toLocaleString()} layout="header" fill />
        <StatCard
          label="Missing email"
          value={completeness.missingEmail.toLocaleString()}
          layout="header"
          fill
        />
        <StatCard
          label="Missing phone"
          value={completeness.missingPhone.toLocaleString()}
          layout="header"
          fill
        />
        <StatCard
          label="Possible duplicates"
          value={duplicates.length.toLocaleString()}
          layout="header"
          fill
        />
      </StatCardsRow>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="h-4 w-4 text-muted-foreground" />
              Role distribution
            </CardTitle>
            <CardDescription>
              Counts can overlap. {uniquePeople.toLocaleString()} unique people in Directory.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {populatedRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No role records yet.</p>
            ) : (
              populatedRoles.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3 text-sm">
                  <span>{row.label}</span>
                  <span className="tabular-nums font-medium">{row.count.toLocaleString()}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserX className="h-4 w-4 text-muted-foreground" />
              Data completeness
            </CardTitle>
            <CardDescription>People records missing common identity fields.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Missing email</span>
              <span className="tabular-nums">{completeness.missingEmail.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Missing phone</span>
              <span className="tabular-nums">{completeness.missingPhone.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Missing address</span>
              <span className="tabular-nums">{completeness.missingAddress.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>No stored role</span>
              <span className="tabular-nums">{completeness.noRole.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Contact growth
          </CardTitle>
          <CardDescription>People vs organizations added in the last 12 months.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {growth.map((point) => {
            const total = point.people + point.organizations
            const peopleWidth = `${Math.round((point.people / maxGrowth) * 100)}%`
            const orgWidth = `${Math.round((point.organizations / maxGrowth) * 100)}%`
            return (
              <div key={point.month} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
                <span className="text-xs text-muted-foreground">{formatMonth(point.month)}</span>
                <div className="flex h-3 overflow-hidden rounded bg-muted">
                  <div className="bg-sky-500" style={{ width: peopleWidth }} />
                  <div className="bg-amber-500" style={{ width: orgWidth }} />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {total.toLocaleString()}
                </span>
              </div>
            )
          })}
          <p className="pt-1 text-xs text-muted-foreground">Blue = people · Amber = organizations</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Possible duplicate people
          </CardTitle>
          <CardDescription>
            Matching email or phone within this organization. Review and merge from the contact
            profile — records are never merged automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {duplicates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No email or phone duplicates found.</p>
          ) : (
            duplicates.slice(0, 25).map((row) => (
              <div key={row.key} className="rounded-md border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{row.matchType}</Badge>
                  <span className="text-sm font-medium">{row.value}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  {row.contactIds.map((id, index) => (
                    <Link
                      key={id}
                      href={contactProfileHref(id, { list: "people" })}
                      className="text-primary hover:underline"
                    >
                      {row.names[index] || "Open profile"}
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
