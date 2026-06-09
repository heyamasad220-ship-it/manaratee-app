import { redirect } from "next/navigation"

export default function HrTimeOffRedirectPage() {
  redirect("/workforce/employees?tab=employees")
}
