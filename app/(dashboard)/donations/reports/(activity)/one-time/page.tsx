import { redirect } from "next/navigation"

import { DONATION_TRANSACTIONS_PATH } from "@/lib/donations/donation-payment-paths"

export default function DonationReportsOneTimeRedirectPage() {
  redirect(DONATION_TRANSACTIONS_PATH)
}
