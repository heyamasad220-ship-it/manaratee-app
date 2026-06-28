import { Fragment } from "react"

type Payment = {
  id: string
  amount: number | string
  payment_date: string | null
  source: string | null
  memo: string | null
}

function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value || 0)

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function formatDate(date: string | null) {
  if (!date) return "—"

  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function PaymentHistory({ payments }: { payments: Payment[] }) {
  if (!payments || payments.length === 0) {
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        No payments recorded for this pledge yet.
      </div>
    )
  }

  const totalPaid = payments.reduce((sum, p) => {
    return sum + Number(p.amount || 0)
  }, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold">Payment History</h3>
          <p className="text-sm text-muted-foreground">All payments recorded for this pledge.</p>
        </div>

        <div className="text-right text-sm">
          <div className="font-medium">{formatCurrency(totalPaid)}</div>
          <div className="text-xs text-muted-foreground">
            {payments.length} payments
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="p-3 text-left font-medium">Date</th>
              <th className="p-3 text-left font-medium">Amount</th>
              <th className="p-3 text-left font-medium">Method</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <Fragment key={payment.id}>
                <tr className="border-b-0">
                  <td className="p-3 pb-2 align-top">{formatDate(payment.payment_date)}</td>
                  <td className="p-3 pb-2 align-top font-medium">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className="p-3 pb-2 align-top capitalize">{payment.source || "—"}</td>
                </tr>
                <tr className="border-b last:border-b-0">
                  <td colSpan={3} className="px-3 pb-3 pt-0">
                    <div className="border-t border-border pt-3">
                      <p className="text-sm font-semibold text-foreground">Memo</p>
                      <p className="mt-1.5 break-all text-sm text-muted-foreground">
                        {payment.memo || "—"}
                      </p>
                    </div>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
