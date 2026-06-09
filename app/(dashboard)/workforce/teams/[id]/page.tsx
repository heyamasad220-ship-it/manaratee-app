import { redirect } from "next/navigation"
import { membershipTeamDetailPath } from "@/lib/memberships/membership-module-label"

export default async function HrTeamDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(membershipTeamDetailPath(id))
}
