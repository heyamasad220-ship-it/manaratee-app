import {
  campaignCommitmentRaised,
  formatDonationCurrency,
  type CampaignMetrics,
  type CampaignOutstandingPledgeRow,
  type CampaignSourceBreakdown,
} from "@/lib/donations/campaign-analytics"
import { formatPhoneDisplayOrDash } from "@/lib/ui/format-phone"
import {
  CAMPAIGN_OVERVIEW_METRIC_CATALOG,
  resolveAutoCampaignOverviewMetricKeys,
  type CampaignOverviewMetricKey,
} from "@/lib/donations/campaign-overview-metrics"

export type CampaignReportPledge = CampaignOutstandingPledgeRow & {
  email?: string | null
  phone?: string | null
}

export type CampaignReportPdfInput = {
  campaignName: string
  generatedAt: Date
  goalAmount: number | null
  metrics: CampaignMetrics
  breakdown: CampaignSourceBreakdown
  pledges: CampaignReportPledge[]
}

type MetricLine = { label: string; value: string }

function sourceAmount(key: CampaignOverviewMetricKey, breakdown: CampaignSourceBreakdown) {
  switch (key) {
    case "cash":
      return breakdown.cash
    case "checks":
      return breakdown.checks
    case "ach":
      return breakdown.ach
    case "square":
      return breakdown.square
    case "one-time":
      return breakdown.ccOneTime
    case "recurring":
      return breakdown.ccRecurring
    case "ticket-sales":
      return breakdown.ticketSales
    case "other":
      return breakdown.other
    case "pledges":
      return breakdown.remainingPledges
    default:
      return 0
  }
}

export function campaignReportMetricLines(input: CampaignReportPdfInput): MetricLine[] {
  const goal = input.goalAmount && input.goalAmount > 0 ? input.goalAmount : null
  const pinned: MetricLine[] = [
    {
      label: "Campaign Goal",
      value: goal != null ? formatDonationCurrency(goal) : "No goal set",
    },
    {
      label: "Total Raised",
      value: formatDonationCurrency(campaignCommitmentRaised(input.metrics)),
    },
    {
      label: "Total Collected",
      value: formatDonationCurrency(input.metrics.raised),
    },
    {
      label: "Outstanding",
      value: formatDonationCurrency(input.metrics.outstanding),
    },
    {
      label: "Donors",
      value: input.metrics.donorCount.toLocaleString(),
    },
    {
      label: "Largest Gift",
      value: formatDonationCurrency(input.metrics.largestGift),
    },
  ]

  const titles = new Map(
    CAMPAIGN_OVERVIEW_METRIC_CATALOG.map((metric) => [metric.key, metric.title])
  )
  const visible = resolveAutoCampaignOverviewMetricKeys(input.breakdown).filter(
    (key) => key !== "donors" && key !== "largest-gift"
  )

  return [
    ...pinned,
    ...visible.map((key) => ({
      label: titles.get(key) || key,
      value: formatDonationCurrency(sourceAmount(key, input.breakdown)),
    })),
  ]
}

function isCancelled(pledge: CampaignOutstandingPledgeRow) {
  return String(pledge.status || "").toLowerCase() === "cancelled"
}

export function campaignReportPledges(pledges: CampaignReportPledge[]) {
  const active = pledges.filter((pledge) => !isCancelled(pledge))
  const bySize = (left: CampaignReportPledge, right: CampaignReportPledge) =>
    right.amountPledged - left.amountPledged || left.donorName.localeCompare(right.donorName)
  return {
    open: active.filter((pledge) => pledge.balanceRemaining > 0).sort(bySize),
    fulfilled: active.filter((pledge) => pledge.balanceRemaining <= 0).sort(bySize),
  }
}

export function campaignReportFileSlug(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return slug || "campaign"
}

export async function downloadCampaignReportPdf(input: CampaignReportPdfInput) {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" })
  const margin = 40
  const right = 752
  const pageBottom = 560
  let y = 52

  function nextPage() {
    doc.addPage()
    y = 52
  }

  function ensure(height: number) {
    if (y + height > pageBottom) nextPage()
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text("Campaign report", margin, y)
  y += 20
  doc.setFontSize(12)
  doc.text(input.campaignName, margin, y)
  y += 16
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(80)
  doc.text(
    `Generated ${input.generatedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    margin,
    y
  )
  doc.setTextColor(0)
  y += 22

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("Overview metrics", margin, y)
  y += 16
  doc.setFontSize(10)

  for (const line of campaignReportMetricLines(input)) {
    ensure(16)
    doc.setFont("helvetica", "normal")
    doc.text(line.label, margin, y)
    doc.setFont("helvetica", "bold")
    doc.text(line.value, right, y, { align: "right" })
    y += 16
  }

  y += 10
  const groups = campaignReportPledges(input.pledges)
  drawPledgeSection(doc, "Open pledges", groups.open)
  drawPledgeSection(doc, "Fulfilled pledges", groups.fulfilled)

  const stamp = input.generatedAt.toISOString().slice(0, 10)
  doc.save(`${campaignReportFileSlug(input.campaignName)}-campaign-report-${stamp}.pdf`)

  function drawPledgeSection(pdf: typeof doc, title: string, rows: CampaignReportPledge[]) {
    ensure(36)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(12)
    pdf.text(title, margin, y)
    y += 16
    pdf.setFontSize(8)
    pdf.setTextColor(80)
    pdf.text("Donor", margin, y)
    pdf.text("Email", 200, y)
    pdf.text("Phone", 390, y)
    pdf.text("Pledged", 560, y, { align: "right" })
    pdf.text("Received", 650, y, { align: "right" })
    pdf.text("Outstanding", right, y, { align: "right" })
    pdf.setTextColor(0)
    y += 6
    pdf.setDrawColor(220)
    pdf.line(margin, y, right, y)
    y += 12

    if (rows.length === 0) {
      ensure(16)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(10)
      pdf.text("None", margin, y)
      y += 20
      return
    }

    let pledged = 0
    let received = 0
    let outstanding = 0
    for (const row of rows) {
      ensure(14)
      pledged += row.amountPledged
      received += row.amountPaid
      outstanding += row.balanceRemaining
      const name = pdf.splitTextToSize(row.donorName || "Unknown donor", 150)[0] || "Unknown donor"
      const email = pdf.splitTextToSize(row.email || "—", 180)[0] || "—"
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8)
      pdf.text(name, margin, y)
      pdf.text(email, 200, y)
      pdf.text(formatPhoneDisplayOrDash(row.phone), 390, y)
      pdf.text(formatDonationCurrency(row.amountPledged), 560, y, { align: "right" })
      pdf.text(formatDonationCurrency(row.amountPaid), 650, y, { align: "right" })
      pdf.text(formatDonationCurrency(row.balanceRemaining), right, y, { align: "right" })
      y += 13
    }

    ensure(20)
    y += 2
    pdf.setDrawColor(180)
    pdf.line(margin, y - 8, right, y - 8)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8)
    pdf.text("Total", margin, y)
    pdf.text(formatDonationCurrency(pledged), 560, y, { align: "right" })
    pdf.text(formatDonationCurrency(received), 650, y, { align: "right" })
    pdf.text(formatDonationCurrency(outstanding), right, y, { align: "right" })
    y += 20
  }
}
