"use client"

import { useRef, useState, useTransition } from "react"
import { ScanLine } from "lucide-react"

import { TicketQrCamera } from "@/components/tickets/ticket-qr-camera"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useIsMobile } from "@/hooks/use-mobile"
import { ticketCodeFromQrPayload } from "@/lib/tickets/ticket-qr-payload"
import {
  checkInEventTicketByCode,
  checkInOrgTicketByCode,
} from "@/lib/tickets/ticket-order-actions"

export function TicketCheckInScanner({
  eventId,
  onCheckedIn,
}: {
  /** When set, only tickets for this event are accepted. */
  eventId?: string
  onCheckedIn?: () => void
}) {
  const isPhone = useIsMobile()
  const [scanCode, setScanCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const pendingRef = useRef(false)

  function submitCode(raw: string) {
    if (pendingRef.current) return
    const code = ticketCodeFromQrPayload(raw) || raw.trim().toUpperCase()
    if (!code) return
    pendingRef.current = true
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        const result = eventId
          ? await checkInEventTicketByCode({
              eventId,
              ticketCode: code,
              checkedIn: true,
            })
          : await checkInOrgTicketByCode({
              ticketCode: code,
              checkedIn: true,
            })
        if (!result.success) {
          setError(result.error)
          return
        }
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(result.alreadyCheckedIn ? [40, 40, 40] : 50)
        }
        const eventLabel =
          "eventName" in result && result.eventName ? ` — ${result.eventName}` : ""
        setMessage(
          result.alreadyCheckedIn
            ? `${result.attendeeName} was already checked in${eventLabel}.`
            : `Checked in ${result.attendeeName}${eventLabel}.`
        )
        setScanCode("")
        onCheckedIn?.()
      } finally {
        pendingRef.current = false
      }
    })
  }

  function handleScanCheckIn() {
    submitCode(scanCode)
  }

  const scopeHint = eventId
    ? " Limited to this event."
    : " Works for any ticketed event in this organization."

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanLine className="h-4 w-4" />
          {isPhone ? "Check-in scanner" : "Check in"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {isPhone
            ? `Tap Start camera and point it at the ticket QR, or type a code.${scopeHint}`
            : `Type the ticket code, then Check in.${scopeHint} Use a phone to scan the QR.`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPhone ? <TicketQrCamera onCode={submitCode} paused={isPending} /> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Input
              value={scanCode}
              onChange={(event) => setScanCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  handleScanCheckIn()
                }
              }}
              placeholder={isPhone ? "Or type a ticket code" : "Ticket code"}
              autoComplete="off"
              className="font-mono uppercase tracking-wider"
            />
          </div>
          <Button
            type="button"
            disabled={isPending || !scanCode.trim()}
            onClick={handleScanCheckIn}
          >
            Check in
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      </CardContent>
    </Card>
  )
}
