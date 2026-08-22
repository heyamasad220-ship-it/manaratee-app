"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ChevronRight, Users } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import {
  getCampaignOverviewInsightsAction,
  type CampaignOverviewInsights,
} from "@/lib/donations/campaign-overview-insights-actions"
import { donationCampaignWorkspaceHref } from "@/lib/donations/campaign-workspace-paths"
import { cn } from "@/lib/utils"

type CampaignOverviewInsightsPanelProps = {
  campaignId: string
}

export function CampaignOverviewInsightsPanel({
  campaignId,
}: CampaignOverviewInsightsPanelProps) {
  const [insights, setInsights] = useState<CampaignOverviewInsights | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    const result = await getCampaignOverviewInsightsAction(campaignId)
    if (!result.success) {
      setErrorMessage(result.error)
      setInsights(null)
      setLoading(false)
      return
    }
    setInsights(result.insights)
    setLoading(false)
  }, [campaignId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading follow-ups and team metrics…</p>
    )
  }

  if (errorMessage) {
    return <p className="text-sm text-red-600">{errorMessage}</p>
  }

  if (!insights) return null

  const severityClass = {
    urgent: "border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20",
    attention: "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20",
    info: "border-border bg-card",
  } as const

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Action Required
          </CardTitle>
          <CardDescription>Prospect follow-ups and campaign group attention items</CardDescription>
        </CardHeader>
        <CardContent>
          {insights.actionItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No prospect follow-ups or group items need attention right now.
            </p>
          ) : (
            <ul className="space-y-2">
              {insights.actionItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm transition hover:bg-muted/50",
                      severityClass[item.severity]
                    )}
                  >
                    <span>{item.label}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Team Summary
          </CardTitle>
          <CardDescription>Prospect pipeline by assignee</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {insights.teamMetrics.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No prospects assigned yet. Add prospects on the Prospects tab.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignee</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                  <TableHead className="text-right">Asked</TableHead>
                  <TableHead className="text-right">Pledged</TableHead>
                  <TableHead className="text-right">Ask $</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insights.teamMetrics.map((row) => (
                  <TableRow key={row.assigneeContactId || "unassigned"}>
                    <TableCell className="font-medium">{row.assigneeName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.openPipelineCount}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        row.overdueCount > 0 && "font-medium text-red-600"
                      )}
                    >
                      {row.overdueCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.askedCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.pledgedCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDonationCurrency(row.suggestedAskTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {insights.wishlist && insights.wishlist.itemCount > 0 ? (
        <Card className="border border-border shadow-sm xl:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Wishlist</CardTitle>
              <CardDescription>
                {insights.wishlist.itemCount} items · {formatDonationCurrency(insights.wishlist.targetTotal)} target ·{" "}
                {formatDonationCurrency(insights.wishlist.collectedTotal)} collected · {insights.wishlist.completedCount} completed
              </CardDescription>
            </div>
            <Link
              href={donationCampaignWorkspaceHref(campaignId, { tab: "wishlist" })}
              className="text-sm text-primary hover:underline"
            >
              View Wishlist
            </Link>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  )
}

export function CampaignOverviewGroupsCard({
  campaignId,
}: CampaignOverviewInsightsPanelProps) {
  const [insights, setInsights] = useState<CampaignOverviewInsights | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await getCampaignOverviewInsightsAction(campaignId)
    if (!result.success) {
      setInsights(null)
      setLoading(false)
      return
    }
    setInsights(result.insights)
    setLoading(false)
  }, [campaignId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading || !insights || insights.groups.length === 0) return null

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">Campaign Groups</CardTitle>
          <CardDescription>
            Collected via group links: {formatDonationCurrency(insights.groupsCollectedTotal)}
          </CardDescription>
        </div>
        <Link
          href={donationCampaignWorkspaceHref(campaignId, { tab: "groups" })}
          className="text-sm text-primary hover:underline"
        >
          View Groups
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group</TableHead>
              <TableHead className="text-right">Donors</TableHead>
              <TableHead className="text-right">Pledged</TableHead>
              <TableHead className="text-right">Collected</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {insights.groups.slice(0, 8).map((row) => (
              <TableRow key={row.groupId}>
                <TableCell>
                  <Link
                    href={donationCampaignWorkspaceHref(campaignId, {
                      tab: "groups",
                      groupId: row.groupId,
                    })}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.donorCount}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatDonationCurrency(row.pledged)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatDonationCurrency(row.collected)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
