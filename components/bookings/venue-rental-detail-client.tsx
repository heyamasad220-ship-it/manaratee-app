"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  ShieldAlert,
  XCircle,
} from "lucide-react"

import {
  approveVenueRentalRequest,
  approveSecurityDepositRefund,
  cancelVenueRental,
  declineVenueRentalRequest,
  extendVenueRentalHold,
  forceBookVenueRentalWithOverride,
  markRentalPaymentPaid,
  markVenueRentalCompletedAndAwaitingRefund,
} from "@/lib/bookings/venue-rental-actions"
import { formatVenueRentalTimeRange } from "@/lib/bookings/venue-rental-format"
import {
  canStaffCancelVenueRental,
  canStaffForceBookVenueRental,
  getVenueRentalCalendarColorClasses,
  getVenueRentalStatusLabel,
  shouldCancelVenueRentalAfterPayment,
  summarizeOutstandingRentalPayments,
} from "@/lib/bookings/venue-rental-status"
import type {
  RentalPaymentRecord,
  VenueRentalQueueRow,
  VenueRentalStatus,
} from "@/lib/bookings/venue-rental-types"
import {
  RENTAL_PAYMENT_STATUSES,
  RENTAL_PAYMENT_TYPES,
  VENUE_RENTAL_STATUSES,
} from "@/lib/bookings/venue-rental-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { VenueRentalBillingContactCard } from "@/components/bookings/venue-rental-billing-contact-card"

type VenueRentalDetailClientProps = {
  rental: VenueRentalQueueRow
  payments: RentalPaymentRecord[]
  canManage: boolean
  canViewFinance: boolean
}

function isAwaitingPaymentStatus(status: VenueRentalStatus): boolean {
  return (
    status === VENUE_RENTAL_STATUSES.approvedPendingPayment ||
    status === VENUE_RENTAL_STATUSES.depositPaid ||
    status === VENUE_RENTAL_STATUSES.securityDepositPaid
  )
}

export function VenueRentalDetailClient({
  rental,
  payments,
  canManage,
  canViewFinance,
}: VenueRentalDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [depositAmount, setDepositAmount] = useState("500")
  const [securityDepositAmount, setSecurityDepositAmount] = useState("250")
  const [remainingBalanceAmount, setRemainingBalanceAmount] = useState("0")
  const [declineReason, setDeclineReason] = useState("")
  const [extendReason, setExtendReason] = useState("")
  const [refundAmount, setRefundAmount] = useState("")
  const [refundReason, setRefundReason] = useState("")
  const [cancelReason, setCancelReason] = useState("")
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [forceBookReason, setForceBookReason] = useState("")
  const [showForceBookDialog, setShowForceBookDialog] = useState(false)

  const statusClasses = getVenueRentalCalendarColorClasses(rental.calendarColor)

  const paymentSummary = useMemo(() => {
    const paidStatuses = new Set<string>([
      RENTAL_PAYMENT_STATUSES.paidManually,
      RENTAL_PAYMENT_STATUSES.paidStripeLater,
    ])

    const deposit = payments.find((payment) => payment.payment_type === RENTAL_PAYMENT_TYPES.deposit)
    const security = payments.find(
      (payment) => payment.payment_type === RENTAL_PAYMENT_TYPES.securityDeposit
    )
    const remaining = payments.find(
      (payment) => payment.payment_type === RENTAL_PAYMENT_TYPES.remainingBalance
    )

    return {
      deposit,
      security,
      remaining,
      depositPaid: deposit ? paidStatuses.has(deposit.status) : false,
      securityPaid: security ? paidStatuses.has(security.status) : false,
    }
  }, [payments])

  const cancelAfterPayment = useMemo(
    () =>
      shouldCancelVenueRentalAfterPayment({
        status: rental.status,
        depositPaid: paymentSummary.depositPaid,
        securityDepositPaid: paymentSummary.securityPaid,
      }),
    [paymentSummary.depositPaid, paymentSummary.securityPaid, rental.status]
  )

  const canCancelRental = canManage && canStaffCancelVenueRental(rental.status)
  const canForceBookRental =
    canManage && canViewFinance && canStaffForceBookVenueRental(rental.status)

  const outstandingPayments = useMemo(() => {
    const remaining = payments.find(
      (payment) => payment.payment_type === RENTAL_PAYMENT_TYPES.remainingBalance
    )
    const remainingPaid =
      remaining?.status === RENTAL_PAYMENT_STATUSES.paidManually ||
      remaining?.status === RENTAL_PAYMENT_STATUSES.paidStripeLater

    return summarizeOutstandingRentalPayments({
      depositPaid: paymentSummary.depositPaid,
      securityDepositPaid: paymentSummary.securityPaid,
      remainingBalanceDue: Boolean(remaining),
      remainingPaid,
    })
  }, [paymentSummary.depositPaid, paymentSummary.securityPaid, payments])

  async function submitCancellation() {
    await cancelVenueRental({
      venueRentalId: rental.id,
      reason: cancelReason,
      afterPayment: cancelAfterPayment,
    })
    setShowCancelDialog(false)
    setCancelReason("")
  }

  async function submitForceBook() {
    await forceBookVenueRentalWithOverride({
      venueRentalId: rental.id,
      reason: forceBookReason,
      acknowledgeConflict: rental.hasConflict,
      acknowledgeOutstandingPayments: outstandingPayments.requiresPaymentAcknowledgement,
    })
    setShowForceBookDialog(false)
    setForceBookReason("")
  }

  function runAction(action: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try {
        await action()
        router.refresh()
      } catch (actionError) {
        setError(
          actionError instanceof Error ? actionError.message : "Action failed."
        )
      }
    })
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/bookings/requests">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to requests
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Rental {rental.shortId}</h2>
          <p className="text-sm text-muted-foreground">
            Submitted {rental.submittedAtLabel}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className={`${statusClasses.bg} ${statusClasses.text}`}>
          {getVenueRentalStatusLabel(rental.status)}
        </Badge>
        {rental.hasConflict ? (
          <Badge variant="secondary" className="bg-red-100 text-red-700">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Conflict detected
          </Badge>
        ) : null}
        {rental.holdExpiresAt ? (
          <Badge variant="outline">
            <Clock className="mr-1 h-3 w-3" />
            Hold expires {new Date(rental.holdExpiresAt).toLocaleString()}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{rental.customerName}</p>
            <p className="text-muted-foreground">
              {rental.customerEmail || "No email on file"}
            </p>
            <p className="text-muted-foreground">
              {rental.customerPhone || "No phone on file"}
            </p>
            {rental.eventTypeName ? (
              <p>Event type: {rental.eventTypeName}</p>
            ) : null}
            {rental.notes ? <p className="whitespace-pre-wrap">{rental.notes}</p> : null}
          </CardContent>
        </Card>

        {canManage ? (
          <VenueRentalBillingContactCard
            rentalId={rental.id}
            billingContactId={rental.billingContactId}
            billingContactName={rental.billingContactName}
            billingContactType={rental.billingContactType}
            canManage={canManage}
          />
        ) : null}

        <Card className={canManage ? "lg:col-span-2" : undefined}>
          <CardHeader>
            <CardTitle className="text-base">Spaces</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {rental.spaces.map((space) => (
              <div key={`${space.venueId}-${space.startAt}`} className="rounded border p-3">
                <p className="font-medium">{space.venueName}</p>
                <p className="text-muted-foreground">
                  {formatVenueRentalTimeRange(space.startAt, space.endAt)}
                </p>
              </div>
            ))}
            {rental.addons.length ? (
              <div>
                <p className="mb-2 font-medium">Add-ons</p>
                <ul className="space-y-1 text-muted-foreground">
                  {rental.addons.map((addon) => (
                    <li key={addon.id}>
                      {addon.name} × {addon.quantity}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {canManage && canViewFinance && rental.status === VENUE_RENTAL_STATUSES.awaitingSupervisorApproval ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supervisor approval</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label>Deposit (non-refundable)</Label>
              <Input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Security deposit (refundable)</Label>
              <Input
                value={securityDepositAmount}
                onChange={(e) => setSecurityDepositAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Remaining balance</Label>
              <Input
                value={remainingBalanceAmount}
                onChange={(e) => setRemainingBalanceAmount(e.target.value)}
              />
            </div>
            <div className="md:col-span-3 flex flex-wrap gap-2">
              <Button
                disabled={isPending}
                onClick={() =>
                  runAction(async () => {
                    await approveVenueRentalRequest({
                      venueRentalId: rental.id,
                      depositAmount: Number(depositAmount || 0),
                      securityDepositAmount: Number(securityDepositAmount || 0),
                      remainingBalanceAmount: Number(remainingBalanceAmount || 0) || undefined,
                    })
                  })
                }
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve & request payment
              </Button>
            </div>
            <div className="md:col-span-3 grid gap-2">
              <Label>Decline reason</Label>
              <Textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  runAction(async () => {
                    await declineVenueRentalRequest({
                      venueRentalId: rental.id,
                      reason: declineReason,
                    })
                  })
                }
              >
                <XCircle className="mr-2 h-4 w-4" />
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canManage && isAwaitingPaymentStatus(rental.status) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extend hold</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 max-w-xl">
            <Textarea
              placeholder="Reason for extending the payment hold"
              value={extendReason}
              onChange={(e) => setExtendReason(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() =>
                runAction(async () => {
                  await extendVenueRentalHold({
                    venueRentalId: rental.id,
                    reason: extendReason,
                  })
                })
              }
            >
              Extend hold 72 hours
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {canViewFinance && payments.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payments.map((payment) => {
              const isPaid =
                payment.status === RENTAL_PAYMENT_STATUSES.paidManually ||
                payment.status === RENTAL_PAYMENT_STATUSES.paidStripeLater

              return (
                <div
                  key={payment.id}
                  className="flex flex-col gap-2 rounded border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium capitalize">
                      {payment.payment_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ${Number(payment.amount).toFixed(2)} · {payment.status.replace(/_/g, " ")}
                    </p>
                    {payment.payment_type === RENTAL_PAYMENT_TYPES.deposit ? (
                      <p className="text-xs text-muted-foreground">Non-refundable</p>
                    ) : null}
                  </div>
                  {canManage && !isPaid && payment.payment_type !== RENTAL_PAYMENT_TYPES.refund ? (
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() =>
                        runAction(async () => {
                          await markRentalPaymentPaid({
                            paymentId: payment.id,
                            status: "paid_manually",
                          })
                        })
                      }
                    >
                      Mark paid manually
                    </Button>
                  ) : null}
                </div>
              )
            })}
            {paymentSummary.depositPaid && paymentSummary.securityPaid ? (
              <p className="text-sm text-emerald-700">
                Deposit and security deposit are paid. Rental is confirmed when both are recorded.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Booking confirms only after both deposit and security deposit are marked paid.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {canManage && rental.status === VENUE_RENTAL_STATUSES.confirmed ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Post-event inspection</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              disabled={isPending}
              onClick={() =>
                runAction(async () => {
                  await markVenueRentalCompletedAndAwaitingRefund({
                    venueRentalId: rental.id,
                  })
                })
              }
            >
              Mark completed &amp; awaiting refund approval
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {canManage &&
      canViewFinance &&
      rental.status === VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Security deposit refund</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 max-w-xl">
            <p className="text-sm text-muted-foreground">
              Deposit is non-refundable. Only the security deposit can be refunded after inspection.
            </p>
            <div className="grid gap-2">
              <Label>Refund amount</Label>
              <Input value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Approval reason</Label>
              <Textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
            </div>
            <Button
              disabled={isPending}
              onClick={() =>
                runAction(async () => {
                  await approveSecurityDepositRefund({
                    venueRentalId: rental.id,
                    refundAmount: Number(refundAmount || 0),
                    reason: refundReason,
                  })
                })
              }
            >
              Approve security deposit refund
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {canForceBookRental ? (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-950">
              <ShieldAlert className="h-4 w-4" />
              Force-book override (exception only)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 max-w-2xl">
            <p className="text-sm text-amber-950">
              Force-book confirms this rental without completing the normal approval and
              payment workflow. Use only for operational exceptions. Payments are not marked
              paid automatically — record them separately if money has been collected.
            </p>
            {rental.hasConflict ? (
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                <p className="font-medium">Calendar conflict detected</p>
                <p className="mt-1">
                  Another reservation overlaps one or more spaces on this rental. Force-booking
                  will confirm this rental anyway and may double-book the calendar.
                </p>
              </div>
            ) : null}
            {outstandingPayments.outstandingLabels.length ? (
              <div className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-amber-950">
                <p className="font-medium">Outstanding payments</p>
                <ul className="mt-1 list-disc pl-5">
                  {outstandingPayments.outstandingLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Required deposits appear paid or not yet configured. Force-book still bypasses
                the standard confirmation path.
              </p>
            )}
            <div className="grid gap-2">
              <Label htmlFor="force-book-reason">Override reason</Label>
              <Textarea
                id="force-book-reason"
                placeholder="Document why this exception is authorized"
                value={forceBookReason}
                onChange={(e) => setForceBookReason(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              className="border-amber-500 text-amber-950 hover:bg-amber-100"
              disabled={isPending || !forceBookReason.trim()}
              onClick={() => setShowForceBookDialog(true)}
            >
              <ShieldAlert className="mr-2 h-4 w-4" />
              Review force-book override
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {canCancelRental ? (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-base text-red-900">Cancel rental</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 max-w-xl">
            <p className="text-sm text-muted-foreground">
              Cancelling releases the calendar hold for this rental. Email the customer manually
              to confirm cancellation and any refund policy.
            </p>
            {cancelAfterPayment ? (
              <p className="text-sm text-amber-900">
                Payments have been recorded on this rental. The deposit is non-refundable per
                policy. Process any security deposit or remaining balance refunds outside the
                system, then record outcomes separately when refund workflows are available.
              </p>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="cancel-reason">Cancellation reason</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Reason recorded in the audit log and rental notes"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <Button
              variant="destructive"
              disabled={isPending || !cancelReason.trim()}
              onClick={() => {
                if (cancelAfterPayment) {
                  setShowCancelDialog(true)
                  return
                }

                runAction(submitCancellation)
              }}
            >
              <Ban className="mr-2 h-4 w-4" />
              Cancel rental
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel rental after payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This rental has recorded payments or is confirmed. Cancelling will release the
              calendar block and mark the rental as cancelled after payment. Deposits are
              non-refundable. Handle any security deposit or balance refunds manually.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep rental</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending || !cancelReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                runAction(submitCancellation)
              }}
            >
              Cancel rental
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showForceBookDialog} onOpenChange={setShowForceBookDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm force-book override?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This is an administrative exception. The rental will move directly to{" "}
                  <strong>Confirmed</strong> without running the normal payment confirmation
                  checks.
                </p>
                {rental.hasConflict ? (
                  <p className="text-red-700">
                    Calendar conflicts exist. You are authorizing a potential double-booking.
                  </p>
                ) : null}
                {outstandingPayments.outstandingLabels.length ? (
                  <div>
                    <p className="font-medium text-foreground">Payments still outstanding:</p>
                    <ul className="mt-1 list-disc pl-5">
                      {outstandingPayments.outstandingLabels.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                    <p className="mt-2">
                      Force-book does not mark these paid. Collect payment manually and update
                      the payment ledger separately.
                    </p>
                  </div>
                ) : null}
                <p>
                  Reason recorded in the audit log:{" "}
                  <span className="text-foreground">{forceBookReason.trim()}</span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep current workflow</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending || !forceBookReason.trim()}
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={(event) => {
                event.preventDefault()
                runAction(submitForceBook)
              }}
            >
              Force-book rental
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
