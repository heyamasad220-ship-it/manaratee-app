"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CampaignProgressBar } from "@/components/donations/campaign-progress-bar"
import { CampaignProgressGauge } from "@/components/donations/campaign-progress-gauge"
import {
  formatCampaignStatusLabel,
  formatDonationCurrency,
  type CampaignAnalyticsEntry,
} from "@/lib/donations/campaign-analytics"
import { getCampaignAnalyticsAction } from "@/lib/donations/donation-reports-actions"
import { Plus, Target } from "lucide-react"

export default function DonationsCampaignsPage() {
  const [entries, setEntries] = useState<CampaignAnalyticsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setErrorMessage(null)

      const result = await getCampaignAnalyticsAction()
      if (!result.success) {
        setErrorMessage(result.error)
        setEntries([])
      } else {
        setEntries(result.entries)
      }

      setLoading(false)
    }

    load()
  }, [])

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.metrics.raised - a.metrics.raised),
    [entries]
  )

  const formatDate = (value?: string | null) => {
    if (!value) return "—"
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <>
      <Header title="Campaigns" />
      <div className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Fundraising Campaigns</h2>
              <p className="text-sm text-muted-foreground">
                Track goals, progress, and performance across campaigns
              </p>
              {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
            </div>
            <Button asChild>
              <Link href="/donations/settings">
                <Plus className="mr-2 h-4 w-4" />
                Manage Campaigns
              </Link>
            </Button>
          </div>

          {!loading && sortedEntries.some((entry) => Number(entry.campaign.goal_amount || 0) > 0) ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sortedEntries
                .filter((entry) => Number(entry.campaign.goal_amount || 0) > 0)
                .slice(0, 6)
                .map(({ campaign, metrics }) => (
                  <Card key={campaign.id}>
                    <CardContent className="flex flex-col items-center pt-6">
                      <CampaignProgressGauge
                        title={campaign.name}
                        raised={metrics.raised}
                        goal={Number(campaign.goal_amount || 0)}
                        size="md"
                      />
                      <Button variant="outline" size="sm" className="mt-4" asChild>
                        <Link href={`/donations/campaigns/${campaign.id}`}>View campaign</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Campaign Performance
              </CardTitle>
              <CardDescription>
                Raised totals include payments linked directly or through pledges
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Goal</TableHead>
                    <TableHead>Raised</TableHead>
                    <TableHead>Pledged</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        Loading campaigns...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && sortedEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No campaigns yet. Create one in Donations Settings.
                      </TableCell>
                    </TableRow>
                  )}
                  {sortedEntries.map(({ campaign, metrics }) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div>
                          <Link
                            href={`/donations/campaigns/${campaign.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {campaign.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(campaign.start_date)} – {formatDate(campaign.end_date)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{formatDonationCurrency(Number(campaign.goal_amount || 0))}</TableCell>
                      <TableCell className="font-medium text-emerald-600">
                        {formatDonationCurrency(metrics.raised)}
                      </TableCell>
                      <TableCell>{formatDonationCurrency(metrics.pledged)}</TableCell>
                      <TableCell>{formatDonationCurrency(metrics.outstanding)}</TableCell>
                      <TableCell className="min-w-[140px]">
                        <CampaignProgressBar progressPercent={metrics.progressPercent} />
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                          {formatCampaignStatusLabel(campaign.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/donations/campaigns/${campaign.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
