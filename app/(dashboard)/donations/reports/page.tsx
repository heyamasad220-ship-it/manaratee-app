import { redirect } from "next/navigation"

import { DONATION_TRANSACTIONS_PATH } from "@/lib/donations/donation-payment-paths"

export default async function DonationsReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const params = await searchParams
  const range = params.range?.trim()
  redirect(
    range
      ? `${DONATION_TRANSACTIONS_PATH}?range=${encodeURIComponent(range)}`
      : DONATION_TRANSACTIONS_PATH
  )
}
