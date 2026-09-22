"use client"

import { useState } from "react"
import { Heart } from "lucide-react"

import {
  CustomerDashboardDonationOptions,
  type CustomerDashboardCategory,
} from "@/components/customer/customer-dashboard-categories"
import {
  CustomerDonationDialog,
  type CustomerDonationDialogPreset,
  type DonationFrequency,
} from "@/components/customer/customer-donation-dialog"
import { Card, CardContent } from "@/components/ui/card"

export function CustomerDashboardGivingSection({
  categories,
}: {
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

  const hasDonationOptions = categories.length > 0

  return (
    <>
      {hasDonationOptions ? (
        <CustomerDashboardDonationOptions
          categories={categories}
          onDonate={(categoryId) => openDonationDialog({ categoryId })}
        />
      ) : (
        <Card className="border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 px-5 py-8 text-center">
            <Heart className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              No donation options are available right now.
            </p>
          </CardContent>
        </Card>
      )}

      <CustomerDonationDialog
        open={donationDialogOpen}
        onOpenChange={setDonationDialogOpen}
        preset={donationDialogPreset}
      />
    </>
  )
}

export type { DonationFrequency }
