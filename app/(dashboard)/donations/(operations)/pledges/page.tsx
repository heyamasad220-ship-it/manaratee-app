import { redirect } from "next/navigation"

import { DONATION_PLEDGES_PATH } from "@/lib/donations/donation-pledge-paths"

export default async function DonationsPledgesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      query.set(key, value)
    } else if (Array.isArray(value) && value[0]) {
      query.set(key, value[0])
    }
  }

  const queryString = query.toString()
  redirect(queryString ? `${DONATION_PLEDGES_PATH}?${queryString}` : DONATION_PLEDGES_PATH)
}
