import * as XLSX from "xlsx"

import type { CampaignReportPdfInput, CampaignReportPledge } from "@/lib/donations/campaign-report-pdf"
import {
  campaignReportFileSlug,
  campaignReportMetricLines,
  campaignReportPledges,
} from "@/lib/donations/campaign-report-pdf"
import { formatPhoneDisplay } from "@/lib/ui/format-phone"

function pledgeSheet(rows: CampaignReportPledge[]) {
  const header = ["Donor", "Email", "Phone", "Pledged", "Received", "Outstanding"]
  const body = rows.map((row) => [
    row.donorName || "Unknown donor",
    row.email || "",
    formatPhoneDisplay(row.phone),
    row.amountPledged,
    row.amountPaid,
    row.balanceRemaining,
  ])
  const pledged = rows.reduce((sum, row) => sum + row.amountPledged, 0)
  const received = rows.reduce((sum, row) => sum + row.amountPaid, 0)
  const outstanding = rows.reduce((sum, row) => sum + row.balanceRemaining, 0)
  return [header, ...body, ["Total", "", "", pledged, received, outstanding]]
}

export async function downloadCampaignReportExcel(input: CampaignReportPdfInput) {
  const groups = campaignReportPledges(input.pledges)
  const workbook = XLSX.utils.book_new()

  const overview = [
    ["Campaign report"],
    [input.campaignName],
    [
      `Generated ${input.generatedAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`,
    ],
    [],
    ["Overview metrics", "Amount"],
    ...campaignReportMetricLines(input).map((line) => [line.label, line.value]),
  ]
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(overview), "Overview")
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(pledgeSheet(groups.open)),
    "Open pledges"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(pledgeSheet(groups.fulfilled)),
    "Fulfilled pledges"
  )

  const stamp = input.generatedAt.toISOString().slice(0, 10)
  XLSX.writeFile(
    workbook,
    `${campaignReportFileSlug(input.campaignName)}-campaign-report-${stamp}.xlsx`
  )
}
