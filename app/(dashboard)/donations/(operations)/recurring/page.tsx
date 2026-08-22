import { redirect } from "next/navigation"

import { DONATION_RECURRING_OPS_PATH } from "@/lib/donations/donation-payment-paths"

export default function DonationsRecurringRedirectPage() {
  redirect(DONATION_RECURRING_OPS_PATH)
}
