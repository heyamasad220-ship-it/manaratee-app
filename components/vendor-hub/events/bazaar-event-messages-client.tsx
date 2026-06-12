"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Loader2, Mail, Send } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { sendVendorEventAnnouncement } from "@/lib/vendor-hub/vendor-announcement-actions"
import {
  fillAnnouncementTemplate,
  VENDOR_ANNOUNCEMENT_TEMPLATES,
  VENDOR_ANNOUNCEMENT_TYPE_LABELS,
  type VendorAnnouncementAudience,
  type VendorAnnouncementRecord,
  type VendorAnnouncementType,
} from "@/lib/vendor-hub/vendor-announcement-types"
import { publishBazaarEventNotifications } from "@/lib/vendor-hub/bazaar-event-lifecycle-actions"

const sendableTypes: VendorAnnouncementType[] = [
  "update",
  "reminder",
  "cancellation",
  "general",
]

export function BazaarEventMessagesClient({
  eventId,
  eventName,
  organizationId,
  organizationName,
  initialAnnouncements,
}: {
  eventId: string
  eventName: string
  organizationId: string
  organizationName: string
  initialAnnouncements: VendorAnnouncementRecord[]
}) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [announcementType, setAnnouncementType] = useState<VendorAnnouncementType>("update")
  const [audience, setAudience] = useState<VendorAnnouncementAudience>("all_approved_vendors")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    applyTemplate("update")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, eventName, organizationName])

  const applyTemplate = (type: VendorAnnouncementType) => {
    if (type === "published") return
    const template = VENDOR_ANNOUNCEMENT_TEMPLATES[type]
    setSubject(fillAnnouncementTemplate(template.subject, { eventName, organizationName }))
    setBody(fillAnnouncementTemplate(template.body, { eventName, organizationName }))
  }

  const handleTypeChange = (value: VendorAnnouncementType) => {
    setAnnouncementType(value)
    applyTemplate(value)
  }

  const refreshAnnouncements = async () => {
    const { fetchEventVendorAnnouncements } = await import(
      "@/lib/vendor-hub/vendor-announcement-actions"
    )
    const rows = await fetchEventVendorAnnouncements(eventId)
    setAnnouncements(rows)
  }

  const handleSend = () => {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      try {
        const result = await sendVendorEventAnnouncement({
          eventId,
          organizationId,
          announcementType,
          audience,
          subject,
          body,
        })
        setSuccess(`Message queued for ${result.recipientCount} vendor(s).`)
        setSubject("")
        setBody("")
        await refreshAnnouncements()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send message.")
      }
    })
  }

  const handleNotifyPublished = () => {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      try {
        const result = await publishBazaarEventNotifications(eventId)
        setSuccess(`Published notice sent to ${result.recipientCount} approved vendor(s).`)
        await refreshAnnouncements()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not notify vendors.")
      }
    })
  }

  const sortedAnnouncements = useMemo(
    () =>
      [...announcements].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [announcements]
  )

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Send updates, reminders, and cancellations to approved vendors or vendors with booth
        reservations. Messages appear in vendor My Bazaars and are emailed when Resend is
        configured. Automated reminders go to booth participants 7, 3, and 1 days before the bazaar
        date (daily job).
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Send message</CardTitle>
          <CardDescription>Use a template or write a custom message.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Message type</Label>
              <Select
                value={announcementType}
                onValueChange={(value) => handleTypeChange(value as VendorAnnouncementType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sendableTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {VENDOR_ANNOUNCEMENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Audience</Label>
              <Select
                value={audience}
                onValueChange={(value) => setAudience(value as VendorAnnouncementAudience)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_approved_vendors">All approved vendors</SelectItem>
                  <SelectItem value="event_participants">Vendors with reservations</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="message-subject">Subject</Label>
            <Input
              id="message-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="message-body">Message</Label>
            <Textarea
              id="message-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSend} disabled={isPending || !subject.trim() || !body.trim()}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send message
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleNotifyPublished} disabled={isPending}>
              <Mail className="mr-2 h-4 w-4" />
              Notify: bazaar published
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sent messages</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {sortedAnnouncements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages sent for this event yet.</p>
          ) : (
            sortedAnnouncements.map((row) => (
              <div key={row.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{row.subject}</p>
                  <Badge variant="outline">{VENDOR_ANNOUNCEMENT_TYPE_LABELS[row.announcementType]}</Badge>
                  <Badge variant="secondary">{row.recipientCount} recipients</Badge>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{row.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(row.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
