"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import { cn } from "@/lib/utils"

export function OfferingSessionsSelector({
  programId,
  offerings,
  selectedOfferingId,
}: {
  programId: string
  offerings: ProgramOffering[]
  selectedOfferingId: string
}) {
  if (offerings.length <= 1) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {offerings.map((offering) => (
        <Button
          key={offering.id}
          variant={offering.id === selectedOfferingId ? "default" : "outline"}
          size="sm"
          asChild
        >
          <Link
            href={`/programs/${programId}/sessions?offering=${offering.id}`}
            className={cn(
              offering.status === "archived" && offering.id !== selectedOfferingId
                ? "opacity-70"
                : undefined
            )}
          >
            {offering.name}
          </Link>
        </Button>
      ))}
    </div>
  )
}
