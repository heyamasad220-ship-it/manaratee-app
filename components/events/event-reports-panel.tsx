"use client"

import { useMemo, useState, useTransition } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createEventExpense, deleteEventExpense } from "@/lib/events/event-expense-actions"
import {
  EVENT_REPORT_EXPENSE_CATEGORIES,
  type EventExpense,
} from "@/lib/events/event-expense-types"
import type { EventAttendeeListItem } from "@/lib/tickets/ticket-order-queries"
import type { EventTicketType } from "@/lib/tickets/ticket-types"

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

function todayIsoDate() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

export function EventReportsPanel({
  eventId,
  canManage,
  expenses,
  ticketTypes,
  attendees,
}: {
  eventId: string
  canManage: boolean
  expenses: EventExpense[]
  ticketTypes: EventTicketType[]
  attendees: EventAttendeeListItem[]
}) {
  const router = useRouter()
  const [category, setCategory] = useState<string>(EVENT_REPORT_EXPENSE_CATEGORIES[0])
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const spentCents = expenses.reduce((sum, row) => sum + (row.amount_cents || 0), 0)

  const ticketRows = useMemo(() => {
    const rows = new Map<string, { name: string; sold: number; cents: number }>()
    for (const type of ticketTypes.filter((type) => type.is_active)) {
      rows.set(type.name, { name: type.name, sold: 0, cents: 0 })
    }
    for (const attendee of attendees) {
      if (attendee.status !== "valid" && attendee.status !== "checked_in") continue
      const name = attendee.ticketTypeName || "Ticket"
      const current = rows.get(name) || { name, sold: 0, cents: 0 }
      current.sold += 1
      current.cents += attendee.ticketTypePriceCents || 0
      rows.set(name, current)
    }
    return [...rows.values()]
  }, [attendees, ticketTypes])

  const ticketCents = ticketRows.reduce((sum, row) => sum + row.cents, 0)
  const ticketsSold = ticketRows.reduce((sum, row) => sum + row.sold, 0)

  function handleAdd() {
    setError(null)
    const dollars = Number.parseFloat(amount)
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter the amount you paid.")
      return
    }
    startTransition(async () => {
      const result = await createEventExpense({
        eventId,
        expenseDate: todayIsoDate(),
        category,
        amountDollars: dollars,
        description: note.trim() || null,
        isPaid: true,
      })
      if (!result.success) {
        setError(result.error || "Could not add that expense.")
        return
      }
      setAmount("")
      setNote("")
      router.refresh()
    })
  }

  function handleRemove(id: string) {
    setError(null)
    startTransition(async () => {
      const result = await deleteEventExpense({ id, eventId })
      if (!result.success) {
        setError(result.error || "Could not remove that expense.")
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Spent</h2>
          <p className="text-sm text-muted-foreground">
            What this event paid. Pledges and donations stay on the campaign.
          </p>
        </div>

        {canManage ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5 sm:w-48">
              <Label htmlFor="expense-category">What</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="expense-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_REPORT_EXPENSE_CATEGORIES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:w-36">
              <Label htmlFor="expense-amount">Amount ($)</Label>
              <Input
                id="expense-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="expense-note">Note</Label>
              <Input
                id="expense-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional, such as the caterer"
              />
            </div>
            <Button type="button" onClick={handleAdd} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>What</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {canManage ? <TableHead className="w-12" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 4 : 3} className="text-muted-foreground">
                    No expenses yet.
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.category}</TableCell>
                    <TableCell className="text-muted-foreground">{row.description || "—"}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.amount_cents)}</TableCell>
                    {canManage ? (
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${row.category}`}
                          onClick={() => handleRemove(row.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
              <TableRow>
                <TableCell className="font-medium">Total spent</TableCell>
                <TableCell />
                <TableCell className="text-right font-medium">{formatMoney(spentCents)}</TableCell>
                {canManage ? <TableCell /> : null}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Tickets</h2>
          <p className="text-sm text-muted-foreground">
            Tickets sold for this event, by type.
          </p>
        </div>
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Sold</TableHead>
                <TableHead className="text-right">Money</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ticketRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No ticket types yet.
                  </TableCell>
                </TableRow>
              ) : (
                ticketRows.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-right">{row.sold.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.cents)}</TableCell>
                  </TableRow>
                ))
              )}
              <TableRow>
                <TableCell className="font-medium">Total</TableCell>
                <TableCell className="text-right font-medium">
                  {ticketsSold.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-medium">{formatMoney(ticketCents)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
