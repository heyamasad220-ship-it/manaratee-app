"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import {
  fetchDonationChargeFailuresAction,
  type DonationChargeFailureRow,
} from "@/lib/donations/charge-failure-actions"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"

function formatWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function DonationFailedChargesPanel() {
  const [failures, setFailures] = useState<DonationChargeFailureRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await fetchDonationChargeFailuresAction()
      if (cancelled) return
      if (!result.success) {
        setFailures([])
        setError(result.error)
      } else {
        setFailures(result.failures)
        setError(null)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Failed Charges</h2>
        <p className="text-sm text-muted-foreground">
          Card charges the bank declined. Successful payments stay on Transactions.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading failed charges...</div>
        ) : failures.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No declined charges yet. When a card is charged and does not go through — insufficient
            funds, an expired card, or a wrong number — the attempt shows here with the reason.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Donor</th>
                  <th className="p-3 text-left">Amount</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">Reason</th>
                  <th className="p-3 text-left">Card</th>
                  <th className="p-3 text-left">Campaign</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((failure) => (
                  <tr key={failure.id} className="border-b">
                    <td className="p-3">{formatWhen(failure.occurredAt)}</td>
                    <td className="p-3">
                      {failure.contactId ? (
                        <Link
                          href={`/contacts/${failure.contactId}?tab=financial`}
                          className="font-medium text-primary hover:underline"
                        >
                          {failure.donorName}
                        </Link>
                      ) : (
                        failure.donorName
                      )}
                    </td>
                    <td className="p-3 font-medium">
                      {failure.amount == null ? "—" : formatDonationCurrency(failure.amount)}
                    </td>
                    <td className="p-3 text-muted-foreground">{failure.kind}</td>
                    <td className="p-3">{failure.reason}</td>
                    <td className="p-3 text-muted-foreground">{failure.cardLabel || "—"}</td>
                    <td className="p-3 text-muted-foreground">{failure.campaignName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
