import { redirect } from "next/navigation"

export default function HrTimeOffRedirectPage() {
  redirect("/hr/employees?tab=overview")
}
