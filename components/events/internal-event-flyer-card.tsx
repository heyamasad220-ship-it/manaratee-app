"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { FlyerThumbnail } from "@/components/ui/flyer-thumbnail"
import { ProgramFlyerField } from "@/components/programs/edit/program-flyer-field"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { updateInternalEventFlyer } from "@/lib/events/internal-event-actions"

export function InternalEventFlyerCard({
  eventId,
  flyerUrl,
  canManage,
}: {
  eventId: string
  flyerUrl: string | null
  canManage: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [value, setValue] = useState(flyerUrl || "")

  function persistFlyer(nextUrl: string) {
    setValue(nextUrl)
    if (!canManage) return
    setError(null)
    startTransition(async () => {
      const result = await updateInternalEventFlyer({
        eventId,
        flyerUrl: nextUrl || null,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Flyer</CardTitle>
        <p className="text-sm text-muted-foreground">
          Optional promotional image for this event. Hover the thumbnail to
          open the full flyer.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {canManage ? (
          <ProgramFlyerField
            programId={eventId}
            value={value}
            onValueChange={persistFlyer}
            hideHiddenInput
            hideLabel
          />
        ) : value ? (
          <FlyerThumbnail src={value} alt="Event flyer" />
        ) : (
          <p className="text-sm text-muted-foreground">No flyer uploaded.</p>
        )}
        {isPending ? (
          <p className="text-xs text-muted-foreground">Saving flyer…</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
