"use client"

import { useState, useTransition } from "react"
import { Bell, Mail } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { markVendorInboxMessageRead } from "@/lib/vendor-hub/vendor-announcement-actions"
import {
  VENDOR_ANNOUNCEMENT_TYPE_LABELS,
  type VendorInboxMessage,
} from "@/lib/vendor-hub/vendor-announcement-types"

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function VendorInboxSection({ messages }: { messages: VendorInboxMessage[] }) {
  const [rows, setRows] = useState(messages)
  const [selected, setSelected] = useState<VendorInboxMessage | null>(null)
  const [, startTransition] = useTransition()

  if (rows.length === 0) {
    return null
  }

  const unreadCount = rows.filter((row) => !row.readAt).length

  const openMessage = (message: VendorInboxMessage) => {
    setSelected(message)
    if (!message.readAt) {
      startTransition(async () => {
        try {
          await markVendorInboxMessageRead(message.recipientId)
          setRows((current) =>
            current.map((row) =>
              row.recipientId === message.recipientId
                ? { ...row, readAt: new Date().toISOString() }
                : row
            )
          )
        } catch (error) {
          console.error("markVendorInboxMessageRead:", error)
        }
      })
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Messages from organizers
            {unreadCount > 0 ? (
              <Badge variant="secondary">{unreadCount} unread</Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Event updates, reminders, and cancellations from your bazaar communities.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {rows.slice(0, 8).map((message) => (
            <button
              key={message.recipientId}
              type="button"
              onClick={() => openMessage(message)}
              className="flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{message.subject}</span>
                {!message.readAt ? <Badge variant="outline">New</Badge> : null}
                <Badge variant="secondary">
                  {VENDOR_ANNOUNCEMENT_TYPE_LABELS[message.announcementType]}
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground">
                {message.organizationName} · {message.eventName}
              </span>
              <span className="text-xs text-muted-foreground">{formatDate(message.createdAt)}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.subject}</DialogTitle>
                <DialogDescription>
                  {selected.organizationName} · {selected.eventName} ·{" "}
                  {formatDate(selected.createdAt)}
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p>{selected.body}</p>
              </div>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
