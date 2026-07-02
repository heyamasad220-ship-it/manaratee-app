import type { ContactDirectoryExportRow } from "@/lib/contacts/contact-report-types"
import { getContactRecordTypeLabel } from "@/lib/contacts/contact-constants"

function escapeCsvValue(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`
}

function formatReportDate(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function buildContactDirectoryCsvRows(contacts: ContactDirectoryExportRow[]) {
  return contacts.map((contact) => ({
    Name: contact.name,
    Email: contact.email,
    Phone: contact.phone,
    "Record Type": getContactRecordTypeLabel(contact.recordType),
    Roles: contact.roles.join(", "),
    Status: contact.status,
    "Primary Contact": contact.primaryContactName,
    Teams: contact.teams.map((team) => team.name).join(", "),
    Address: contact.address,
    City: contact.city,
    State: contact.state,
    Zip: contact.zip,
    Country: contact.country,
    Created: formatReportDate(contact.createdAt),
    "Last Activity": formatReportDate(contact.lastActivity),
  }))
}

export function downloadContactDirectoryCsv(
  contacts: ContactDirectoryExportRow[],
  generatedAt: string,
  filterSummary: string
) {
  if (contacts.length === 0) return

  const rows = buildContactDirectoryCsvRows(contacts)
  const headers = Object.keys(rows[0])
  const csv = [
    `# Contact Directory Report`,
    `# Generated ${generatedAt}`,
    `# Filters: ${filterSummary}`,
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header as keyof typeof row])).join(",")
    ),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  const dateStamp = generatedAt.slice(0, 10)

  link.href = url
  link.download = `contact-directory-${dateStamp}.csv`
  link.click()

  URL.revokeObjectURL(url)
}
