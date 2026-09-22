import { redirect } from "next/navigation"

import { DONATION_PLEDGES_PATH } from "@/lib/donations/donation-pledge-paths"

export default function DonationPledgePerformanceRedirectPage() {
  redirect(DONATION_PLEDGES_PATH)
}
