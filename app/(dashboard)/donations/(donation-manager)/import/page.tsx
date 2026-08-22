import { redirect } from "next/navigation"

import { donationImportMatchHref } from "@/lib/donations/donation-payment-paths"

export default async function DonationsImportRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams

  if (params.tab === "match") {
    redirect(donationImportMatchHref({ view: "match" }))
  }

  redirect(donationImportMatchHref({ tab: params.tab }))
}
