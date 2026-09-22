import type { PledgeExportRow } from "@/lib/donations/donation-list-actions"
import { pledgeDisplayStatus } from "@/lib/donations/donation-status"
import { formatPledgeReminderStatusLabel } from "@/lib/donations/pledge-reminder-types"

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

export function downloadPledgesReportCsv(pledges: PledgeExportRow[], generatedAt: string) {
  if (pledges.length === 0) return

  const rows = pledges.map((pledge) => ({
    "Donor Name": pledge.donor_name ?? "",
    "Amount Pledged": Number(pledge.amount_pledged || 0).toFixed(2),
    "Amount Paid": Number(pledge.amount_paid || 0).toFixed(2),
    Balance: Number(pledge.balance_remaining || 0).toFixed(2),
    Status: pledgeDisplayStatus(
      pledge.calculated_status,
      Number(pledge.amount_pledged || 0),
      Number(pledge.amount_paid || 0)
    ),
    Campaign: pledge.campaign_name || "Unassigned",
    "Last Reminder": pledge.last_reminder_at
      ? formatPledgeReminderStatusLabel(pledge.last_reminder_status)
      : "",
    "Last Reminder Date": formatReportDate(pledge.last_reminder_at),
    "Last Contacted": formatReportDate(pledge.last_contacted_at),
  }))

  const headers = Object.keys(rows[0])
  const csv = [
    `# Pledges`,
    `# Generated ${generatedAt}`,
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header as keyof typeof row])).join(",")
    ),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `pledges-${generatedAt.slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
