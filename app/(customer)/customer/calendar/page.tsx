import { redirect } from "next/navigation"

import { guardCustomerPortalPath } from "@/lib/customer/customer-portal-modules-server"

export default async function CustomerCalendarRedirect() {
  await guardCustomerPortalPath("/customer/calendar")
  redirect("/customer/rentals/new")
}
