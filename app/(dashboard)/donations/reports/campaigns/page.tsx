import { redirect } from "next/navigation"

export default async function DonationCampaignPerformanceRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const params = await searchParams
  const view = params.view?.trim()
  if (view === "groups" || view === "wishlist") {
    redirect(`/donations/campaigns?view=${encodeURIComponent(view)}`)
  }
  redirect("/donations/campaigns")
}
