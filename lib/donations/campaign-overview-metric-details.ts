import {
  campaignCommitmentRaised,
  campaignPaymentNetAmount,
  classifyCampaignPaymentSource,
  formatDonationCurrency,
  isCountableCampaignPayment,
  isCampaignBatchDepositPayment,
  type CampaignMetrics,
  type CampaignOutstandingPledgeRow,
  type CampaignPaymentRow,
  type CampaignSourceBucket,
} from "@/lib/donations/campaign-analytics"
import { formatPaymentSourceLabel } from "@/lib/donations/payment-source-channel"

export type CampaignOverviewMetricDetailLine = {
  id: string
  name: string
  method: string
  date: string | null
  amount: number
  contactId: string | null
  donorId: string | null
}

export type CampaignOverviewMetricDetail = {
  title: string
  description: string
  lines: CampaignOverviewMetricDetailLine[]
}

const SOURCE_ROW_BUCKETS: Record<string, CampaignSourceBucket> = {
  cash: "cash",
  checks: "checks",
  ach: "ach",
  square: "square",
  "one-time": "ccOneTime",
  recurring: "ccRecurring",
  "ticket-sales": "ticketSales",
  other: "other",
}

const SOURCE_ROW_TITLES: Record<string, string> = {
  cash: "Cash",
  checks: "Checks",
  ach: "ACH",
  square: "Square",
  "one-time": "One-Time Donations",
  recurring: "Recurring Donations",
  "ticket-sales": "Ticket Sales",
  other: "Other",
}

function cents(amount: number) {
  return Math.round(amount * 100)
}

function paymentName(payment: CampaignPaymentRow) {
  return String(payment.sender_name || "").trim() || "Unknown donor"
}

function paymentLine(payment: CampaignPaymentRow): CampaignOverviewMetricDetailLine {
  return {
    id: payment.id,
    name: paymentName(payment),
    method: formatPaymentSourceLabel(payment.source),
    date: payment.payment_date ?? null,
    amount: campaignPaymentNetAmount(payment),
    contactId: payment.contact_id ?? null,
    donorId: payment.donor_id ?? null,
  }
}

function openPledgeLine(pledge: CampaignOutstandingPledgeRow): CampaignOverviewMetricDetailLine {
  return {
    id: pledge.id,
    name: pledge.donorName || "Unknown donor",
    method: "Open pledge",
    date: pledge.pledgeDate,
    amount: pledge.balanceRemaining,
    contactId: pledge.contactId,
    donorId: pledge.donorId,
  }
}

function countablePayments(payments: CampaignPaymentRow[]) {
  return payments.filter((payment) => isCountableCampaignPayment(payment))
}

function openPledges(pledges: CampaignOutstandingPledgeRow[]) {
  return pledges.filter((pledge) => {
    const status = String(pledge.status || "").toLowerCase()
    if (status === "cancelled" || status === "fulfilled") return false
    return pledge.balanceRemaining > 0
  })
}

function sortLines(lines: CampaignOverviewMetricDetailLine[]) {
  return [...lines].sort(
    (left, right) => right.amount - left.amount || left.name.localeCompare(right.name)
  )
}

function paymentsInBucket(payments: CampaignPaymentRow[], bucket: CampaignSourceBucket) {
  return countablePayments(payments).filter(
    (payment) => classifyCampaignPaymentSource(payment) === bucket
  )
}

export function buildCampaignOverviewMetricDetail(input: {
  key: string
  metrics: CampaignMetrics
  payments: CampaignPaymentRow[]
  pledges: CampaignOutstandingPledgeRow[]
}): CampaignOverviewMetricDetail | null {
  const { key, metrics, payments, pledges } = input
  const collected = countablePayments(payments)
  const outstanding = openPledges(pledges)

  if (key === "total-raised") {
    const lines = sortLines([
      ...collected.map(paymentLine),
      ...outstanding.map(openPledgeLine),
    ])
    return {
      title: "Total Raised",
      description: `${formatDonationCurrency(campaignCommitmentRaised(metrics))} collected plus open pledge balances`,
      lines,
    }
  }

  if (key === "total-collected") {
    return {
      title: "Total Collected",
      description: `${formatDonationCurrency(metrics.raised)} received`,
      lines: sortLines(collected.map(paymentLine)),
    }
  }

  if (key === "outstanding" || key === "pledges") {
    return {
      title: key === "pledges" ? "Pledges" : "Outstanding",
      description: `${formatDonationCurrency(metrics.outstanding)} still open`,
      lines: sortLines(outstanding.map(openPledgeLine)),
    }
  }

  if (key === "largest-gift") {
    const target = cents(metrics.largestGift)
    const pledgeLines = pledges
      .filter((pledge) => cents(pledge.amountPledged) === target && target > 0)
      .map((pledge) => ({
        id: pledge.id,
        name: pledge.donorName || "Unknown donor",
        method: "Pledge",
        date: pledge.pledgeDate,
        amount: pledge.amountPledged,
        contactId: pledge.contactId,
        donorId: pledge.donorId,
      }))
    const paymentLines = collected
      .filter((payment) => {
        if (payment.pledge_id) return false
        if (isCampaignBatchDepositPayment(payment)) return false
        return cents(campaignPaymentNetAmount(payment)) === target && target > 0
      })
      .map(paymentLine)
    return {
      title: "Largest Gift",
      description: formatDonationCurrency(metrics.largestGift),
      lines: sortLines([...pledgeLines, ...paymentLines]),
    }
  }

  const bucket = SOURCE_ROW_BUCKETS[key]
  if (!bucket) return null
  const lines = sortLines(paymentsInBucket(payments, bucket).map(paymentLine))
  const total = lines.reduce((sum, line) => sum + line.amount, 0)
  return {
    title: SOURCE_ROW_TITLES[key] || "Overview",
    description: formatDonationCurrency(total),
    lines,
  }
}
