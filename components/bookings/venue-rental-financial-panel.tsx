"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Ban, DollarSign, Pencil } from "lucide-react"

import {
  addVenueRentalCharge,
  applyVenueRentalCredit,
  applyVenueRentalDiscount,
  recordVenueRentalPaymentReceived,
  sendVenueRentalPaymentReminder,
  updateVenueRentalTransactionDetails,
  voidVenueRentalPaymentRecord,
} from "@/lib/bookings/venue-rental-actions"
import {
  buildVenueRentalChargeBreakdown,
  canEditPendingCharge,
  deriveVenueRentalPaymentLedgerStatus,
  deriveVenueRentalStaffNextAction,
  isCompletedPaymentStatus,
  paymentMethodLabel,
  paymentTypeHistoryLabel,
  resolveVenueRentalDiscountDollarAmount,
  summarizeVenueRentalPaymentLedger,
  transactionStatusLabel,
  venueRentalPaymentLedgerStatusLabel,
} from "@/lib/bookings/venue-rental-payment-ledger"
import {
  RENTAL_PAYMENT_METHODS,
  VENUE_RENTAL_STATUSES,
  type RentalAddonCatalogItem,
  type RentalPaymentMethod,
  type RentalPaymentRecord,
  type VenueRentalQueueRow,
} from "@/lib/bookings/venue-rental-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Textarea } from "@/components/ui/textarea"

type DiscountTypeOption = "fixed" | "percent"

type PaymentTypeOption =
  | "deposit"
  | "security_deposit"
  | "remaining_balance"
  | "installment"
  | "addon_fee"
  | "cleaning_fee"

type VenueRentalFinancialPanelProps = {
  rental: VenueRentalQueueRow
  payments: RentalPaymentRecord[]
  canManage: boolean
  /** Deep-link action from ?action= on the rental detail URL. */
  initialAction?: string | null
  /** Space fee + selected add-ons from the request (Payments Total Charges basis). */
  quotedCharges?: {
    spaceFee: number
    addonFees: number
    totalCharges: number
    hours?: number
    discountAmount?: number
  } | null
  /** Active catalog from Venue Rentals → Settings → Add-ons. */
  addons?: RentalAddonCatalogItem[]
  /** When false, hide security deposit payment type (org policy). */
  securityDepositEnabled?: boolean
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0)
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function VenueRentalFinancialPanel({
  rental,
  payments,
  canManage,
  initialAction = null,
  quotedCharges = null,
  addons = [],
  securityDepositEnabled = false,
}: VenueRentalFinancialPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [recordOpen, setRecordOpen] = useState(false)
  const [chargeOpen, setChargeOpen] = useState(false)
  const [creditOpen, setCreditOpen] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidPaymentId, setVoidPaymentId] = useState("")
  const [voidReason, setVoidReason] = useState("")
  const [editOpen, setEditOpen] = useState(false)
  const [editPayment, setEditPayment] = useState<RentalPaymentRecord | null>(null)
  const [editMethod, setEditMethod] = useState<RentalPaymentMethod | "">(
    RENTAL_PAYMENT_METHODS.cash
  )
  const [editReference, setEditReference] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editDate, setEditDate] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [editReceiptUrl, setEditReceiptUrl] = useState("")

  const [paymentType, setPaymentType] = useState<PaymentTypeOption>("deposit")
  const [amount, setAmount] = useState("")
  const [paymentDate, setPaymentDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  )
  const [paymentMethod, setPaymentMethod] = useState<RentalPaymentMethod>(
    RENTAL_PAYMENT_METHODS.cash
  )
  const [referenceNumber, setReferenceNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [receiptUrl, setReceiptUrl] = useState("")

  const [chargeAddonId, setChargeAddonId] = useState("")
  const [chargeQuantity, setChargeQuantity] = useState("1")
  const [chargeUnitPrice, setChargeUnitPrice] = useState("")
  const [chargeDueAt, setChargeDueAt] = useState("")
  const [chargeNotes, setChargeNotes] = useState("")

  const [creditAmount, setCreditAmount] = useState("")
  const [creditNotes, setCreditNotes] = useState("")
  const [creditReference, setCreditReference] = useState("")

  const [discountType, setDiscountType] = useState<DiscountTypeOption>("fixed")
  const [discountAmount, setDiscountAmount] = useState("")
  const [discountNotes, setDiscountNotes] = useState("")
  const [discountReference, setDiscountReference] = useState("")

  const summary = useMemo(
    () => summarizeVenueRentalPaymentLedger(payments),
    [payments]
  )
  const ledgerExtras =
    summary.cleaningFeeAmount +
    summary.addonFeeAmount +
    summary.adjustmentAmount
  const totalCharges = quotedCharges
    ? quotedCharges.totalCharges + ledgerExtras
    : summary.totalCharges
  const balanceDue = Math.max(
    0,
    totalCharges - summary.amountReceived - summary.appliedCredits
  )
  const unappliedCredit = Math.max(
    0,
    summary.amountReceived + summary.appliedCredits - totalCharges
  )
  const charges = useMemo(() => {
    const breakdown = buildVenueRentalChargeBreakdown(summary)
    const policyDiscount = quotedCharges?.discountAmount ?? 0
    return {
      ...breakdown,
      rentalFee: quotedCharges?.spaceFee ?? breakdown.rentalFee,
      addonFees:
        (quotedCharges?.addonFees ?? 0) + summary.addonFeeAmount,
      cleaningFee: summary.cleaningFeeAmount,
      adjustments: summary.adjustmentAmount,
      discounts: policyDiscount + summary.discountAmount,
      totalCharges,
    }
  }, [summary, quotedCharges, totalCharges])

  const selectedChargeAddon = useMemo(
    () => addons.find((addon) => addon.id === chargeAddonId) || null,
    [addons, chargeAddonId]
  )

  const chargeLineTotal = useMemo(() => {
    const qty = Number.parseInt(chargeQuantity, 10)
    const unit = Number(chargeUnitPrice)
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unit) || unit < 0) {
      return null
    }
    return Math.round(qty * unit * 100) / 100
  }, [chargeQuantity, chargeUnitPrice])

  const discountPreview = useMemo(() => {
    try {
      return resolveVenueRentalDiscountDollarAmount({
        discountType,
        amount: Number(discountAmount),
        basisAmount: totalCharges,
      })
    } catch {
      return null
    }
  }, [discountType, discountAmount, totalCharges])
  const paymentStatus = useMemo(
    () =>
      deriveVenueRentalPaymentLedgerStatus({
        rentalStatus: rental.status,
        totalCharges,
        amountReceived: summary.amountReceived,
        balanceDue,
        unappliedCredit,
        refundableSecurity: summary.refundableSecurity,
        refundedAmount: summary.refundedAmount,
        paymentDueAt: summary.paymentDueAt,
      }),
    [
      rental.status,
      totalCharges,
      summary.amountReceived,
      balanceDue,
      unappliedCredit,
      summary.refundableSecurity,
      summary.refundedAmount,
      summary.paymentDueAt,
    ]
  )
  const nextAction = useMemo(
    () =>
      deriveVenueRentalStaffNextAction({
        rentalId: rental.id,
        paymentStatus,
        balanceDue,
      }),
    [rental.id, paymentStatus, balanceDue]
  )

  useEffect(() => {
    if (!canManage || !initialAction) return
    if (initialAction === "record_payment") setRecordOpen(true)
    if (initialAction === "add_charge") setChargeOpen(true)
  }, [initialAction, canManage])

  function resetPaymentForm() {
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setPaymentMethod(RENTAL_PAYMENT_METHODS.cash)
    setReferenceNumber("")
    setNotes("")
    setReceiptUrl("")
    setError(null)
    const awaitingDeposit =
      rental.status === VENUE_RENTAL_STATUSES.approvedPendingPayment ||
      summary.depositAmount > summary.depositReceived
    if (awaitingDeposit) {
      setPaymentType("deposit")
    } else {
      setPaymentType("remaining_balance")
    }
    setAmount(balanceDue > 0 ? String(balanceDue) : "")
  }

  function openRecord() {
    resetPaymentForm()
    setRecordOpen(true)
  }

  function openEdit(payment: RentalPaymentRecord) {
    setEditPayment(payment)
    setEditMethod(
      (payment.payment_method as RentalPaymentMethod | null) ||
        RENTAL_PAYMENT_METHODS.cash
    )
    setEditReference(payment.reference_number || "")
    setEditNotes(payment.notes || "")
    const dateSource = payment.paid_at || payment.created_at
    setEditDate(
      dateSource ? new Date(dateSource).toISOString().slice(0, 10) : ""
    )
    setEditAmount(String(Number(payment.amount) || 0))
    setEditReceiptUrl(payment.receipt_url || "")
    setError(null)
    setEditOpen(true)
  }

  function run(action: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try {
        await action()
        router.refresh()
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Something went wrong"
        )
      }
    })
  }

  const chargeRows: Array<{ label: string; amount: number }> = [
    { label: "Rental fee", amount: charges.rentalFee },
    { label: "Security deposit", amount: charges.securityDeposit },
    { label: "Cleaning fee", amount: charges.cleaningFee },
    { label: "Equipment / add-on fees", amount: charges.addonFees },
    { label: "Discounts", amount: charges.discounts },
    { label: "Adjustments", amount: charges.adjustments },
  ]

  return (
    <Card id="financial">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Financial</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Charges, collections, and transaction history. Totals are derived from
            ledger records.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={openRecord}>
              <DollarSign className="mr-1.5 h-4 w-4" />
              Record Payment
            </Button>
            <Button size="sm" variant="outline" onClick={() => setChargeOpen(true)}>
              Add Charge
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCreditOpen(true)}>
              Apply Credit
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDiscountOpen(true)}>
              Apply Discount
            </Button>
            {balanceDue > 0 ? (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  run(async () => {
                    await sendVenueRentalPaymentReminder({
                      venueRentalId: rental.id,
                    })
                  })
                }
              >
                Send Reminder
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border p-4">
            <h3 className="text-sm font-semibold">Charges</h3>
            <dl className="mt-3 space-y-2 text-sm">
              {chargeRows.map((row) => (
                <div key={row.label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="tabular-nums">
                    {row.amount > 0 || row.label === "Discounts"
                      ? formatMoney(
                          row.label === "Discounts" ? -row.amount : row.amount
                        )
                      : "—"}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t pt-2 font-medium">
                <dt>Total charges</dt>
                <dd className="tabular-nums">{formatMoney(charges.totalCharges)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-md border p-4">
            <h3 className="text-sm font-semibold">Payment summary</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Total charges</dt>
                <dd className="tabular-nums">{formatMoney(totalCharges)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Received</dt>
                <dd className="tabular-nums">{formatMoney(summary.amountReceived)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Discounts</dt>
                <dd className="tabular-nums">
                  {formatMoney(summary.discountAmount)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Credits</dt>
                <dd className="tabular-nums">
                  {formatMoney(
                    Math.max(0, summary.appliedCredits - summary.discountAmount)
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Refunded</dt>
                <dd className="tabular-nums">{formatMoney(summary.refundedAmount)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t pt-2 font-medium">
                <dt>Balance due</dt>
                <dd className="tabular-nums">{formatMoney(balanceDue)}</dd>
              </div>
              <div className="flex justify-between gap-4 items-center pt-1">
                <dt className="text-muted-foreground">Payment status</dt>
                <dd>
                  <Badge variant="secondary">
                    {venueRentalPaymentLedgerStatusLabel(paymentStatus)}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Payment due date</dt>
                <dd>{formatDate(summary.paymentDueAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Next action</dt>
                <dd className="text-right">{nextAction.label}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">Transactions</h3>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No charges or payments yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(payment.paid_at || payment.created_at)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(Number(payment.amount) || 0)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {paymentTypeHistoryLabel(payment.payment_type)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {payment.payment_method
                          ? paymentMethodLabel(payment.payment_method)
                          : payment.status === "paid_stripe_later"
                            ? "Online"
                            : payment.status === "paid_manually"
                              ? "Manual"
                              : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {transactionStatusLabel(payment.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate text-sm text-muted-foreground">
                        {payment.reference_number ||
                          payment.stripe_payment_intent_id ||
                          "—"}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                        {payment.notes || "—"}
                      </TableCell>
                      <TableCell>
                        {canManage &&
                        (isCompletedPaymentStatus(payment.status) ||
                          canEditPendingCharge(payment.status)) ? (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label="Edit transaction"
                              title="Edit"
                              onClick={() => openEdit(payment)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {isCompletedPaymentStatus(payment.status) ? (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                aria-label="Void transaction"
                                title="Void"
                                onClick={() => {
                                  setVoidPaymentId(payment.id)
                                  setVoidReason("")
                                  setVoidOpen(true)
                                }}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        ) : payment.receipt_url ? (
                          <Button size="sm" variant="ghost" asChild>
                            <a
                              href={payment.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Receipt
                            </a>
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Edit method, reference, notes, or date on a transaction. To correct a
            completed amount, void it and record a new payment.
          </p>
        </div>
      </CardContent>

      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Transaction type</Label>
              <Select
                value={paymentType}
                onValueChange={(value) => setPaymentType(value as PaymentTypeOption)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="installment">Installment</SelectItem>
                  <SelectItem value="remaining_balance">Final Payment</SelectItem>
                  {securityDepositEnabled ? (
                    <SelectItem value="security_deposit">Security Deposit</SelectItem>
                  ) : null}
                  <SelectItem value="cleaning_fee">Cleaning Fee</SelectItem>
                  <SelectItem value="addon_fee">Add-on / Equipment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fin-amount">Amount</Label>
                <Input
                  id="fin-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fin-date">Payment date</Label>
                <Input
                  id="fin-date"
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) =>
                  setPaymentMethod(value as RentalPaymentMethod)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="card_terminal">Credit / debit card</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fin-ref">Reference / check number</Label>
              <Input
                id="fin-ref"
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fin-receipt">Receipt URL (optional)</Label>
              <Input
                id="fin-receipt"
                value={receiptUrl}
                onChange={(event) => setReceiptUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fin-notes">Notes</Label>
              <Textarea
                id="fin-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={() =>
                run(async () => {
                  await recordVenueRentalPaymentReceived({
                    venueRentalId: rental.id,
                    paymentType,
                    amount: Number(amount),
                    paymentMethod,
                    paymentDate,
                    referenceNumber,
                    notes,
                    receiptUrl,
                  })
                  setRecordOpen(false)
                })
              }
            >
              {isPending ? "Saving..." : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={chargeOpen}
        onOpenChange={(open) => {
          setChargeOpen(open)
          if (open) {
            const first = addons[0]
            setChargeAddonId(first?.id || "")
            setChargeQuantity("1")
            setChargeUnitPrice(
              first ? String(Number(first.defaultPrice) || 0) : ""
            )
            setChargeDueAt("")
            setChargeNotes("")
            setError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add charge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Charge catalog add-ons (table covers, chair covers, etc.) or
              post-event fees like Extra Cleaning and Damage. Manage the list in
              Venue Rentals → Settings → Add-ons.
            </p>
            {addons.length === 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No active add-ons yet. Add items under Settings → Add-ons, then
                return here to charge them.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Add-on / fee</Label>
                  <Select
                    value={chargeAddonId}
                    onValueChange={(value) => {
                      setChargeAddonId(value)
                      const addon = addons.find((item) => item.id === value)
                      setChargeUnitPrice(
                        addon ? String(Number(addon.defaultPrice) || 0) : ""
                      )
                      setChargeQuantity("1")
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an add-on" />
                    </SelectTrigger>
                    <SelectContent>
                      {addons.map((addon) => (
                        <SelectItem key={addon.id} value={addon.id}>
                          {addon.name}
                          {addon.defaultPrice > 0
                            ? ` · ${formatMoney(addon.defaultPrice)}`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedChargeAddon?.description ? (
                    <p className="text-xs text-muted-foreground">
                      {selectedChargeAddon.description}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="charge-qty">Quantity</Label>
                    <Input
                      id="charge-qty"
                      type="number"
                      min={1}
                      step="1"
                      value={chargeQuantity}
                      onChange={(event) => setChargeQuantity(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="charge-unit">Unit price ($)</Label>
                    <Input
                      id="charge-unit"
                      type="number"
                      min={0}
                      step="0.01"
                      value={chargeUnitPrice}
                      onChange={(event) => setChargeUnitPrice(event.target.value)}
                    />
                  </div>
                </div>
                {chargeLineTotal != null ? (
                  <p className="text-sm font-medium">
                    Line total: {formatMoney(chargeLineTotal)}
                  </p>
                ) : null}
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="charge-due">Due date (optional)</Label>
              <Input
                id="charge-due"
                type="date"
                value={chargeDueAt}
                onChange={(event) => setChargeDueAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="charge-notes">Notes</Label>
              <Textarea
                id="charge-notes"
                rows={3}
                value={chargeNotes}
                onChange={(event) => setChargeNotes(event.target.value)}
                placeholder="Optional details (e.g. damaged chairs, overtime cleanup)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                isPending ||
                !chargeAddonId ||
                chargeLineTotal == null ||
                chargeLineTotal <= 0
              }
              onClick={() =>
                run(async () => {
                  await addVenueRentalCharge({
                    venueRentalId: rental.id,
                    rentalAddonId: chargeAddonId,
                    quantity: Number.parseInt(chargeQuantity, 10) || 1,
                    unitPrice: Number(chargeUnitPrice),
                    amount: chargeLineTotal ?? undefined,
                    dueAt: chargeDueAt
                      ? new Date(`${chargeDueAt}T12:00:00`).toISOString()
                      : null,
                    notes: chargeNotes,
                  })
                  setChargeOpen(false)
                  setChargeAddonId("")
                  setChargeQuantity("1")
                  setChargeUnitPrice("")
                  setChargeNotes("")
                  setChargeDueAt("")
                })
              }
            >
              {isPending ? "Saving..." : "Add charge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creditOpen} onOpenChange={setCreditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply credit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Credits reduce balance due (goodwill, overpayment, etc.). For a
              price reduction, use Apply Discount instead.
            </p>
            <div className="space-y-2">
              <Label htmlFor="credit-amount">Amount</Label>
              <Input
                id="credit-amount"
                type="number"
                min={0}
                step="0.01"
                value={creditAmount}
                onChange={(event) => setCreditAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="credit-ref">Reference</Label>
              <Input
                id="credit-ref"
                value={creditReference}
                onChange={(event) => setCreditReference(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="credit-notes">Notes</Label>
              <Textarea
                id="credit-notes"
                rows={3}
                value={creditNotes}
                onChange={(event) => setCreditNotes(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={() =>
                run(async () => {
                  await applyVenueRentalCredit({
                    venueRentalId: rental.id,
                    amount: Number(creditAmount),
                    notes: creditNotes,
                    referenceNumber: creditReference,
                  })
                  setCreditOpen(false)
                  setCreditAmount("")
                  setCreditNotes("")
                  setCreditReference("")
                })
              }
            >
              {isPending ? "Saving..." : "Apply credit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply discount</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              One-time discount for this rental. Percent is calculated from
              current total charges ({formatMoney(totalCharges)}).
            </p>
            <div className="space-y-2">
              <Label>Discount type</Label>
              <Select
                value={discountType}
                onValueChange={(value) =>
                  setDiscountType(value as DiscountTypeOption)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed amount ($)</SelectItem>
                  <SelectItem value="percent">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-amount">
                {discountType === "percent" ? "Percent" : "Amount ($)"}
              </Label>
              <Input
                id="discount-amount"
                type="number"
                min={0}
                max={discountType === "percent" ? 100 : undefined}
                step={discountType === "percent" ? "1" : "0.01"}
                value={discountAmount}
                onChange={(event) => setDiscountAmount(event.target.value)}
              />
              {discountPreview != null ? (
                <p className="text-xs text-muted-foreground">
                  Discount applied: {formatMoney(discountPreview)}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-ref">Reference</Label>
              <Input
                id="discount-ref"
                value={discountReference}
                onChange={(event) => setDiscountReference(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-notes">Notes</Label>
              <Textarea
                id="discount-notes"
                rows={3}
                value={discountNotes}
                onChange={(event) => setDiscountNotes(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isPending || discountPreview == null}
              onClick={() =>
                run(async () => {
                  await applyVenueRentalDiscount({
                    venueRentalId: rental.id,
                    discountType,
                    amount: Number(discountAmount),
                    basisAmount: totalCharges,
                    notes: discountNotes,
                    referenceNumber: discountReference,
                  })
                  setDiscountOpen(false)
                  setDiscountType("fixed")
                  setDiscountAmount("")
                  setDiscountNotes("")
                  setDiscountReference("")
                })
              }
            >
              {isPending ? "Saving..." : "Apply discount"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setEditPayment(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editPayment ? (
              <p className="text-sm text-muted-foreground">
                {paymentTypeHistoryLabel(editPayment.payment_type)} ·{" "}
                {transactionStatusLabel(editPayment.status)}
                {canEditPendingCharge(editPayment.status)
                  ? " — amount can be updated while pending."
                  : " — change method, date, reference, or notes. Void to correct amount."}
              </p>
            ) : null}
            {canEditPendingCharge(editPayment?.status || "") ? (
              <div className="space-y-2">
                <Label htmlFor="edit-amount">Amount</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={editAmount}
                  onChange={(event) => setEditAmount(event.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select
                value={editMethod || RENTAL_PAYMENT_METHODS.other}
                onValueChange={(value) =>
                  setEditMethod(value as RentalPaymentMethod)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="card_terminal">Credit / debit card</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date">Payment date</Label>
              <Input
                id="edit-date"
                type="date"
                value={editDate}
                onChange={(event) => setEditDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ref">Reference / check number</Label>
              <Input
                id="edit-ref"
                value={editReference}
                onChange={(event) => setEditReference(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-receipt">Receipt URL</Label>
              <Input
                id="edit-receipt"
                value={editReceiptUrl}
                onChange={(event) => setEditReceiptUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                rows={3}
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isPending || !editPayment}
              onClick={() =>
                run(async () => {
                  if (!editPayment) return
                  await updateVenueRentalTransactionDetails({
                    paymentId: editPayment.id,
                    paymentMethod: editMethod || null,
                    referenceNumber: editReference,
                    notes: editNotes,
                    paymentDate: editDate || null,
                    receiptUrl: editReceiptUrl,
                    amount: canEditPendingCharge(editPayment.status)
                      ? Number(editAmount)
                      : undefined,
                  })
                  setEditOpen(false)
                  setEditPayment(null)
                })
              }
            >
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Voiding keeps the original transaction in the audit trail and removes it from
              received totals. Prefer this over deleting completed payments.
            </p>
            <div className="space-y-2">
              <Label htmlFor="void-reason">Reason</Label>
              <Textarea
                id="void-reason"
                rows={3}
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending || !voidPaymentId}
              onClick={() =>
                run(async () => {
                  await voidVenueRentalPaymentRecord({
                    paymentId: voidPaymentId,
                    reason: voidReason,
                  })
                  setVoidOpen(false)
                })
              }
            >
              {isPending ? "Voiding..." : "Void payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
