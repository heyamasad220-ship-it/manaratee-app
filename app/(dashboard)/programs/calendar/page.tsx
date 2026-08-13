import { redirect } from "next/navigation"

/**
 * Legacy Programs → Calendar.
 * Space availability lives on Facilities → Calendar (shared schedule).
 */
export default function ProgramsCalendarPage() {
  redirect("/facilities/calendar")
}
