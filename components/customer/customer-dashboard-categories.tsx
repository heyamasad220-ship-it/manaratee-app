"use client"

import { FolderHeart, Heart } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export type CustomerDashboardCategory = {
  id: string
  name: string
}

export function CustomerDashboardDonationOptions({
  categories,
  onDonate,
}: {
  categories: CustomerDashboardCategory[]
  onDonate?: (categoryId: string) => void
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Donation Options</h2>
        <p className="text-sm text-muted-foreground">
          Give to a category with a one-time gift or recurring donation.
        </p>
      </div>

      {categories.length === 0 ? (
        <Card className="border border-dashed shadow-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No donation categories are available right now.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((category) => (
            <Card key={category.id} className="border shadow-sm">
              <CardContent className="flex h-full flex-col p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <FolderHeart className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{category.name}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="mt-3 self-center gap-2"
                  onClick={() => onDonate?.(category.id)}
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
  )
}

/** @deprecated Use CustomerDashboardDonationOptions */
export const CustomerDashboardCategories = CustomerDashboardDonationOptions
