import { redirect } from "next/navigation"

export default async function ContactsSettingsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  redirect(tab ? `/directory/settings?tab=${tab}` : "/directory/settings")
}
