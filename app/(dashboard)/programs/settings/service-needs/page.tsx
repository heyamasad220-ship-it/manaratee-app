import { redirect } from "next/navigation"

/** Service Needs moved to department Settings. */
export default function ProgramServiceNeedsSettingsRedirectPage() {
  redirect("/workforce?tab=departments")
}
