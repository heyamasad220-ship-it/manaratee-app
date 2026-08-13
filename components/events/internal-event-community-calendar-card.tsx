"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import Link from "next/link"
import { Globe, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  COMMUNITY_CALENDAR_VISIBILITY_OPTIONS,
  visibilityFromCalendarStatus,
  type CommunityCalendarVisibility,
} from "@/lib/community-calendar/calendar-visibility"
import { COMMUNITY_CALENDAR_PATH } from "@/lib/community-calendar/routes"
import { updateInternalEventCommunityCalendar } from "@/lib/events/internal-event-actions"

export function InternalEventCommunityCalendarCard({
  eventId,
  communityCalendarStatus,
  canManage,
}: {
  eventId: string
  communityCalendarStatus?: string | null
  canManage: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [visibility, setVisibility] = useState<CommunityCalendarVisibility>(
    visibilityFromCalendarStatus(communityCalendarStatus)
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateInternalEventCommunityCalendar({
        eventId,
        visibility,
      })
      if (!result.success) {
        setError(result.error || "Could not update visibility.")
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4" />
          Community Calendar
        </CardTitle>
        <CardDescription>
          Optionally list this event for members or the public.{" "}
          <Link href={COMMUNITY_CALENDAR_PATH} className="text-primary hover:underline">
            View Community Calendar
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="community-calendar-visibility">Visibility</Label>
          <Select
            value={visibility}
            onValueChange={(value) => {
              setVisibility(value as CommunityCalendarVisibility)
              setSaved(false)
            }}
            disabled={!canManage || pending}
          >
            <SelectTrigger id="community-calendar-visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMUNITY_CALENDAR_VISIBILITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {
              COMMUNITY_CALENDAR_VISIBILITY_OPTIONS.find((o) => o.value === visibility)
                ?.description
            }
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={handleSave} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save visibility"
              )}
            </Button>
            {saved ? (
              <span className="text-xs text-muted-foreground">Saved</span>
            ) : null}
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
