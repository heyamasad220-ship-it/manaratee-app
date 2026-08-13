import { CommunityCalendarClient } from "@/components/community-calendar/community-calendar-client"
import { Header } from "@/components/layout/header"
import { requireCommunityCalendarAccess } from "@/lib/community-calendar/access"
import { getCommunityCalendarPageData } from "@/lib/community-calendar/queries"

export default async function CommunityCalendarPage() {
  await requireCommunityCalendarAccess()
  const data = await getCommunityCalendarPageData()

  return (
    <>
      <Header title="Community Calendar" />
      <div className="p-6">
        <CommunityCalendarClient
          items={data.items}
          includeBazaar={data.includeBazaar}
          includeEvents={data.includeEvents}
        />
      </div>
    </>
  )
}
