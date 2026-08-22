import { redirect } from "next/navigation"

import { DONATIONS_GROUP_GIVING_REPORT_PATH } from "@/lib/donations/donor-giving-report"

export default function ContactsGroupsRedirectPage() {
  redirect(DONATIONS_GROUP_GIVING_REPORT_PATH)
}
