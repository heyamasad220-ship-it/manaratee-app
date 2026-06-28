"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { DollarSign, Heart, Loader2, Users } from "lucide-react"

import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { GroupGivingRollup } from "@/lib/contacts/group-member-types"
import { fetchGroupGivingRollupAction } from "@/lib/contacts/group-member-actions"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"

type ContactGroupGivingOverviewProps = {
  groupContactId: string
  groupName: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
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

export function ContactGroupGivingOverview({
  groupContactId,
  groupName,
}: ContactGroupGivingOverviewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rollup, setRollup] = useState<GroupGivingRollup | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      try {
        const result = await fetchGroupGivingRollupAction(groupContactId)
        if (!result?.success) {
          setError(result?.error || "Could not load group giving summary.")
          setRollup(null)
          return
        }
        setRollup(result.rollup)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load group giving summary.")
        setRollup(null)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [groupContactId])

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading group giving summary...
      </p>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!rollup) return null

  return (
    <div className="space-y-6">
      <DonationMetricCardGrid colorful columns={3}>
        <DonationMetricCard
          title="Group Gifts"
          value={formatCurrency(rollup.groupDirectTotal)}
          icon={Heart}
          accent="violet"
          description={`Checks and gifts recorded on ${groupName}`}
        />
        <DonationMetricCard
          title="Member Gifts for Group"
          value={formatCurrency(rollup.memberIndividualTotal)}
          icon={Users}
          accent="emerald"
          description={`${rollup.memberCount} member${rollup.memberCount === 1 ? "" : "s"} — tagged on their own gifts`}
        />
        <DonationMetricCard
          title="Combined Total"
          value={formatCurrency(rollup.combinedTotal)}
          icon={DollarSign}
          accent="blue"
          description="Group gifts plus member gifts counted toward this group"
        />
      </DonationMetricCardGrid>

      {rollup.members.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Member Gifts Counted for Group</CardTitle>
            <CardDescription>
              Individual gifts where the donor selected this group when giving. Each gift stays on
              the member&apos;s profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Gifts</TableHead>
                    <TableHead>Last gift</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rollup.members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <Link
                          href={contactProfileHref(member.memberContactId, "financial")}
                          className="font-medium text-primary hover:underline"
                        >
                          {member.memberName || "Unnamed contact"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(member.totalDonations)}
                      </TableCell>
                      <TableCell className="text-right">{member.donationCount}</TableCell>
                      <TableCell>{formatDate(member.lastDonationDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
