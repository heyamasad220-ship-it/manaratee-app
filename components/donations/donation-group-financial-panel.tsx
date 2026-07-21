"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, DollarSign, Loader2, Users } from "lucide-react"

import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  fetchGroupCampaignGivingAction,
  type GroupCampaignGiftRow,
  type GroupCampaignGivingSummary,
} from "@/lib/donations/donation-group-campaign-actions"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"

type DonationGroupFinancialPanelProps = {
  groupContactId: string
  groupName: string
  refreshToken?: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function CampaignRow({ campaign }: { campaign: GroupCampaignGiftRow }) {
  const [open, setOpen] = useState(false)

  function toggleOpen() {
    setOpen((current) => !current)
  }

  return (
    <>
      <TableRow className="cursor-pointer" onClick={toggleOpen}>
        <TableCell className="w-8">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(event) => {
              event.stopPropagation()
              toggleOpen()
            }}
            aria-label={open ? "Hide donors for this campaign" : "Show donors for this campaign"}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="font-medium">{campaign.campaignName}</TableCell>
        <TableCell className="text-right tabular-nums">
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={(event) => {
              event.stopPropagation()
              toggleOpen()
            }}
          >
            {formatCurrency(campaign.combinedTotal)}
          </button>
        </TableCell>
        <TableCell className="text-right tabular-nums">{campaign.giftCount}</TableCell>
        <TableCell className="text-muted-foreground">{formatDate(campaign.lastGiftDate)}</TableCell>
      </TableRow>
      {open ? (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={5} className="p-0">
            <div className="border-t px-4 py-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Donors for {campaign.campaignName}
              </p>
              {campaign.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No donor detail for this campaign.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Donor</TableHead>
                      <TableHead className="text-right">Gifts</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaign.members.map((member) => (
                      <TableRow
                        key={`${member.contactId || "pooled"}-${member.memberName}`}
                      >
                        <TableCell>
                          {member.isPooledGroupGift || !member.contactId ? (
                            <span>{member.memberName}</span>
                          ) : (
                            <Link
                              href={contactProfileHref(member.contactId, {
                                tab: "financial",
                              })}
                              className="text-primary hover:underline"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {member.memberName}
                            </Link>
                          )}
                          {member.isPooledGroupGift ? (
                            <Badge variant="outline" className="ml-2 font-normal">
                              Historical pooled
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {member.giftCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(member.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

export function DonationGroupFinancialPanel({
  groupContactId,
  groupName,
  refreshToken = 0,
}: DonationGroupFinancialPanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<GroupCampaignGivingSummary | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const result = await fetchGroupCampaignGivingAction(groupContactId)
      if (!result.success) {
        setError(result.error)
        setSummary(null)
      } else {
        setSummary(result.summary)
      }
      setLoading(false)
    }
    void load()
  }, [groupContactId, refreshToken])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading group gifts...
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!summary) return null

  const giftCount = summary.campaigns.reduce((sum, campaign) => sum + campaign.giftCount, 0)

  return (
    <div className="space-y-6">
      <DonationMetricCardGrid colorful columns={2}>
        <DonationMetricCard
          title="Total giving"
          value={formatCurrency(summary.combinedTotal)}
          icon={DollarSign}
          accent="blue"
          description={`Individual gifts toward ${groupName}`}
        />
        <DonationMetricCard
          title="Gifts"
          value={String(giftCount)}
          icon={Users}
          accent="emerald"
          description="Across all campaigns"
        />
      </DonationMetricCardGrid>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Campaign gifts</CardTitle>
          <CardDescription>
            Giving by campaign from individual donors. Click a blue amount to see who donated
            for that campaign.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summary.campaigns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No gifts recorded for this group yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Gifts</TableHead>
                    <TableHead>Last gift</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.campaigns.map((campaign) => (
                    <CampaignRow
                      key={campaign.campaignId || campaign.campaignName}
                      campaign={campaign}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
