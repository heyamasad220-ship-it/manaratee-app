"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Heart, HeartHandshake, Megaphone, Repeat } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import type { DonationFrequency } from "@/components/customer/customer-donation-dialog"

export type CustomerDashboardCampaign = {
  id: string
  name: string
  description: string | null
  flyerUrl: string | null
}

export function CustomerDashboardCampaigns({
  campaigns,
  onOpenDonationDialog,
  onPledge,
}: {
  campaigns: CustomerDashboardCampaign[]
  onOpenDonationDialog?: (campaignId: string, frequency: DonationFrequency) => void
  onPledge?: (campaignId: string) => void
}) {
  const router = useRouter()
  const [selectedCampaign, setSelectedCampaign] = useState<CustomerDashboardCampaign | null>(null)
  const [showDonateOptions, setShowDonateOptions] = useState(false)

  const openDonateOptions = (campaign: CustomerDashboardCampaign) => {
    setSelectedCampaign(campaign)
    setShowDonateOptions(true)
  }

  const goToPledge = (campaignId: string) => {
    if (onPledge) {
      onPledge(campaignId)
    } else {
      router.push(`/customer/donation?campaign=${campaignId}&action=pledge`)
    }
    setShowDonateOptions(false)
    setSelectedCampaign(null)
  }

  const openDonationDialog = (campaignId: string, frequency: DonationFrequency) => {
    onOpenDonationDialog?.(campaignId, frequency)
    setShowDonateOptions(false)
    setSelectedCampaign(null)
  }

  return (
    <>
      <section className="space-y-4">
        <div className="min-h-[4.75rem]">
          <h2 className="text-lg font-semibold text-foreground">Active Campaigns</h2>
          <p className="text-sm text-muted-foreground">
            Support a campaign with a pledge, one-time gift, or recurring donation.
          </p>
        </div>

        {campaigns.length === 0 ? (
          <Card className="border border-dashed shadow-sm">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No active campaigns right now.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {campaigns.map((campaign) => (
              <Card
                key={campaign.id}
                className="w-full overflow-hidden border shadow-sm"
              >
                <div className="aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-violet-100 via-fuchsia-50 to-purple-100">
                  {campaign.flyerUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={campaign.flyerUrl}
                      alt={`${campaign.name} flyer`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
                      <div className="rounded-full bg-white/70 p-2 shadow-sm">
                        <Megaphone className="h-5 w-5 text-violet-600" />
                      </div>
                      <p className="text-xs font-medium uppercase tracking-wide text-violet-700/80">
                        Flyer coming soon
                      </p>
                    </div>
                  )}
                </div>

                <CardContent className="p-4 text-center">
                  <h3 className="font-semibold text-foreground">{campaign.name}</h3>
                  {campaign.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {campaign.description}
                    </p>
                  ) : null}
                  <Button
                    size="sm"
                    className="mx-auto mt-3 gap-2"
                    onClick={() => openDonateOptions(campaign)}
                  >
                    <Heart className="h-4 w-4" />
                    Donate
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={showDonateOptions} onOpenChange={setShowDonateOptions}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Support {selectedCampaign?.name}</DialogTitle>
            <DialogDescription>
              Choose how you would like to give toward this campaign.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <Button
              variant="outline"
              className="h-auto justify-start gap-3 px-4 py-3"
              onClick={() => {
                if (!selectedCampaign) return
                goToPledge(selectedCampaign.id)
              }}
            >
              <HeartHandshake className="h-5 w-5 shrink-0 text-violet-600" />
              <span className="text-left">
                <span className="block font-medium">Make a Pledge</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Commit to a total amount and pay when you are ready
                </span>
              </span>
            </Button>

            <Button
              variant="outline"
              className="h-auto justify-start gap-3 px-4 py-3"
              onClick={() => {
                if (!selectedCampaign) return
                openDonationDialog(selectedCampaign.id, "one-time")
              }}
            >
              <Heart className="h-5 w-5 shrink-0 text-emerald-600" />
              <span className="text-left">
                <span className="block font-medium">One-time Donation</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Give a single gift toward this campaign today
                </span>
              </span>
            </Button>

            <Button
              variant="outline"
              className="h-auto justify-start gap-3 px-4 py-3"
              onClick={() => {
                if (!selectedCampaign) return
                openDonationDialog(selectedCampaign.id, "monthly")
              }}
            >
              <Repeat className="h-5 w-5 shrink-0 text-blue-600" />
              <span className="text-left">
                <span className="block font-medium">Recurring Donation</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Set up an ongoing monthly, quarterly, or annual gift
                </span>
              </span>
            </Button>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDonateOptions(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
