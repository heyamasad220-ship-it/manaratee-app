"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { DollarSign } from "lucide-react"

import {
  addVenueRentalCharge,
  applyVenueRentalCredit,
  recordVenueRentalPaymentReceived,
  sendVenueRentalPaymentReminder,
  voidVenueRentalPaymentRecord,
} from "@/lib/bookings/venue-rental-actions"
import {
  buildVenueRentalChargeBreakdown,
  deriveVenueRentalPaymentLedgerStatus,
  deriveVenueRentalStaffNextAction,
  paymentMethodLabel,
  paymentTypeHistoryLabel,
  summarizeVenueRentalPaymentLedger,
  transactionStatusLabel,
  venueRentalPaymentLedgerStatusLabel,
} from "@/lib/bookings/venue-rental-payment-ledger"
import {
  RENTAL_PAYMENT_METHODS,
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

type ChargeTypeOption =
  | "deposit"
  | "security_deposit"
  | "remaining_balance"
  | "addon_fee"
  | "cleaning_fee"
  | "adjustment"
  | "discount"
  | "installment"

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
    hours: number
  } | null
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
}: VenueRentalFinancialPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [recordOpen, setRecordOpen] = useState(false)
  const [chargeOpen, setChargeOpen] = useState(false)
  const [creditOpen, setCreditOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidPaymentId, setVoidPaymentId] = useState("")
  const [voidReason, setVoidReason] = useState("")

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

  const [chargeType, setChargeType] = useState<ChargeTypeOption>("remaining_balance")
  const [chargeAmount, setChargeAmount] = useState("")
  const [chargeDueAt, setChargeDueAt] = useState("")
  const [chargeNotes, setChargeNotes] = useState("")

  const [creditAmount, setCreditAmount] = useState("")
  const [creditNotes, setCreditNotes] = useState("")
  const [creditReference, setCreditReference] = useState("")

  const summary = useMemo(
    () => summarizeVenueRentalPaymentLedger(payments),
    [payments]
  )
  const totalCharges =
    quotedCharges?.totalCharges ?? summary.totalCharges
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
    return {
      ...breakdown,
      rentalFee: quotedCharges?.spaceFee ?? breakdown.rentalFee,
      addonFees: quotedCharges?.addonFees ?? breakdown.addonFees,
      totalCharges,
    }
  }, [summary, quotedCharges, totalCharges])
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
    if (summary.depositAmount > summary.depositReceived) {
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
            {summary.balanceDue > 0 ? (
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
                <dt className="text-muted-foreground">Credits</dt>
                <dd className="tabular-nums">{formatMoney(summary.appliedCredits)}</dd>
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
                        (payment.status === "paid_manually" ||
                          payment.status === "paid_stripe_later" ||
                          payment.status === "completed") ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => {
                              setVoidPaymentId(payment.id)
                              setVoidReason("")
                              setVoidOpen(true)
                            }}
                          >
                            Void
                          </Button>
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
            Corrections use voids, refunds, credits, or adjustments — completed
            transactions are not overwritten.
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
                  <SelectItem value="security_deposit">Security Deposit</SelectItem>
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
                  <SelectItem value="card_terminal">Card terminal</SelectItem>
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

      <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add charge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Charge type</Label>
              <Select
                value={chargeType}
                onValueChange={(value) => setChargeType(value as ChargeTypeOption)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="remaining_balance">Rental / final balance</SelectItem>
                  <SelectItem value="security_deposit">Security deposit</SelectItem>
                  <SelectItem value="cleaning_fee">Cleaning fee</SelectItem>
                  <SelectItem value="addon_fee">Equipment / add-on</SelectItem>
                  <SelectItem value="installment">Installment</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="discount">Discount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="charge-amount">Amount</Label>
              <Input
                id="charge-amount"
                type="number"
                min={0}
                step="0.01"
                value={chargeAmount}
                onChange={(event) => setChargeAmount(event.target.value)}
              />
            </div>
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={() =>
                run(async () => {
                  await addVenueRentalCharge({
                    venueRentalId: rental.id,
                    paymentType: chargeType,
                    amount: Number(chargeAmount),
                    dueAt: chargeDueAt
                      ? new Date(`${chargeDueAt}T12:00:00`).toISOString()
                      : null,
                    notes: chargeNotes,
                  })
                  setChargeOpen(false)
                  setChargeAmount("")
                  setChargeNotes("")
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
