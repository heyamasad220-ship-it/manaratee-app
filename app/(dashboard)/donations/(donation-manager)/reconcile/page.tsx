import { redirect } from "next/navigation"

export default function DonationsReconcileRedirectPage() {
  redirect("/donations/reports/match")
}
