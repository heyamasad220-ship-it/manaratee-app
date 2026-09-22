import { redirect } from "next/navigation"

export default function DonationReportsCampaignGroupsRedirectPage() {
  redirect("/donations/campaigns?view=groups")
}
