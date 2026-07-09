"use client"

import { useState } from "react"

import {
  CustomerDashboardCampaigns,
  type CustomerDashboardCampaign,
} from "@/components/customer/customer-dashboard-campaigns"
import {
  CustomerDashboardDonationOptions,
  type CustomerDashboardCategory,
} from "@/components/customer/customer-dashboard-categories"
import {
  CustomerDonationDialog,
  type CustomerDonationDialogPreset,
  type DonationFrequency,
} from "@/components/customer/customer-donation-dialog"

export function CustomerDashboardGivingSection({
  campaigns,
  categories,
}: {
  campaigns: CustomerDashboardCampaign[]
  categories: CustomerDashboardCategory[]
}) {
  const [donationDialogOpen, setDonationDialogOpen] = useState(false)
  const [donationDialogPreset, setDonationDialogPreset] = useState<
    CustomerDonationDialogPreset | undefined
  >(undefined)

  const openDonationDialog = (preset?: CustomerDonationDialogPreset) => {
    setDonationDialogPreset(preset)
    setDonationDialogOpen(true)
  }

  return (
    <>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="w-full shrink-0 lg:max-w-xs">
          <CustomerDashboardCampaigns
            campaigns={campaigns}
            onOpenDonationDialog={(campaignId, frequency) =>
              openDonationDialog({ campaignId, frequency })
            }
          />
        </div>
        <div className="min-w-0 flex-1">
          <CustomerDashboardDonationOptions
            categories={categories}
            onDonate={(categoryId) => openDonationDialog({ categoryId })}
          />
        </div>
      </div>

      <CustomerDonationDialog
        open={donationDialogOpen}
        onOpenChange={setDonationDialogOpen}
        preset={donationDialogPreset}
      />
    </>
  )
}

export type { DonationFrequency }
