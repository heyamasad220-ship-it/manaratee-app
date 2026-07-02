import { redirect } from "next/navigation"

export default async function DonationsImportRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams

  if (params.tab === "match") {
    redirect("/donations/reports/match")
  }

  const query = params.tab === "history" ? "?tab=history" : ""
  redirect(`/donations/reports/import${query}`)
}
