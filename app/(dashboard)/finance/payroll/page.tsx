import { redirect } from "next/navigation"
import { hrPayrollHref } from "@/lib/hr/hr-overview-path"

/** Legacy Finance → Payroll redirects to HR Overview → Payroll. */
export default function FinancePayrollRedirectPage() {
  redirect(hrPayrollHref())
}
