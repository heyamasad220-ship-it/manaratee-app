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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-start">
        <CustomerDashboardCampaigns
          campaigns={campaigns}
          onOpenDonationDialog={(campaignId, frequency) =>
            openDonationDialog({ campaignId, frequency })
          }
        />
        <CustomerDashboardDonationOptions
          categories={categories}
          onDonate={(categoryId) => openDonationDialog({ categoryId })}
        />
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
