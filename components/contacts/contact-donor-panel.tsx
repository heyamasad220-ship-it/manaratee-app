"use client"

import Link from "next/link"
import { Heart } from "lucide-react"
import type {
  ContactDonationRecord,
  ContactDonorStats,
} from "@/lib/contacts/contact-profile-data"
import { formatContactDate, formatContactMoney } from "@/lib/contacts/contact-profile-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type ContactDonorPanelProps = {
  donorStats: ContactDonorStats
  donations?: ContactDonationRecord[]
  showPanel: boolean
  title?: string
}

export function ContactDonorPanel({
  donorStats,
  donations = [],
  showPanel,
  title = "Donor Details",
}: ContactDonorPanelProps) {
  if (!showPanel) return null

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Heart className="size-5 text-rose-600" />
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/donations/payments/one-time">View giving history</Link>
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap gap-3 [&>*]:w-fit">
          <div>
            <p className="text-xs text-muted-foreground">Total donated</p>
            <p className="text-lg font-semibold">{formatContactMoney(donorStats.totalDonated)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Number of donations</p>
            <p className="font-medium">{donorStats.donationCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last donation</p>
            <p className="font-medium">{formatContactDate(donorStats.lastDonationDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pledges</p>
            <p className="font-medium">{donorStats.pledgeCount}</p>
          </div>
        </div>

        {donations.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Memo</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((donation) => (
                  <tr key={donation.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatContactDate(donation.date)}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {formatContactMoney(donation.amount)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{donation.memo || "—"}</td>
                    <td className="px-3 py-2">
                      {donation.status ? (
                        <Badge variant="secondary">{donation.status}</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No donations recorded for this contact yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
