import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PublicBazaarEventPage } from "@/components/bazaar/public-bazaar-event-page"
import { getPublicBazaarEventByShareToken } from "@/lib/vendor-hub/public-bazaar-event-queries"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareToken: string }>
}): Promise<Metadata> {
  const { shareToken } = await params
  const event = await getPublicBazaarEventByShareToken(shareToken)

  if (!event) {
    return { title: "Bazaar not found" }
  }

  return {
    title: `${event.name} | ${event.organizationName}`,
    description: event.description ?? `Bazaar event hosted by ${event.organizationName}`,
    openGraph: event.flyerUrl
      ? {
          title: event.name,
          description: event.description ?? undefined,
          images: [{ url: event.flyerUrl }],
        }
      : undefined,
  }
}

export default async function PublicBazaarSharePage({
  params,
}: {
  params: Promise<{ shareToken: string }>
}) {
  const { shareToken } = await params
  const event = await getPublicBazaarEventByShareToken(shareToken)

  if (!event) {
    notFound()
  }

  return <PublicBazaarEventPage event={event} />
}
