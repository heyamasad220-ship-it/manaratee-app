"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { CampaignProgressBar } from "@/components/donations/campaign-progress-bar"
import { CampaignGroupsReportPanel } from "@/components/donations/campaign-groups-report-panel"
import { CampaignWishlistReportPanel } from "@/components/donations/campaign-wishlist-report-panel"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatDonationCurrency, type CampaignAnalyticsEntry } from "@/lib/donations/campaign-analytics"
import { getCampaignAnalyticsAction } from "@/lib/donations/donation-reports-actions"
import { donationCampaignWorkspaceHref } from "@/lib/donations/campaign-workspace-paths"
import { DollarSign, Target, Users } from "lucide-react"
import { cn } from "@/lib/utils"

const ALL = "all"

export function CampaignPerformanceReportPanel() {
  const searchParams = useSearchParams()
  const [entries, setEntries] = useState<CampaignAnalyticsEntry[]>([])
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [view, setView] = useState<"campaigns" | "groups" | "wishlist">(
    searchParams.get("view") === "groups"
      ? "groups"
      : searchParams.get("view") === "wishlist"
        ? "wishlist"
        : "campaigns"
  )
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    const result = await getCampaignAnalyticsAction()
    if (!result.success) {
      setErrorMessage(result.error)
      setEntries([])
      setLoading(false)
      return
    }
    setEntries(result.entries)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (statusFilter === ALL) return entries
    return entries.filter(
      (entry) => String(entry.campaign.status || "").toLowerCase() === statusFilter
    )
  }, [entries, statusFilter])

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, entry) => {
        acc.goal += Number(entry.campaign.goal_amount || 0)
        acc.committed += entry.metrics.pledged
        acc.collected += entry.metrics.raised
        acc.outstanding += entry.metrics.outstanding
        acc.donors += entry.metrics.donorCount
        return acc
      },
      { goal: 0, committed: 0, collected: 0, outstanding: 0, donors: 0 }
    )
  }, [filtered])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-xl font-semibold">Campaign Performance</h2>
        <p className="text-sm text-muted-foreground">
          Collected is received payments. Committed is valid pledge amounts. Outstanding is unpaid
          pledge balances. Campaign groups are a report view of fundraising teams, not CRM groups.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
          <button
            type="button"
            onClick={() => setView("campaigns")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              view === "campaigns"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Campaigns
          </button>
          <button
            type="button"
            onClick={() => setView("groups")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              view === "groups"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Campaign Groups
          </button>
          <button
            type="button"
            onClick={() => setView("wishlist")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              view === "wishlist"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Wishlist Performance
          </button>
        </div>

        {view === "campaigns" ? (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {view === "groups" ? (
        <CampaignGroupsReportPanel embedded />
      ) : view === "wishlist" ? (
        <CampaignWishlistReportPanel embedded />
      ) : (
        <>
          <DonationMetricCardGrid colorful className="lg:grid-cols-5">
            <DonationMetricCard
              title="Campaigns"
              value={filtered.length}
              icon={Target}
              accent="blue"
            />
            <DonationMetricCard
              title="Total Goal"
              value={formatDonationCurrency(totals.goal)}
              icon={Target}
              accent="purple"
            />
            <DonationMetricCard
              title="Total Committed"
              value={formatDonationCurrency(totals.committed)}
              icon={DollarSign}
              accent="amber"
            />
            <DonationMetricCard
              title="Total Collected"
              value={formatDonationCurrency(totals.collected)}
              icon={DollarSign}
              accent="emerald"
            />
            <DonationMetricCard
              title="Outstanding"
              value={formatDonationCurrency(totals.outstanding)}
              icon={Users}
              accent="rose"
              description={`${totals.donors} donors`}
            />
          </DonationMetricCardGrid>

          <Card>
            <CardHeader>
              <CardTitle>Campaigns</CardTitle>
              <CardDescription>
                Click a campaign to open the campaign workspace. Group management stays on Campaign →
                Groups.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Goal</TableHead>
                    <TableHead>Committed</TableHead>
                    <TableHead>Collected</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Donors</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        Loading campaigns...
                      </TableCell>
                    </TableRow>
                  ) : errorMessage ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-destructive">
                        {errorMessage}
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No campaigns match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((entry) => (
                      <TableRow key={entry.campaign.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={donationCampaignWorkspaceHref(entry.campaign.id)}
                            className="text-primary hover:underline"
                          >
                            {entry.campaign.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {entry.campaign.goal_amount == null
                            ? "—"
                            : formatDonationCurrency(entry.campaign.goal_amount)}
                        </TableCell>
                        <TableCell>{formatDonationCurrency(entry.metrics.pledged)}</TableCell>
                        <TableCell>{formatDonationCurrency(entry.metrics.raised)}</TableCell>
                        <TableCell>{formatDonationCurrency(entry.metrics.outstanding)}</TableCell>
                        <TableCell>{entry.metrics.donorCount}</TableCell>
                        <TableCell className="min-w-[140px]">
                          <CampaignProgressBar
                            progressPercent={entry.metrics.progressPercent}
                            className="w-[140px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {entry.campaign.status || "—"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
