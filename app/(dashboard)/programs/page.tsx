import { redirect } from "next/navigation"

import { WORKFORCE_DEPARTMENTS_PATH } from "@/lib/departments/department-paths"

export default function ProgramsPage() {
  redirect(WORKFORCE_DEPARTMENTS_PATH)
}
