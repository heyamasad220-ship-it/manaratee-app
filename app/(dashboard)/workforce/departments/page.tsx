import { redirect } from "next/navigation"
import { hrOverviewHref } from "@/lib/hr/hr-overview-path"

export default async function WorkforceDepartmentsPage() {
  redirect(hrOverviewHref({ tab: "departments" }))
}
