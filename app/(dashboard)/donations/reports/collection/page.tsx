import { redirect } from "next/navigation"

export default function DonationsCollectionReportPage() {
  redirect("/donations/pledges#collection-queue")
}
