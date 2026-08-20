"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

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
          Optional promotional image for this event. The full flyer is shown
          without cropping.
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
            fit="contain"
            frameClassName="max-w-full"
            imageClassName="max-h-72"
          />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Event flyer"
            className="block h-auto max-h-72 w-auto max-w-full rounded-md object-contain"
          />
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
