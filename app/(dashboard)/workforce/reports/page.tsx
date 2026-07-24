import { redirect } from "next/navigation"
import { HR_OVERVIEW_PATH } from "@/lib/hr/hr-overview-path"

/** HR Reports hub removed — metrics live on Overview. */
export default function WorkforceReportsRedirectPage() {
  redirect(HR_OVERVIEW_PATH)
}
