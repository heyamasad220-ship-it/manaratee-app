"use client"

import { useRouter } from "next/navigation"

import { Label } from "@/components/ui/label"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"

export function OfferingPricingSelector({
  programId,
  offerings,
  selectedOfferingId,
}: {
  programId: string
  offerings: ProgramOffering[]
  selectedOfferingId: string
}) {
  const router = useRouter()

  function handleChange(offeringId: string) {
    if (offeringId === selectedOfferingId) {
      return
    }

    router.replace(
      `/programs/${programId}/offerings/${offeringId}?tab=fees`,
      { scroll: false }
    )
    router.refresh()
  }

  if (offerings.length <= 1) {
    const offering = offerings[0]
    if (!offering) {
      return null
    }

    return (
      <p className="text-sm text-muted-foreground">
        Pricing for <span className="font-medium text-foreground">{offering.name}</span>
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="pricing-offering">Offering</Label>
      <select
        id="pricing-offering"
        value={selectedOfferingId}
        onChange={(event) => handleChange(event.target.value)}
        className="h-9 w-full max-w-md rounded-md border bg-background px-3 text-sm"
      >
        {offerings.map((offering) => (
          <option key={offering.id} value={offering.id}>
            {offering.name}
            {offering.is_default ? " (default)" : ""}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        Each offering has its own fee plans. Save after editing each one.
      </p>
    </div>
  )
}
