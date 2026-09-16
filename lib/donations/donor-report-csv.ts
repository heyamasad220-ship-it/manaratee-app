import type { DonorSummaryReportRow } from "@/lib/donations/donation-list-actions"
import { formatPhoneDisplay } from "@/lib/ui/format-phone"

function escapeCsvValue(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`
}

function formatReportDate(value: string | null) {
  if (!value) return ""
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function buildDonorGivingReportCsvRows(donors: DonorSummaryReportRow[]) {
  return donors.map((donor) => ({
    Name: donor.full_name ?? "",
    Email: donor.email ?? "",
    Phone: formatPhoneDisplay(donor.phone),
    "Total Given": Number(donor.total_donations || 0).toFixed(2),
    Gifts: donor.donation_count ?? 0,
    "Last Gift": formatReportDate(donor.last_donation_date),
    "Lifetime Last Gift": formatReportDate(donor.lifetime_last_donation_date),
  }))
}

export function downloadDonorGivingReportCsv(
  donors: DonorSummaryReportRow[],
  generatedAt: string,
  periodLabel: string
) {
  if (donors.length === 0) return

  const rows = buildDonorGivingReportCsvRows(donors)
  const headers = Object.keys(rows[0])
  const csv = [
    `# Donor Giving Report — ${periodLabel}`,
    `# Generated ${generatedAt}`,
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header as keyof typeof row])).join(",")),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  const dateStamp = generatedAt.slice(0, 10)

  link.href = url
  link.download = `donor-giving-report-${dateStamp}.csv`
  link.click()

  URL.revokeObjectURL(url)
}
