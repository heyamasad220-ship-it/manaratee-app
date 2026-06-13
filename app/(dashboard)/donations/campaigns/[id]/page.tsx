"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
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
import {
  buildPledgeCampaignMap,
  computeCampaignMetrics,
  fetchCampaignAnalyticsData,
  formatCampaignStatusLabel,
  formatDonationCurrency,
  getCampaignRecentActivity,
  type CampaignAnalyticsEntry,
  type CampaignRecentActivity,
  type CampaignRow,
} from "@/lib/donations/campaign-analytics"
import { ArrowLeft, Target, Users } from "lucide-react"

export default function CampaignDetailPage() {
  const params = useParams()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<CampaignRow | null>(null)
  const [entry, setEntry] = useState<CampaignAnalyticsEntry | null>(null)
  const [activity, setActivity] = useState<CampaignRecentActivity | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setErrorMessage(null)

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setErrorMessage("User not authenticated.")
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

      if (!profile?.organization_id) {
        setErrorMessage("Unable to load your organization.")
        setLoading(false)
        return
      }

      const { campaigns, pledges, payments, error } = await fetchCampaignAnalyticsData(
        supabase,
        profile.organization_id
      )

      if (error) {
        setErrorMessage(error)
        setLoading(false)
        return
      }

      const match = campaigns.find((row) => row.id === campaignId)
      if (!match) {
        setErrorMessage("Campaign not found.")
        setLoading(false)
        return
      }

      const pledgeCampaignById = buildPledgeCampaignMap(pledges)
      const metrics = computeCampaignMetrics(
        campaignId,
        match.goal_amount,
        pledges,
        payments,
        pledgeCampaignById
      )

      setCampaign(match)
      setEntry({ campaign: match, metrics })
      setActivity(
        getCampaignRecentActivity(campaignId, pledges, payments, pledgeCampaignById)
      )
      setLoading(false)
    }

    if (campaignId) load()
  }, [campaignId])

  const formatDate = (value?: string | null) => {
    if (!value) return "—"
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatDateTime = (value?: string | null) => {
    if (!value) return "—"
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const summaryCards = useMemo(() => {
    if (!entry) return []
    const { metrics } = entry
    return [
      { label: "Raised", value: formatDonationCurrency(metrics.raised) },
      { label: "Pledged", value: formatDonationCurrency(metrics.pledged) },
      { label: "Outstanding", value: formatDonationCurrency(metrics.outstanding) },
      { label: "Total Committed", value: formatDonationCurrency(metrics.totalCommitted) },
    ]
  }, [entry])

  if (loading) {
    return (
      <>
        <Header title="Campaign" />
        <div className="p-6 text-muted-foreground">Loading campaign...</div>
      </>
    )
  }

  if (!campaign || !entry || errorMessage) {
    return (
      <>
        <Header title="Campaign" />
        <div className="p-6">
          <p className="text-red-600">{errorMessage || "Campaign not found."}</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/donations/campaigns">Back to Campaigns</Link>
          </Button>
        </div>
      </>
    )
  }

  const { metrics } = entry

  return (
    <>
      <Header title={campaign.name} />
      <div className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/donations/campaigns">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Campaigns
              </Link>
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Campaign Information</CardTitle>
                <CardDescription>{campaign.code || "No campaign code"}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{campaign.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Goal</p>
                  <p className="font-medium">
                    {formatDonationCurrency(Number(campaign.goal_amount || 0))}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-medium">{formatDate(campaign.start_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="font-medium">{formatDate(campaign.end_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium">{formatCampaignStatusLabel(campaign.status)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{campaign.description || "—"}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Goal Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CampaignProgressBar
                  progressPercent={metrics.progressPercent}
                  className="mb-4"
                />
                <p className="text-sm text-muted-foreground">
                  {metrics.progressPercent == null
                    ? "No goal set for this campaign."
                    : `${formatDonationCurrency(metrics.raised)} raised of ${formatDonationCurrency(Number(campaign.goal_amount || 0))} goal`}
                </p>
              </CardContent>
            </Card>
          </div>

          <div>
            <h3 className="mb-3 text-base font-semibold">Fundraising Summary</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {summaryCards.map((card) => (
                <Card key={card.label}>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-bold">{card.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Collected against pledges: {formatDonationCurrency(metrics.collectedAgainstPledges)}
            </p>
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Users className="h-4 w-4" />
              Donor Metrics
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Donors</p>
                  <p className="text-2xl font-bold">{metrics.donorCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Average Gift</p>
                  <p className="text-2xl font-bold">{formatDonationCurrency(metrics.averageGift)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Largest Gift</p>
                  <p className="text-2xl font-bold">{formatDonationCurrency(metrics.largestGift)}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Recent Donations</CardTitle>
                <CardDescription>One-time payments linked to this campaign</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ActivityPaymentTable
                  rows={activity?.recentDonations || []}
                  formatDate={formatDateTime}
                  emptyLabel="No one-time donations yet"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Pledges</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Donor</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(activity?.recentPledges || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                          No pledges yet
                        </TableCell>
                      </TableRow>
                    )}
                    {(activity?.recentPledges || []).map((pledge) => (
                      <TableRow key={pledge.id}>
                        <TableCell>
                          <p className="font-medium">{pledge.donor_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(pledge.pledge_date)}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatDonationCurrency(Number(pledge.amount_pledged || 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Pledge Payments</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ActivityPaymentTable
                  rows={activity?.recentPledgePayments || []}
                  formatDate={formatDateTime}
                  emptyLabel="No pledge payments yet"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

function ActivityPaymentTable({
  rows,
  formatDate,
  emptyLabel,
}: {
  rows: Array<{
    id: string
    sender_name?: string | null
    amount?: number | null
    payment_date?: string | null
    source?: string | null
  }>
  formatDate: (value?: string | null) => string
  emptyLabel: string
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Donor</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
              {emptyLabel}
            </TableCell>
          </TableRow>
        )}
        {rows.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>
              <p className="font-medium">{payment.sender_name || "Unknown"}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(payment.payment_date)} · {payment.source || "—"}
              </p>
            </TableCell>
            <TableCell className="text-right">
              {formatDonationCurrency(Number(payment.amount || 0))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
