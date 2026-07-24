"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { StaffRecordsClient } from "@/components/hr/staff-records-client"
import { hrEmployeePositionsHref } from "@/lib/hr/hr-overview-path"

const legacyEmployeesTabValues = [
  "overview",
  "time-off",
  "work-schedule",
  "notifications",
  "teams",
  "applications",
  "assignments",
  "documents",
  "employees",
  "departments",
  "positions",
] as const

export function HrEmployeesPageClient({
  organizationId,
  initialTab,
}: {
  organizationId: string | null
  initialTab?: string | null
  initialStaffTab?: string | null
}) {
  const router = useRouter()

  React.useEffect(() => {
    if (initialTab === "departments") {
      router.replace("/workforce?tab=departments")
      return
    }
    if (initialTab === "positions") {
      router.replace(hrEmployeePositionsHref())
      return
    }
    if (
      initialTab &&
      initialTab !== "applications" &&
      initialTab !== "employees" &&
      legacyEmployeesTabValues.includes(
        initialTab as (typeof legacyEmployeesTabValues)[number]
      )
    ) {
      router.replace("/workforce/employees", { scroll: false })
    }
  }, [initialTab, router])

  return <StaffRecordsClient organizationId={organizationId} />
}
