import { redirect } from "next/navigation"

export default function CustomerCalendarRedirect() {
  redirect("/customer/rentals/new")
}
