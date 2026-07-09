import { redirect } from "next/navigation"

import { donationPledgesHref } from "@/lib/donations/donation-pledge-paths"

export default function PledgeCollectionPage() {
  redirect(donationPledgesHref({ hash: "collection-queue" }))
}
