"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"

export function EditProgramStickyFooter({
  isSaving,
  isLastTab,
  onSaveAndContinue,
}: {
  isSaving: boolean
  isLastTab: boolean
  onSaveAndContinue: () => void
}) {
  const cancelHref = "/programs/catalog"

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center justify-end gap-3 px-6">
        <Button variant="outline" size="sm" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>

        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>

        {!isLastTab ? (
          <Button
            type="button"
            size="sm"
            disabled={isSaving}
            onClick={onSaveAndContinue}
          >
            {isSaving ? "Saving..." : "Next"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
