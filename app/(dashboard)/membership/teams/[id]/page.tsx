import { redirect } from "next/navigation"

import { membershipTeamDetailPath } from "@/lib/memberships/membership-module-label"

/** Legacy Teams detail — member groups live at Membership → Groups. */
export default async function MembershipTeamDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(membershipTeamDetailPath(id))
}
