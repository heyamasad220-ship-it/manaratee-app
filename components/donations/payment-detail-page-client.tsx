"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ExternalLink } from "lucide-react"

import {
  DonorDonationHistoryTable,
  type DonationHistoryRow,
} from "@/components/donations/donor-donation-history-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { mapPaymentToDonationHistoryRow } from "@/lib/donations/payment-admin-capabilities"
import { formatPaymentStatusLabel } from "@/lib/donations/donation-status"
import type { PaymentAdminRecord } from "@/lib/donations/payment-admin-types"
import { getPaymentDetailPageDataAction } from "@/lib/donations/payment-admin-actions"

type PaymentDetailPageClientProps = {
  paymentId: string
  initialPayment: PaymentAdminRecord
  initialDonationRow: DonationHistoryRow
  donorId: string | null
  contactId: string | null
  donorDisplayName: string | null
  canManage: boolean
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function PaymentDetailPageClient({
  paymentId,
  initialPayment,
  initialDonationRow,
  donorId,
  contactId,
  donorDisplayName,
  canManage,
}: PaymentDetailPageClientProps) {
  const router = useRouter()
  const [payment, setPayment] = useState(initialPayment)
  const [donationRow, setDonationRow] = useState(initialDonationRow)

  const reload = useCallback(async () => {
    const result = await getPaymentDetailPageDataAction(paymentId)
    if (!result.success) return

    setPayment(result.payment)
    setDonationRow(
      mapPaymentToDonationHistoryRow({
        id: result.payment.id,
        amount: result.payment.amount,
        refunded_amount: result.payment.refundedAmount,
        payment_date: result.payment.paymentDate,
        source: result.payment.source,
        source_type: result.payment.sourceType,
        status: result.payment.status,
        memo: result.payment.memo,
        pledge_id: result.payment.pledgeId,
        import_batch_id: result.payment.importBatchId,
        stripe_payment_intent_id: result.payment.stripePaymentIntentId,
        stripe_charge_id: result.payment.stripeChargeId,
        donation_categories: result.payment.categoryName
          ? { name: result.payment.categoryName }
          : null,
      })
    )
    router.refresh()
  }, [paymentId, router])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="-ml-2 gap-2" asChild>
          <Link href="/donations/reports/one-time">
            <ArrowLeft className="h-4 w-4" />
            Back to one-time donations
          </Link>
        </Button>
        {contactId ? (
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href={contactProfileHref(contactId, "financial")}>
              View contact
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Amount</p>
            <p className="text-2xl font-semibold">{formatMoney(payment.netAmount)}</p>
            {payment.refundedAmount > 0 ? (
              <p className="text-xs text-muted-foreground">
                {formatMoney(payment.amount)} − {formatMoney(payment.refundedAmount)} refunded
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Date</p>
            <p className="font-medium">{formatDate(payment.paymentDate)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Method</p>
            <p className="font-medium capitalize">{payment.source || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant="outline" className="mt-1">
              {formatPaymentStatusLabel(payment.status)}
            </Badge>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground">Donor / sender</p>
            <p className="font-medium">{donorDisplayName || "—"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground">Category</p>
            <p className="font-medium">{payment.categoryName || "General"}</p>
          </div>
          {payment.memo ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="font-medium">{payment.memo}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canManage && donorId ? (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <DonorDonationHistoryTable
              donorId={donorId}
              donations={[donationRow]}
              actionsOnly
              onUpdated={() => void reload()}
            />
          </CardContent>
        </Card>
      ) : canManage ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Link this payment to a donor before editing, refunding, or allocating.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            You have view-only access to donations. Contact an administrator to edit or refund
            this payment.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
