import { redirect } from "next/navigation"

export default async function HRSettingsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams

  if (tab === "departments") {
    redirect("/workforce/departments")
  }
  if (tab === "positions") {
    redirect("/workforce/settings/positions")
  }

  const query = tab ? `?tab=${encodeURIComponent(tab)}` : ""
  redirect(`/workforce/settings${query}`)
}
