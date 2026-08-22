import { redirect } from "next/navigation"

import { donationImportMatchHref } from "@/lib/donations/donation-payment-paths"

export default function DonationReportsMatchRedirectPage() {
  redirect(donationImportMatchHref({ view: "match" }))
}
