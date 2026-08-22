import { redirect } from "next/navigation"

import { donationImportMatchHref } from "@/lib/donations/donation-payment-paths"

export default function DonationPaymentsMatchRedirectPage() {
  redirect(donationImportMatchHref({ view: "match" }))
}
