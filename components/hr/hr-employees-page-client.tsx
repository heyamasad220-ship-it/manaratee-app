"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  StaffRecordsClient,
} from "@/components/hr/staff-records-client"
import { DepartmentsManager } from "@/components/departments/departments-manager"
import { HrPositionsManager } from "@/components/hr/hr-positions-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Briefcase, FolderOpen, Users } from "lucide-react"

const employeesPageTabs = ["employees", "departments", "positions"] as const

const legacyEmployeesTabValues = [
  "overview",
  "time-off",
  "work-schedule",
  "notifications",
  "teams",
  "applications",
  "assignments",
  "documents",
] as const

type EmployeesPageTab = (typeof employeesPageTabs)[number]

function normalizePageTab(
  tab?: string | null,
  staffTab?: string | null
): EmployeesPageTab {
  if (tab === "departments" || tab === "positions") {
    return tab
  }
  if (tab && employeesPageTabs.includes(tab as EmployeesPageTab)) {
    return tab as EmployeesPageTab
  }
  if (
    tab === "assignments" ||
    tab === "documents" ||
    staffTab === "assignments" ||
    staffTab === "documents"
  ) {
    return "employees"
  }
  if (
    tab &&
    legacyEmployeesTabValues.includes(tab as (typeof legacyEmployeesTabValues)[number])
  ) {
    return "employees"
  }
  return "employees"
}

export function HrEmployeesPageClient({
  organizationId,
  initialTab,
  initialStaffTab,
}: {
  organizationId: string | null
  initialTab?: string | null
  initialStaffTab?: string | null
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState<EmployeesPageTab>(
    normalizePageTab(initialTab, initialStaffTab)
  )

  React.useEffect(() => {
    setActiveTab(normalizePageTab(initialTab, initialStaffTab))
  }, [initialTab, initialStaffTab])

  function handleTabChange(value: string) {
    const tab = normalizePageTab(value, null)
    setActiveTab(tab)
    router.replace(`/workforce/employees?tab=${tab}`, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        <p className="text-sm text-muted-foreground">
          Employee roster, departments, and positions. Open an employee profile for assignments and documents.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="employees" className="gap-2">
            <Users className="size-4" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-2">
            <FolderOpen className="size-4" />
            Departments
          </TabsTrigger>
          <TabsTrigger value="positions" className="gap-2">
            <Briefcase className="size-4" />
            Positions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-0">
          <StaffRecordsClient organizationId={organizationId} embedded section="overview" />
        </TabsContent>

        <TabsContent value="departments" className="mt-0">
          <DepartmentsManager />
        </TabsContent>

        <TabsContent value="positions" className="mt-0">
          <HrPositionsManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
