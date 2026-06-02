"use client"

import Link from "next/link"
import { Heart } from "lucide-react"
import type { ContactDonorStats } from "@/lib/contacts/contact-profile-data"
import { formatContactDate, formatContactMoney } from "@/lib/contacts/contact-profile-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type ContactDonorPanelProps = {
  donorStats: ContactDonorStats
  showPanel: boolean
}

export function ContactDonorPanel({ donorStats, showPanel }: ContactDonorPanelProps) {
  if (!showPanel) return null

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Heart className="size-5 text-rose-600" />
            <h2 className="text-lg font-semibold">Donor Details</h2>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/donations/payments">View giving history</Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      </CardContent>
    </Card>
  )
}
