"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react"

import {
  approveVenueRentalRequest,
  approveSecurityDepositRefund,
  declineVenueRentalRequest,
  extendVenueRentalHold,
  markRentalPaymentPaid,
  markVenueRentalCompletedAndAwaitingRefund,
} from "@/lib/bookings/venue-rental-actions"
import { formatVenueRentalTimeRange } from "@/lib/bookings/venue-rental-format"
import {
  getVenueRentalCalendarColorClasses,
  getVenueRentalStatusLabel,
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
            <p className="text-muted-foreground">{rental.customerEmail || "No email"}</p>
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
    </div>
  )
}
