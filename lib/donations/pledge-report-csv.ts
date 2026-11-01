import * as XLSX from "xlsx"

import type { PledgeExportRow } from "@/lib/donations/donation-list-actions"
import { pledgeDisplayStatus } from "@/lib/donations/donation-status"
import {
  type PledgeLedgerColumnId,
  pledgeLedgerColumnOptions,
} from "@/lib/donations/pledge-ledger-columns"
import {
  callTextReminderLines,
  formatPledgeReminderStatusLabel,
} from "@/lib/donations/pledge-reminder-types"
import { formatPhoneDisplay } from "@/lib/ui/format-phone"

function formatReportDate(value: string | null | undefined) {
  if (!value) return ""
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function emailReminderLabel(pledge: PledgeExportRow) {
  if (!pledge.last_reminder_at) return ""
  const status = formatPledgeReminderStatusLabel(pledge.last_reminder_status)
  const date = formatReportDate(pledge.last_reminder_at)
  return status ? `${status} — ${date}` : date
}

function pledgeExportCell(pledge: PledgeExportRow, columnId: PledgeLedgerColumnId) {
  switch (columnId) {
    case "donor":
      return pledge.donor_name ?? ""
    case "email":
      return pledge.email ?? ""
    case "phone":
      return formatPhoneDisplay(pledge.phone)
    case "pledged":
      return Number(pledge.amount_pledged || 0)
    case "paid":
      return Number(pledge.amount_paid || 0)
    case "balance":
      return Number(pledge.balance_remaining || 0)
    case "status":
      return pledgeDisplayStatus(
        pledge.calculated_status,
        Number(pledge.amount_pledged || 0),
        Number(pledge.amount_paid || 0)
      )
    case "campaign":
      return pledge.campaign_name || "Unassigned"
    case "emailReminder":
      return emailReminderLabel(pledge)
    case "callText":
      return callTextReminderLines(
        {
          lastCallAt: pledge.last_call_at,
          lastTextAt: pledge.last_text_at,
          lastContactedAt: pledge.last_contacted_at,
        },
        formatReportDate
      ).join("\n")
    case "notes":
      return pledge.contact_notes || ""
  }
}

const COLUMN_WIDTHS: Record<PledgeLedgerColumnId, number> = {
  donor: 28,
  email: 32,
  phone: 18,
  pledged: 16,
  paid: 14,
  balance: 14,
  status: 12,
  campaign: 36,
  emailReminder: 28,
  callText: 22,
  notes: 40,
}

export function downloadPledgesReportExcel(
  pledges: PledgeExportRow[],
  generatedAt: string,
  visibleColumns: PledgeLedgerColumnId[]
) {
  if (pledges.length === 0) return

  const columns = pledgeLedgerColumnOptions(true).filter((column) =>
    visibleColumns.includes(column.id)
  )
  if (columns.length === 0) return

  const header = columns.map((column) => column.label)
  const body = pledges.map((pledge) => columns.map((column) => pledgeExportCell(pledge, column.id)))
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body])
  sheet["!cols"] = columns.map((column) => ({ wch: COLUMN_WIDTHS[column.id] }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Pledges")
  XLSX.writeFile(workbook, `pledges-${generatedAt.slice(0, 10)}.xlsx`)
}
