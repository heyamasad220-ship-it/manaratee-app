import { redirect } from "next/navigation"

/** Programs Settings moved to HR → Departments → [department] → Settings. */
export default function ProgramsSettingsRedirectPage() {
  redirect("/workforce?tab=departments")
}
