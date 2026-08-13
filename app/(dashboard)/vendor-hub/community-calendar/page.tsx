import { redirect } from "next/navigation"

import { COMMUNITY_CALENDAR_PATH } from "@/lib/community-calendar/routes"

/** Legacy Vendor Hub path — Community Calendar is a shared top-level surface. */
export default function VendorHubCommunityCalendarRedirectPage() {
  redirect(COMMUNITY_CALENDAR_PATH)
}
