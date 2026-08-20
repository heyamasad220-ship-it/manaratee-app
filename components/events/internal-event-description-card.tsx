"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { updateInternalEventDescription } from "@/lib/events/internal-event-actions"

export function InternalEventDescriptionCard({
  eventId,
  description,
  canManage,
}: {
  eventId: string
  description: string | null
  canManage: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(description || "")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setValue(description || "")
  }, [description])

  const dirty = value.trim() !== (description || "").trim()

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateInternalEventDescription({
        eventId,
        description: value.trim() || null,
      })
      if (!result.success) {
        setError(result.error || "Could not save description.")
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Description</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canManage ? (
          <>
            <Textarea
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                setSaved(false)
              }}
              rows={6}
              placeholder="Add a description for this event…"
              className="min-h-32 resize-y"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={pending || !dirty}
              >
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save description"
                )}
              </Button>
              {saved && !dirty ? (
                <span className="text-xs text-muted-foreground">Saved</span>
              ) : null}
            </div>
          </>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {description?.trim() || "No description provided."}
          </p>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
