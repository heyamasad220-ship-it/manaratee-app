import { redirect } from "next/navigation"
import { hrEmployeePositionsHref } from "@/lib/hr/hr-overview-path"

export default function SettingsPositionsRedirectPage() {
  redirect(hrEmployeePositionsHref())
}
