import Link from "next/link"
import { DollarSign, Gift, Home, Users } from "lucide-react"

import { FamilyMembersPanel } from "@/components/contacts/family-members-panel"
import { FamilySettingsPanel } from "@/components/contacts/family-settings-panel"

import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { FamilyGivingRollup } from "@/lib/contacts/family-types"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"

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

type FamilyGivingDetailProps = {
  rollup: FamilyGivingRollup
  canManage?: boolean
  showGiving?: boolean
}

export function FamilyGivingDetail({
  rollup,
  canManage = false,
  showGiving = true,
}: FamilyGivingDetailProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{rollup.familyName}</h1>
            <Badge variant="outline">{rollup.status === "active" ? "Active" : "Inactive"}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Household view of adults (with phone/email) and minors (no separate contact profile).
            Donations stay on adult contacts; this page rolls up those gifts. Tax receipts stay with
            each donor contact.
          </p>
          {rollup.primaryContactId ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Primary contact:{" "}
              <Link
                href={contactProfileHref(rollup.primaryContactId, { list: "families" })}
                className="font-medium text-primary hover:underline"
              >
                {rollup.primaryName || "View profile"}
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      {showGiving ? (
      <DonationMetricCardGrid colorful columns={4}>
        <DonationMetricCard
          title="Lifetime Giving"
          value={formatCurrency(rollup.lifetimeTotal)}
          icon={DollarSign}
          accent="blue"
        />
        <DonationMetricCard
          title="Gift Count"
          value={rollup.giftCount}
          icon={Gift}
          accent="emerald"
        />
        <DonationMetricCard
          title="Last Gift"
          value={formatDate(rollup.lastGiftDate)}
          icon={Home}
          accent="violet"
        />
        <DonationMetricCard
          title="Household Members"
          value={rollup.memberCount}
          icon={Users}
          accent="amber"
        />
      </DonationMetricCardGrid>
      ) : null}

      <FamilySettingsPanel familyId={rollup.familyId} canManage={canManage} />

      <FamilyMembersPanel
        familyId={rollup.familyId}
        primaryContactId={rollup.primaryContactId}
        members={rollup.members}
        canManage={canManage}
      />

      {showGiving ? (
        <Card>
          <CardHeader>
            <CardTitle>Family Giving</CardTitle>
            <CardDescription>Latest gifts from all active household members</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
          {rollup.recentGifts.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No gifts recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rollup.recentGifts.map((gift) => (
                  <TableRow key={gift.id}>
                    <TableCell>{formatDate(gift.paymentDate)}</TableCell>
                    <TableCell>
                      <Link
                        href={contactProfileHref(gift.contactId, { list: "families" })}
                        className="text-primary hover:underline"
                      >
                        {gift.memberName || "Unnamed"}
                      </Link>
                    </TableCell>
                    <TableCell>{gift.campaignName || "General"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(gift.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      ) : null}
    </div>
  )
}
