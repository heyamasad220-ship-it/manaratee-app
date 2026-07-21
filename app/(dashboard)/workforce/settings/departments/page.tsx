import { redirect } from "next/navigation"

/** Departments moved to HR → Departments (`/workforce/departments`). */
export default function WorkforceSettingsDepartmentsRedirectPage() {
  redirect("/workforce/departments")
}
