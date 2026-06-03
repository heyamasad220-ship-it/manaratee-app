import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ProgramRegistrationQuote } from "@/lib/programs/program-quote-types"

function formatCurrency(value: number | null | undefined) {
  if (!value || value <= 0) return "$0.00"

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function RegistrationQuoteSnapshot({
  quoteSnapshot,
  totalAmount,
}: {
  quoteSnapshot: unknown
  totalAmount: number | null
}) {
  const quote = quoteSnapshot as ProgramRegistrationQuote | null

  if (!quote || typeof quote !== "object" || !quote.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quote Snapshot</CardTitle>
          <CardDescription>
            Pricing captured at registration time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {totalAmount && totalAmount > 0
              ? `Total recorded: ${formatCurrency(totalAmount)} (no detailed snapshot saved)`
              : "No quote snapshot available."}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quote Snapshot</CardTitle>
        <CardDescription>
          Pricing captured at registration ({quote.plan_type || "fee plan"}).
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {quote.line_items?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.line_items.map((item, index) => (
                <TableRow key={`${item.component_type}-${index}`}>
                  <TableCell>{item.label}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unit_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No line items recorded.</p>
        )}

        {quote.discounts?.length ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Discounts</p>
            {quote.discounts.map((discount, index) => (
              <div
                key={`${discount.rule_type}-${index}`}
                className="flex justify-between text-sm"
              >
                <span>{discount.label}</span>
                <span className="text-green-600">
                  −{formatCurrency(discount.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(quote.subtotal)}</span>
          </div>
          {quote.discount_total > 0 ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discounts</span>
              <span>−{formatCurrency(quote.discount_total)}</span>
            </div>
          ) : null}
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatCurrency(quote.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Due today</span>
            <span>{formatCurrency(quote.due_today)}</span>
          </div>
        </div>

        {quote.scheduled_payments?.length ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Scheduled Payments</p>
            {quote.scheduled_payments.map((payment, index) => (
              <div
                key={`${payment.label}-${index}`}
                className="flex justify-between text-sm"
              >
                <span>
                  {payment.label}{" "}
                  <span className="text-muted-foreground">
                    ({formatDate(payment.due_date)})
                  </span>
                </span>
                <span>{formatCurrency(payment.amount)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
