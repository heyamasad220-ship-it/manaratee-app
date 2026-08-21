"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

import { CampaignProgressBar } from "@/components/donations/campaign-progress-bar"
import { DonationReportsTabs } from "@/components/donations/donation-reports-chrome"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import {
  listOrgCampaignGroupsReportAction,
  type OrgCampaignGroupReportRow,
} from "@/lib/donations/campaign-groups-report-actions"
import { CAMPAIGN_GROUP_STATUS_LABELS } from "@/lib/donations/campaign-group-types"
import { donationCampaignWorkspaceHref } from "@/lib/donations/campaign-workspace-paths"

const ALL = "all"

export function CampaignGroupsReportPanel() {
  const [rows, setRows] = useState<OrgCampaignGroupReportRow[]>([])
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([])
  const [totals, setTotals] = useState({ groups: 0, pledged: 0, collected: 0, donors: 0 })
  const [campaignFilter, setCampaignFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    const result = await listOrgCampaignGroupsReportAction({
      campaignId: campaignFilter === ALL ? null : campaignFilter,
      status: statusFilter === ALL ? null : statusFilter,
    })
    if (!result.success) {
      setErrorMessage(result.error)
      setRows([])
      setLoading(false)
      return
    }
    setRows(result.rows)
    setCampaigns(result.campaigns)
    setTotals(result.totals)
    setLoading(false)
  }, [campaignFilter, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-xl font-semibold">Campaign Groups</h2>
        <p className="text-sm text-muted-foreground">
          Fundraising teams across campaigns. Separate from CRM Group Giving on the Donors report.
        </p>
      </div>

      <DonationReportsTabs />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-xs uppercase text-muted-foreground">Groups</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 text-xl font-semibold tabular-nums">
            {totals.groups}
          </CardContent>
        </Card>
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-xs uppercase text-muted-foreground">Pledged</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 text-xl font-semibold tabular-nums">
            {formatDonationCurrency(totals.pledged)}
          </CardContent>
        </Card>
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-xs uppercase text-muted-foreground">Collected</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 text-xl font-semibold tabular-nums">
            {formatDonationCurrency(totals.collected)}
          </CardContent>
        </Card>
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-xs uppercase text-muted-foreground">Donor seats</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 text-xl font-semibold tabular-nums">
            {totals.donors}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Campaign" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All campaigns</SelectItem>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {Object.entries(CAMPAIGN_GROUP_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <Card className="border border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Goal</TableHead>
                <TableHead className="text-right">Donors</TableHead>
                <TableHead className="text-right">Pledged</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead>Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    Loading campaign groups…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    No campaign groups found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.groupId}>
                    <TableCell>
                      <Link
                        href={donationCampaignWorkspaceHref(row.campaignId, { tab: "groups" })}
                        className="text-primary hover:underline"
                      >
                        {row.campaignName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={donationCampaignWorkspaceHref(row.campaignId, {
                          tab: "groups",
                          groupId: row.groupId,
                        })}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell>{row.leadName || "—"}</TableCell>
                    <TableCell>{CAMPAIGN_GROUP_STATUS_LABELS[row.status]}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.goalAmount != null ? formatDonationCurrency(row.goalAmount) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.donorCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDonationCurrency(row.pledged)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDonationCurrency(row.collected)}
                    </TableCell>
                    <TableCell className="min-w-[110px]">
                      {row.progressPercent != null ? (
                        <CampaignProgressBar progressPercent={row.progressPercent} />
                      ) : (
                        "—"
                      )}
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
