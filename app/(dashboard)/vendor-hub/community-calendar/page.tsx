import { CommunityCalendarClient } from "@/components/vendor-hub/community-calendar/community-calendar-client"
import { PageBreadcrumbs } from "@/components/navigation/page-breadcrumbs"

export default function CommunityCalendarPage() {
  return (
    <>
      <div className="border-b border-border bg-card px-6 pt-6 pb-2">
        <PageBreadcrumbs
          className="mb-2"
          items={[
            { label: "Vendor Hub", href: "/vendor-hub" },
            { label: "Community Calendar" },
          ]}
        />
      </div>
      <div className="p-6">
        <CommunityCalendarClient />
      </div>
    </>
  )
}
