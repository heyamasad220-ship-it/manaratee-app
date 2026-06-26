"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getDonationOpsSnapshotAction } from "@/lib/donations/donation-ops-actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function DonationOpsPanel() {
  const [snapshot, setSnapshot] = useState<Awaited<
    ReturnType<typeof getDonationOpsSnapshotAction>
  > | null>(null)

  useEffect(() => {
    void getDonationOpsSnapshotAction().then(setSnapshot)
  }, [])

  if (!snapshot?.success) {
    return null
  }

  const { snapshot: data } = snapshot
  const paymentsNeedingMatch = data.pendingMatchPayments + data.unresolvedPayments
  const hasIssues =
    data.failedEmails > 0 ||
    data.failedReceipts > 0 ||
    paymentsNeedingMatch > 0 ||
    data.failedProcessorEvents > 0

  if (!hasIssues && data.recentFailedEmails.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operational health</CardTitle>
          <CardDescription>Import, matching, and delivery status</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No failed emails, processor events, or unmatched payments detected.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Operational health</CardTitle>
        <CardDescription>Import, matching, and delivery status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          {data.pendingMatchPayments > 0 ? (
            <Badge variant="secondary">
              {data.pendingMatchPayments} need donor match
            </Badge>
          ) : null}
          {data.unresolvedPayments > 0 ? (
            <Badge variant="destructive">
              {data.unresolvedPayments} unresolved
            </Badge>
          ) : null}
          {data.failedEmails > 0 ? (
            <Badge variant="destructive">{data.failedEmails} failed emails</Badge>
          ) : null}
          {data.failedReceipts > 0 ? (
            <Badge variant="destructive">{data.failedReceipts} failed receipts</Badge>
          ) : null}
          {data.failedProcessorEvents > 0 ? (
            <Badge variant="destructive">
              {data.failedProcessorEvents} Stripe webhook failures
            </Badge>
          ) : null}
        </div>

        {paymentsNeedingMatch > 0 ? (
          <p>
            <Link href="/donations/payments/match" className="text-primary hover:underline">
              Open import &amp; match queue
            </Link>
          </p>
        ) : null}

        {data.recentFailedEmails.length > 0 ? (
          <div>
            <p className="mb-2 font-medium">Recent failed emails</p>
            <ul className="space-y-1 text-muted-foreground">
              {data.recentFailedEmails.map((row) => (
                <li key={row.id}>
                  {row.template} → {row.recipient}
                  {row.error_message ? ` (${row.error_message})` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {data.recentProcessorFailures.length > 0 ? (
          <div>
            <p className="mb-2 font-medium">Recent Stripe processor failures</p>
            <ul className="space-y-1 text-muted-foreground">
              {data.recentProcessorFailures.map((row) => (
                <li key={row.id}>
                  {row.event_type}
                  {row.error_message ? ` — ${row.error_message}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
