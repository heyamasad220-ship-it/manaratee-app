"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  createEventExpense,
  deleteEventExpense,
  listEventExpenses,
  type EventExpense,
} from "@/lib/events/event-expense-actions"
import { EVENT_EXPENSE_CATEGORIES } from "@/lib/events/event-expense-types"
import { updateEventLinkedCampaign } from "@/lib/events/internal-event-actions"
import type {
  EventCampaignOption,
  LinkedCampaignSummary,
} from "@/lib/events/event-finance-types"

function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function InternalEventFinanceTab({
  eventId,
  canManage = true,
  initialExpenses,
  financeSummary,
  linkedCampaignId = null,
  linkedCampaignSummary = null,
  campaignOptions = [],
}: {
  eventId: string
  canManage?: boolean
  initialExpenses?: EventExpense[]
  financeSummary?: {
    ticketRevenueCents: number
    donationRevenueCents?: number
    expenseCents: number
    refundCents: number
    netCents: number
    currency: string
  } | null
  linkedCampaignId?: string | null
  linkedCampaignSummary?: LinkedCampaignSummary | null
  campaignOptions?: EventCampaignOption[]
}) {
  const router = useRouter()
  const NONE = "__none__"
  const [selectedCampaignId, setSelectedCampaignId] = useState(
    linkedCampaignId || NONE
  )
  const [campaignError, setCampaignError] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<EventExpense[]>(initialExpenses || [])
  const [loading, setLoading] = useState(!initialExpenses)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [expenseDate, setExpenseDate] = useState(todayIsoDate)
  const [category, setCategory] = useState<string>(EVENT_EXPENSE_CATEGORIES[0])
  const [amount, setAmount] = useState("")
  const [payee, setPayee] = useState("")
  const [description, setDescription] = useState("")

  useEffect(() => {
    if (initialExpenses) {
      setExpenses(initialExpenses)
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const rows = await listEventExpenses(eventId)
      if (!cancelled) {
        setExpenses(rows)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eventId, initialExpenses])

  const totals = useMemo(() => {
    let totalCents = 0
    let paidCents = 0
    let currency = "USD"
    for (const row of expenses) {
      totalCents += row.amount_cents || 0
      if (row.is_paid) paidCents += row.amount_cents || 0
      currency = row.currency || currency
    }
    return {
      totalCents,
      paidCents,
      unpaidCents: totalCents - paidCents,
      currency,
      count: expenses.length,
    }
  }, [expenses])

  useEffect(() => {
    setSelectedCampaignId(linkedCampaignId || NONE)
  }, [linkedCampaignId])

  function handleSaveCampaignLink() {
    setCampaignError(null)
    startTransition(async () => {
      const result = await updateEventLinkedCampaign({
        eventId,
        linkedCampaignId:
          selectedCampaignId === NONE ? null : selectedCampaignId,
      })
      if (!result.success) {
        setCampaignError(result.error || "Could not link campaign.")
        return
      }
      router.refresh()
    })
  }

  function handleCreate() {
    setError(null)
    const dollars = Number.parseFloat(amount)
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError("Enter a valid amount in dollars.")
      return
    }
    startTransition(async () => {
      const result = await createEventExpense({
        eventId,
        expenseDate,
        category,
        amountDollars: dollars,
        payee: payee || null,
        description: description || null,
      })
      if (!result.success) {
        setError(result.error || "Could not add expense.")
        return
      }
      setAmount("")
      setPayee("")
      setDescription("")
      const rows = await listEventExpenses(eventId)
      setExpenses(rows)
      router.refresh()
    })
  }

  function handleDelete(id: string) {
    setError(null)
    startTransition(async () => {
      const result = await deleteEventExpense({ id, eventId })
      if (!result.success) {
        setError(result.error || "Could not delete expense.")
        return
      }
      setExpenses((prev) => prev.filter((row) => row.id !== id))
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {campaignOptions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fundraising campaign</CardTitle>
            <p className="text-sm text-muted-foreground">
              Link a donations campaign to include pledge and gift totals on this
              event&apos;s finance summary.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>Campaign</Label>
                <Select
                  value={selectedCampaignId}
                  onValueChange={setSelectedCampaignId}
                  disabled={!canManage || isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {campaignOptions.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canManage ? (
                <Button
                  type="button"
                  onClick={handleSaveCampaignLink}
                  disabled={isPending}
                >
                  Save link
                </Button>
              ) : null}
            </div>
            {campaignError ? (
              <p className="text-sm text-destructive">{campaignError}</p>
            ) : null}
            {linkedCampaignSummary ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Gifts received</p>
                  <p className="text-lg font-semibold">
                    {formatMoney(
                      linkedCampaignSummary.raisedCents,
                      linkedCampaignSummary.currency
                    )}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Pledges</p>
                  <p className="text-lg font-semibold">
                    {formatMoney(
                      linkedCampaignSummary.pledgeCents,
                      linkedCampaignSummary.currency
                    )}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Pledge balance</p>
                  <p className="text-lg font-semibold">
                    {formatMoney(
                      linkedCampaignSummary.pledgeBalanceCents,
                      linkedCampaignSummary.currency
                    )}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Pledge donors</p>
                  <p className="text-lg font-semibold">
                    {linkedCampaignSummary.donorCount}
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {financeSummary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ticket revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatMoney(
                  financeSummary.ticketRevenueCents,
                  financeSummary.currency
                )}
              </p>
            </CardContent>
          </Card>
          {(financeSummary.donationRevenueCents ?? 0) > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Campaign gifts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatMoney(
                    financeSummary.donationRevenueCents ?? 0,
                    financeSummary.currency
                  )}
                </p>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Refunds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatMoney(
                  financeSummary.refundCents,
                  financeSummary.currency
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatMoney(
                  financeSummary.expenseCents,
                  financeSummary.currency
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Event net
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatMoney(financeSummary.netCents, financeSummary.currency)}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatMoney(totals.totalCents, totals.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatMoney(totals.paidCents, totals.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unpaid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatMoney(totals.unpaidCents, totals.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Line items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totals.count}</p>
          </CardContent>
        </Card>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add expense</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="expense-date">Date</Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_EXPENSE_CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-amount">Amount ($)</Label>
                <Input
                  id="expense-amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-payee">Payee</Label>
                <Input
                  id="expense-payee"
                  value={payee}
                  onChange={(e) => setPayee(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-description">Description</Label>
              <Input
                id="expense-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="button" onClick={handleCreate} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add expense
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading expenses…</p>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Payee</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {canManage ? <TableHead className="w-[60px]" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.expense_date}</TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>{row.payee || "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">
                        {row.description || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(row.amount_cents, row.currency)}
                      </TableCell>
                      {canManage ? (
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={isPending}
                            onClick={() => handleDelete(row.id)}
                            aria-label="Delete expense"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
