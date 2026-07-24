"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Ban, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getEnrollmentPaymentActivityAction,
  voidEnrollmentPaymentAction,
  type EnrollmentPaymentActivity,
  type EnrollmentPaymentActivityItem,
} from "@/lib/programs/enrollment-payment-actions"

function money(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

function formatWhen(value: string | null) {
  if (!value) return "Date unknown"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date unknown"
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function EnrollmentPaymentEditDialog({
  open,
  onOpenChange,
  enrollmentId,
  participantName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  enrollmentId: string
  participantName: string
}) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [activity, setActivity] = React.useState<EnrollmentPaymentActivity | null>(
    null
  )
  const [selected, setSelected] =
    React.useState<EnrollmentPaymentActivityItem | null>(null)
  const [note, setNote] = React.useState("")

  const loadActivity = React.useEffectEvent(async () => {
    setLoading(true)
    setError(null)
    const result = await getEnrollmentPaymentActivityAction(enrollmentId)
    setLoading(false)
    if (!result.success) {
      setError(result.error)
      setActivity(null)
      return
    }
    setActivity(result.data)
  })

  React.useEffect(() => {
    if (!open) return
    setSelected(null)
    setNote("")
    void loadActivity()
  }, [open, enrollmentId])

  async function handleVoid() {
    if (!selected) return
    setBusy(true)
    setError(null)
    const result = await voidEnrollmentPaymentAction({
      enrollmentId,
      amount: selected.amount,
      scheduleId: selected.scheduleId,
      note: note || "Payment applied in error",
    })
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {selected ? "Void payment" : "Edit payments"}
          </DialogTitle>
          <DialogDescription>
            {selected
              ? `Void ${money(selected.amount)} for ${participantName}. The balance returns to what it was before this payment, and the void stays on the payment ledger for reports.`
              : `Review recent payment activity for ${participantName}. Void a mistaken payment to reopen the balance.`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading payment activity…
          </div>
        ) : selected ? (
          <div className="space-y-3">
            <div className="rounded-md border px-3 py-2 text-sm">
              <p className="font-medium">{selected.label}</p>
              <p className="text-muted-foreground">
                {money(selected.amount)} · {formatWhen(selected.occurredAt)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="void-note">Reason</Label>
              <Input
                id="void-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Wrong participant, duplicate entry, etc."
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {activity ? (
              <div className="grid grid-cols-3 gap-2 rounded-md border px-3 py-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Fee</p>
                  <p className="font-medium">{money(activity.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Received</p>
                  <p className="font-medium">{money(activity.amountPaid)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Balance</p>
                  <p className="font-medium">{money(activity.balance)}</p>
                </div>
              </div>
            ) : null}

            {activity && activity.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent payment activity found for this enrollment.
              </p>
            ) : null}

            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {(activity?.items || []).map((item) => (
                <li
                  key={item.id}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-muted-foreground">
                        {money(item.amount)} · {formatWhen(item.occurredAt)}
                      </p>
                      {item.detail ? (
                        <p className="truncate text-muted-foreground">
                          {item.detail}
                        </p>
                      ) : null}
                    </div>
                    {item.canCorrect ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          setSelected(item)
                          setNote("")
                          setError(null)
                        }}
                      >
                        <Ban className="mr-1 h-3.5 w-3.5" />
                        Void
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter className="gap-2 sm:gap-0">
          {selected ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelected(null)
                  setError(null)
                }}
                disabled={busy}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleVoid()}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Voiding…
                  </>
                ) : (
                  "Confirm void"
                )}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
