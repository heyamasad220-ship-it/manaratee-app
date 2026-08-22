import { redirect } from "next/navigation"

import { DONATION_REPORTS_CAMPAIGNS_PATH } from "@/lib/donations/donation-payment-paths"

export default function DonationReportsCampaignGroupsRedirectPage() {
  redirect(`${DONATION_REPORTS_CAMPAIGNS_PATH}?view=groups`)
}
