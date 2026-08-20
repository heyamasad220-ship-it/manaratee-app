"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import Link from "next/link"
import { Copy, Globe, Link2, Loader2, QrCode } from "lucide-react"

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
import {
  buildPublicCommunityEventUrl,
} from "@/lib/community-calendar/public-paths"
import { COMMUNITY_CALENDAR_PATH } from "@/lib/community-calendar/routes"
import { updateInternalEventCommunityCalendar } from "@/lib/events/internal-event-actions"

async function downloadQrCode(url: string, filename: string) {
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(url)}`
  const response = await fetch(qrImageUrl)

  if (!response.ok) {
    throw new Error("Failed to generate QR code.")
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = `${filename}-event-qr.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

export function InternalEventCommunityCalendarCard({
  eventId,
  eventName,
  communityCalendarStatus,
  organizationSlug,
  canManage,
}: {
  eventId: string
  eventName?: string
  communityCalendarStatus?: string | null
  organizationSlug?: string | null
  canManage: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [sharePending, setSharePending] = useState(false)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<CommunityCalendarVisibility>(
    visibilityFromCalendarStatus(communityCalendarStatus)
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const publicEventUrl =
    organizationSlug && visibility === "published"
      ? buildPublicCommunityEventUrl(organizationSlug, eventId)
      : null

  async function handleCopyLink() {
    if (!publicEventUrl) return
    setShareMessage(null)
    setSharePending(true)
    try {
      await navigator.clipboard.writeText(publicEventUrl)
      setShareMessage("Link copied")
    } catch {
      setShareMessage("Could not copy link")
    } finally {
      setSharePending(false)
    }
  }

  async function handleDownloadQrCode() {
    if (!publicEventUrl) return
    setShareMessage(null)
    setSharePending(true)
    try {
      const safeName = (eventName || "event")
        .trim()
        .replace(/[^\w\-]+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60)
      await downloadQrCode(publicEventUrl, safeName || "event")
      setShareMessage("QR downloaded")
    } catch {
      setShareMessage("Could not download QR code")
    } finally {
      setSharePending(false)
    }
  }

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
        {publicEventUrl ? (
          <div className="space-y-2 rounded-md border border-dashed p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Public event page
            </p>
            <p className="break-all text-xs text-muted-foreground">{publicEventUrl}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={sharePending}
                onClick={() => void handleCopyLink()}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy link
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={sharePending}
                onClick={() => void handleDownloadQrCode()}
              >
                <QrCode className="mr-2 h-4 w-4" />
                Download QR
              </Button>
              <Button type="button" size="sm" variant="outline" asChild>
                <Link href={publicEventUrl} target="_blank" rel="noreferrer">
                  <Link2 className="mr-2 h-4 w-4" />
                  Open page
                </Link>
              </Button>
            </div>
            {shareMessage ? (
              <p className="text-xs text-muted-foreground">{shareMessage}</p>
            ) : null}
          </div>
        ) : organizationSlug && visibility !== "published" ? (
          <p className="text-xs text-muted-foreground">
            Set visibility to Public to share a registration link and QR code.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
