import { redirect } from "next/navigation"

export default function CustomerBookingsRedirect() {
  redirect("/customer/rentals")
}
