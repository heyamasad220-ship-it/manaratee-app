import { redirect } from "next/navigation"
import { hrOverviewHref } from "@/lib/hr/hr-overview-path"

export default function HrTimeOffRedirectPage() {
  redirect(hrOverviewHref({ tab: "employees" }))
}
