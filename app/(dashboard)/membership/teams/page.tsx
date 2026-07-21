import { redirect } from "next/navigation"

import { MEMBERSHIP_GROUPS_PATH } from "@/lib/memberships/membership-module-label"

/** Legacy Teams path — member groups live at Membership → Groups. */
export default async function MembershipTeamsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const query = tab ? `?tab=${encodeURIComponent(tab)}` : ""
  redirect(`${MEMBERSHIP_GROUPS_PATH}${query}`)
}
