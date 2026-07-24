import { redirect } from "next/navigation"
import { hrEmployeePositionsHref } from "@/lib/hr/hr-overview-path"

/** Positions moved under Employees → Positions. */
export default function WorkforceSettingsPositionsRedirectPage() {
  redirect(hrEmployeePositionsHref())
}
