import { resolvePaymentDonorDisplayName } from "@/lib/donations/payment-donor-display"

type PaymentExportRow = {
  payment_date?: string | null
  donor_display_name?: string | null
  sender_name?: string | null
  amount?: number | string | null
  refunded_amount?: number | null
  pledge_id?: string | null
  recurring_donation_plan_id?: string | null
  method_display?: string | null
  source?: string | null
  campaign_name?: string | null
  fund_name?: string | null
  campaign_group_name?: string | null
  receipt_status?: string | null
  status_display?: string | null
  status?: string | null
  memo?: string | null
}

function escapeCsvValue(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`
}

function formatReportDate(value: string | null | undefined) {
  if (!value) return ""
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function paymentTypeLabel(payment: PaymentExportRow) {
  if (payment.recurring_donation_plan_id) return "Recurring Donation"
  if (payment.pledge_id) return "Pledge Payment"
  return "One-Time Donation"
}

export function downloadPaymentsReportCsv(
  payments: PaymentExportRow[],
  generatedAt: string,
  periodLabel: string
) {
  if (payments.length === 0) return

  const rows = payments.map((payment) => ({
    Date: formatReportDate(payment.payment_date),
    Donor:
      payment.donor_display_name ||
      resolvePaymentDonorDisplayName({ senderName: payment.sender_name }),
    Amount: Number(payment.amount || 0).toFixed(2),
    Type: paymentTypeLabel(payment),
    Method: payment.method_display || payment.source || "",
    Campaign: payment.campaign_name || "",
    Fund: payment.fund_name || "",
    Group: payment.campaign_group_name || "",
    "Receipt Status": payment.receipt_status || "",
    Status: payment.status_display || payment.status || "",
    Memo: payment.memo || "",
  }))

  const headers = Object.keys(rows[0])
  const csv = [
    `# Payments — ${periodLabel}`,
    `# Generated ${generatedAt}`,
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header as keyof typeof row])).join(",")),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `payments-${generatedAt.slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
