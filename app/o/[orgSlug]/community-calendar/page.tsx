import { notFound } from "next/navigation"

import { PublicCommunityCalendarView } from "@/components/community-calendar/public-community-calendar-view"
import { getPublicCommunityCalendarBySlug } from "@/lib/community-calendar/public-queries"

export default async function PublicCommunityCalendarPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const catalog = await getPublicCommunityCalendarBySlug(orgSlug)

  if (!catalog.organization) {
    notFound()
  }

  return (
    <PublicCommunityCalendarView
      organization={catalog.organization}
      eventTypes={catalog.eventTypes}
      events={catalog.events}
      featured={catalog.featured}
      showPlaceholdersWhenEmpty
    />
  )
}
