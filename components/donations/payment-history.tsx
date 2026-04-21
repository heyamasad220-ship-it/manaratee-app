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
          <p className="text-sm text-muted-foreground">
            All payments recorded for this pledge.
          </p>
        </div>

        <div className="text-right text-sm">
  <div className="font-medium">
    {formatCurrency(totalPaid)}
  </div>
  <div className="text-muted-foreground text-xs">
    {payments.length} payments
  </div>
</div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Amount</th>
              <th className="text-left p-3 font-medium">Method</th>
              <th className="text-left p-3 font-medium">Memo</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-b last:border-b-0">
                <td className="p-3">{formatDate(payment.payment_date)}</td>
                <td className="p-3 font-medium">
                  {formatCurrency(payment.amount)}
                </td>
                <td className="p-3 capitalize">{payment.source || "—"}</td>
                <td className="p-3">{payment.memo || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}