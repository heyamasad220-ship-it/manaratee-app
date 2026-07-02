import { redirect } from "next/navigation"

export default function DonationsCollectionReportPage() {
  redirect("/donations/reports/pledges#collection-queue")
}
