import { redirect } from "next/navigation"

import { donationImportMatchHref } from "@/lib/donations/donation-payment-paths"

export default function DonationsReconcileRedirectPage() {
  redirect(donationImportMatchHref({ view: "match" }))
}
