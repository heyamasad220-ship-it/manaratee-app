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

// Single customer summary card — billing organization panel removed.

import {
  approveVenueRentalRequest,
  approveSecurityDepositRefund,
  cancelVenueRental,
  declineVenueRentalRequest,
  extendVenueRentalHold,
  forceBookVenueRentalWithOverride,
  markVenueRentalCompleted,
  markVenueRentalCompletedAndAwaitingRefund,
  markVenueRentalPending,
} from "@/lib/bookings/venue-rental-actions"
import { VenueRentalFinancialPanel } from "@/components/bookings/venue-rental-financial-panel"
import { VenueRentalCustomerCard } from "@/components/bookings/venue-rental-customer-card"
import type { VenueRentalEmployeePricingSuggestion } from "@/lib/bookings/venue-rental-employee-pricing"
import {
  canStaffCancelVenueRental,
  canStaffForceBookVenueRental,
  getVenueRentalCalendarColorClasses,
  getVenueRentalStatusLabel,
  isVenueRentalReviewable,
  shouldCancelVenueRentalAfterPayment,
  summarizeOutstandingRentalPayments,
} from "@/lib/bookings/venue-rental-status"
import type {
  RentalPaymentRecord,
  VenueRentalOrgSettings,
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

type VenueRentalDetailClientProps = {
  rental: VenueRentalQueueRow
  payments: RentalPaymentRecord[]
  canManage: boolean
  canViewFinance: boolean
  employeePricing?: VenueRentalEmployeePricingSuggestion | null
  financialAction?: string | null
  /** Where the user opened this rental from (controls back link). */
  from?: string | null
  quotedCharges?: {
    spaceFee: number
    addonFees: number
    totalCharges: number
    hours?: number
    discountAmount?: number
  } | null
  venues?: Array<{ id: string; name: string }>
  eventTypes?: Array<{ id: string; name: string }>
  addons?: Array<{
    id: string
    name: string
    slug: string
    description: string | null
    defaultPrice: number
  }>
  orgSettings?: VenueRentalOrgSettings | null
}

function isAwaitingPaymentStatus(status: VenueRentalStatus): boolean {
  return status === VENUE_RENTAL_STATUSES.approvedPendingPayment
}

function resolveVenueRentalBackNavigation(from: string | null): {
  href: string
  label: string
} {
  if (from === "payments") {
    return { href: "/bookings/payments", label: "Back to Payments" }
  }
  if (from === "overview") {
    return { href: "/bookings/overview", label: "Back to Overview" }
  }
  return { href: "/bookings/requests", label: "Back to Requests" }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0)
}

export function VenueRentalDetailClient({
  rental,
  payments,
  canManage,
  canViewFinance,
  employeePricing = null,
  financialAction = null,
  from = null,
  quotedCharges = null,
  venues = [],
  eventTypes = [],
  addons = [],
  orgSettings = null,
}: VenueRentalDetailClientProps) {
  const router = useRouter()
  const backNav = resolveVenueRentalBackNavigation(from)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const securityDepositEnabled = Boolean(orgSettings?.securityDepositEnabled)
  const [depositAmount, setDepositAmount] = useState(
    employeePricing?.eligible
      ? String(employeePricing.suggestedDeposit)
      : "500"
  )
  const [securityDepositAmount, setSecurityDepositAmount] = useState(
    securityDepositEnabled && orgSettings?.defaultSecurityDepositAmount != null
      ? String(orgSettings.defaultSecurityDepositAmount)
      : "0"
  )
  const [pendingNote, setPendingNote] = useState("")
  const [remainingBalanceAmount, setRemainingBalanceAmount] = useState(
    employeePricing?.eligible
      ? String(employeePricing.suggestedRemainingBalance)
      : "0"
  )
  const [declineReason, setDeclineReason] = useState("")
  const [extendReason, setExtendReason] = useState("")
  const [refundAmount, setRefundAmount] = useState("")
  const [refundReason, setRefundReason] = useState("")
  const [cancelReason, setCancelReason] = useState("")
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [forceBookReason, setForceBookReason] = useState("")
  const [showForceBookDialog, setShowForceBookDialog] = useState(false)
  const [bypassPolicyAgreement, setBypassPolicyAgreement] = useState(false)

  const requiresPolicyAgreement = Boolean(
    rental.policiesDocumentUrlSnapshot ||
      rental.pricingGuideUrlSnapshot ||
      rental.policiesSentAt
  )
  const policiesAgreed = Boolean(rental.policiesAgreedAt)
  const canApprovePolicies =
    !requiresPolicyAgreement || policiesAgreed || bypassPolicyAgreement

  const statusClasses = getVenueRentalCalendarColorClasses(rental.calendarColor)

  const paymentSummary = useMemo(() => {
    const paidStatuses = new Set<string>([
      RENTAL_PAYMENT_STATUSES.paidManually,
      RENTAL_PAYMENT_STATUSES.paidStripeLater,
      RENTAL_PAYMENT_STATUSES.completed,
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
          <Link href={backNav.href}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backNav.label}
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Rental {rental.shortId}</h2>
          <p className="text-sm text-muted-foreground">
            Requested {rental.submittedAtLabel}
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

      <VenueRentalCustomerCard
        rental={rental}
        canManage={canManage}
        venues={venues}
        eventTypes={eventTypes}
      />

      {canManage && canViewFinance && isVenueRentalReviewable(rental.status) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review request</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {requiresPolicyAgreement ? (
              <div
                className={`md:col-span-2 rounded-md border px-3 py-2 text-sm ${
                  policiesAgreed
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-amber-200 bg-amber-50 text-amber-950"
                }`}
              >
                {policiesAgreed ? (
                  <p>
                    Customer agreed to policies
                    {rental.policiesAgreedAt
                      ? ` on ${new Date(rental.policiesAgreedAt).toLocaleString()}`
                      : ""}
                    .
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="font-medium">
                      Waiting for customer to agree to policies
                    </p>
                    <p className="text-amber-900/90">
                      Documents were sent with the request. Approve is blocked until
                      they agree in the customer portal, unless you bypass below.
                    </p>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={bypassPolicyAgreement}
                        onChange={(event) =>
                          setBypassPolicyAgreement(event.target.checked)
                        }
                      />
                      <span>
                        Bypass policy agreement for this approval (exception /
                        walk-in)
                      </span>
                    </label>
                  </div>
                )}
              </div>
            ) : null}
            {employeePricing?.eligible ? (
              <div className="md:col-span-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                <p className="font-medium">
                  {employeePricing.label || "Full-time employee benefit"}
                </p>
                <p className="mt-1 text-emerald-800">
                  Space fee {formatMoney(employeePricing.baseSpaceFee)} →{" "}
                  {formatMoney(employeePricing.discountedSpaceFee)} (
                  {employeePricing.percentOff}% off
                  {employeePricing.hours > 0
                    ? ` · ${employeePricing.hours} hr`
                    : ""}
                  ). Deposit and remaining balance below are prefilled — adjust if needed.
                </p>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Deposit (required to confirm)</Label>
              <Input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Remaining balance</Label>
              <Input
                value={remainingBalanceAmount}
                onChange={(e) => setRemainingBalanceAmount(e.target.value)}
              />
            </div>
            {securityDepositEnabled ? (
              <div className="grid gap-2">
                <Label>Security deposit (refundable)</Label>
                <Input
                  value={securityDepositAmount}
                  onChange={(e) => setSecurityDepositAmount(e.target.value)}
                />
              </div>
            ) : null}
            <p className="md:col-span-2 text-sm text-muted-foreground">
              After approval the customer must pay the deposit before the hold expires.
              Paying the deposit confirms the booking.
              {securityDepositEnabled
                ? " A refundable security deposit can be collected and returned after the event."
                : " Card on file covers damage or extras if needed (security deposit not required for this organization)."}
            </p>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button
                disabled={isPending || !canApprovePolicies}
                onClick={() =>
                  runAction(async () => {
                    await approveVenueRentalRequest({
                      venueRentalId: rental.id,
                      depositAmount: Number(depositAmount || 0),
                      securityDepositAmount: securityDepositEnabled
                        ? Number(securityDepositAmount || 0) || undefined
                        : undefined,
                      remainingBalanceAmount: Number(remainingBalanceAmount || 0) || undefined,
                      bypassPolicyAgreement:
                        requiresPolicyAgreement &&
                        !policiesAgreed &&
                        bypassPolicyAgreement,
                    })
                  })
                }
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve & request deposit
              </Button>
              <Button
                variant="secondary"
                disabled={isPending}
                onClick={() =>
                  runAction(async () => {
                    await markVenueRentalPending({
                      venueRentalId: rental.id,
                      note: pendingNote,
                    })
                  })
                }
              >
                <Clock className="mr-2 h-4 w-4" />
                Mark pending
              </Button>
            </div>
            <div className="md:col-span-2 grid gap-2">
              <Label>Pending note (optional)</Label>
              <Input
                value={pendingNote}
                onChange={(e) => setPendingNote(e.target.value)}
                placeholder="Waiting for floor plan, guest count, etc."
              />
            </div>
            <div className="md:col-span-2 grid gap-2">
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

      {canViewFinance ? (
        <VenueRentalFinancialPanel
          rental={rental}
          payments={payments}
          canManage={canManage}
          initialAction={financialAction}
          quotedCharges={quotedCharges}
          addons={addons}
          securityDepositEnabled={securityDepositEnabled}
        />
      ) : null}

      {canManage &&
      (rental.status === VENUE_RENTAL_STATUSES.confirmed ||
        rental.status === VENUE_RENTAL_STATUSES.depositPaid ||
        rental.status === VENUE_RENTAL_STATUSES.securityDepositPaid) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {securityDepositEnabled || paymentSummary.securityPaid
                ? "Post-event inspection"
                : "Complete rental"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {securityDepositEnabled || paymentSummary.securityPaid ? (
              <>
                <p className="text-sm text-muted-foreground">
                  After the event, mark inspection complete to start the security
                  deposit refund review.
                </p>
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
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Rentals also auto-complete after the event ends. Use this if you
                  need to close the booking manually. Charge extras (damage,
                  cleaning) from Financial → Add charge.
                </p>
                <Button
                  disabled={isPending}
                  onClick={() =>
                    runAction(async () => {
                      await markVenueRentalCompleted({
                        venueRentalId: rental.id,
                      })
                    })
                  }
                >
                  Mark completed
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {canManage &&
      canViewFinance &&
      (securityDepositEnabled || paymentSummary.securityPaid) &&
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
