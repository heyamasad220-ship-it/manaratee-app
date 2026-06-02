import { redirect } from "next/navigation"

export default function HRDepartmentsPage() {
  redirect("/hr/employees?tab=departments")
}
