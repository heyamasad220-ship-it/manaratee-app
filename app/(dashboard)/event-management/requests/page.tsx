import { redirect } from "next/navigation"

export default function InternalEventRequestsRedirectPage() {
  redirect("/event-management/overview#attention-required")
}
