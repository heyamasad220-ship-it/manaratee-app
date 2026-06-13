"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getDonationOpsSnapshotAction } from "@/lib/donations/donation-ops-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  const hasIssues =
    data.failedEmails > 0 ||
    data.failedReceipts > 0 ||
    data.pendingReconcilePayments > 0 ||
    data.failedProcessorEvents > 0

  if (!hasIssues && data.recentFailedEmails.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operational health</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No failed emails, processor events, or reconcile queue items detected.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Operational health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          {data.failedEmails > 0 ? (
            <Badge variant="destructive">{data.failedEmails} failed emails</Badge>
          ) : null}
          {data.failedReceipts > 0 ? (
            <Badge variant="destructive">{data.failedReceipts} failed receipts</Badge>
          ) : null}
          {data.pendingReconcilePayments > 0 ? (
            <Badge variant="secondary">
              {data.pendingReconcilePayments} payments to reconcile
            </Badge>
          ) : null}
          {data.failedProcessorEvents > 0 ? (
            <Badge variant="destructive">
              {data.failedProcessorEvents} Stripe webhook failures
            </Badge>
          ) : null}
        </div>

        {data.pendingReconcilePayments > 0 ? (
          <p>
            <Link href="/donations/reconcile" className="text-primary hover:underline">
              Open reconciliation queue
            </Link>
          </p>
        ) : null}

        {data.recentFailedEmails.length > 0 ? (
          <div>
            <p className="font-medium mb-2">Recent failed emails</p>
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
            <p className="font-medium mb-2">Recent Stripe processor failures</p>
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
