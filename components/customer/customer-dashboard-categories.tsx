"use client"

import { FolderHeart, Heart } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export type CustomerDashboardCategory = {
  id: string
  name: string
  description?: string | null
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
          Choose an area you'd like to support.
        </p>
      </div>

      {categories.length === 0 ? null : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <Card key={category.id} className="border shadow-sm">
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                  <FolderHeart className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium leading-snug text-foreground">{category.name}</p>
                  {category.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  className="w-fit gap-2"
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
