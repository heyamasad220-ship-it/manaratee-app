import { redirect } from "next/navigation"

export default function PledgeCollectionPage() {
  redirect("/donations/reports/pledges#collection-queue")
}
