import { AlertTriangle, Check, Clock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CustomerRentalPaymentSummaryDto } from "@/lib/bookings/customer-venue-rental-dtos"
import { formatCustomerCurrency } from "@/lib/bookings/customer-venue-rental-queries"
import { cn } from "@/lib/utils"

type CustomerRentalPaymentsSectionProps = {
  payments: CustomerRentalPaymentSummaryDto
}

function PaymentLine({
  label,
  payment,
}: {
  label: string
  payment: CustomerRentalPaymentSummaryDto["deposit"]
}) {
  if (!payment) {
    return (
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">Not yet required</span>
      </div>
    )
  }

  const isPaid = payment.isPaid
  const isDue = payment.isDue

  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground">
          {formatCustomerCurrency(payment.amount, payment.currency)}
          {payment.dueDateLabel && !isPaid ? ` · due ${payment.dueDateLabel}` : null}
          {payment.paidDateLabel && isPaid ? ` · paid ${payment.paidDateLabel}` : null}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isPaid ? (
          <>
            <Check className="h-4 w-4 text-emerald-600" />
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-800">
              Paid
            </Badge>
          </>
        ) : isDue ? (
          <>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <Badge variant="secondary" className="bg-amber-50 text-amber-900">
              {payment.status}
            </Badge>
          </>
        ) : (
          <Badge variant="outline">{payment.status}</Badge>
        )}
      </div>
    </div>
  )
}

export function CustomerRentalPaymentsSection({
  payments,
}: CustomerRentalPaymentsSectionProps) {
  const hasPaymentRows =
    payments.deposit || payments.securityDeposit || payments.remainingBalance

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasPaymentRows ? (
          <p className="text-sm text-muted-foreground">
            Payment details will appear here after your request is approved.
          </p>
        ) : (
          <>
            <div className="space-y-3 rounded-lg border p-4">
              <PaymentLine label="Deposit" payment={payments.deposit} />
              <PaymentLine label="Security deposit" payment={payments.securityDeposit} />
              <PaymentLine label="Remaining balance" payment={payments.remainingBalance} />
            </div>

            {payments.outstandingBalance > 0 ? (
              <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 text-sm">
                <span className="font-medium text-amber-950">Outstanding balance</span>
                <span className="font-semibold text-amber-950">
                  {formatCustomerCurrency(payments.outstandingBalance)}
                </span>
              </div>
            ) : null}

            {payments.refundStatus !== "none" ? (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-3 text-sm",
                  payments.refundStatus === "refunded"
                    ? "bg-emerald-50 text-emerald-900"
                    : "bg-blue-50 text-blue-900"
                )}
              >
                {payments.refundStatus === "processing" ? (
                  <Clock className="h-4 w-4 shrink-0" />
                ) : (
                  <Check className="h-4 w-4 shrink-0" />
                )}
                <span>{payments.refundLabel}</span>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
