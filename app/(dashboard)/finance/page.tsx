import { redirect } from "next/navigation"
import { hrPayrollHref } from "@/lib/hr/hr-overview-path"

/** Finance module sidebar removed — payroll lives under HR → Payroll. */
export default function FinanceIndexPage() {
  redirect(hrPayrollHref())
}
