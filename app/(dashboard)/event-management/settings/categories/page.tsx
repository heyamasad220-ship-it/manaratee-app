import { redirect } from "next/navigation"

import { EVENT_MANAGEMENT_TICKETING_SETTINGS_PATH } from "@/lib/events/event-management-section-path"

export default function EventManagementCategoriesSettingsPage() {
  redirect(EVENT_MANAGEMENT_TICKETING_SETTINGS_PATH)
}
