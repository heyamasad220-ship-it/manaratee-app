import { redirect } from "next/navigation"

import { DONATION_RECEIPTS_OPS_PATH } from "@/lib/donations/donation-payment-paths"

export default function DonationReportsReceiptsRedirectPage() {
  redirect(DONATION_RECEIPTS_OPS_PATH)
}
