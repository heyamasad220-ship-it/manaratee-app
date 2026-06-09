import { redirect } from "next/navigation"
import { MEMBERSHIP_TEAMS_PATH } from "@/lib/memberships/membership-module-label"

export default async function SettingsTeamsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const query = tab ? `?tab=${encodeURIComponent(tab)}` : ""
  redirect(`${MEMBERSHIP_TEAMS_PATH}${query}`)
}
