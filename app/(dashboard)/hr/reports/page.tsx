import { redirect } from "next/navigation"
import { HR_OVERVIEW_PATH } from "@/lib/hr/hr-overview-path"

/** Legacy /hr/reports → Overview. */
export default function HrReportsRedirectPage() {
  redirect(HR_OVERVIEW_PATH)
}
