"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ContactsListView } from "@/components/contacts/contacts-list-view"
import { DepartmentsManager } from "@/components/departments/departments-manager"
import { HrEmployeesOverview } from "@/components/hr/hr-employees-overview"
import { HrPositionsManager } from "@/components/hr/hr-positions-manager"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Briefcase, FolderOpen, LayoutGrid, Users } from "lucide-react"

const employeesTabValues = ["overview", "employees", "departments", "positions"] as const

const deprecatedEmployeesTabValues = [
  "time-off",
  "work-schedule",
  "notifications",
  "teams",
  "applications",
] as const

type EmployeesTabValue = (typeof employeesTabValues)[number]

function normalizeTab(value?: string | null): EmployeesTabValue {
  if (value && employeesTabValues.includes(value as EmployeesTabValue)) {
    return value as EmployeesTabValue
  }
  if (
    value &&
    deprecatedEmployeesTabValues.includes(value as (typeof deprecatedEmployeesTabValues)[number])
  ) {
    return "overview"
  }
  return "overview"
}

export function HrEmployeesPageClient({ initialTab }: { initialTab?: string | null }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState<EmployeesTabValue>(normalizeTab(initialTab))

  React.useEffect(() => {
    setActiveTab(normalizeTab(initialTab))
  }, [initialTab])

  function handleTabChange(value: string) {
    const tab = normalizeTab(value)
    setActiveTab(tab)
    router.replace(`/hr/employees?tab=${tab}`, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        <p className="text-sm text-muted-foreground">
          Manage employee contacts, departments, and positions.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutGrid className="size-4" />
            Overview
          </TabsTrigger>
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

        <TabsContent value="overview">
          <HrEmployeesOverview
            onManageEmployees={() => handleTabChange("employees")}
            onManageDepartments={() => handleTabChange("departments")}
          />
        </TabsContent>

        <TabsContent value="employees">
          <ContactsListView
            requiredRole="employee"
            defaultAddRoles={["employee"]}
            hideRoleFilter
            showStats={false}
            embedded
            emptyMessage="No employees yet. Add a contact with the Employee role."
            headerAction={
              <Button variant="outline" asChild>
                <Link href="/programs/instructors">Employee records &amp; assignments</Link>
              </Button>
            }
          />
        </TabsContent>

        <TabsContent value="departments">
          <DepartmentsManager />
        </TabsContent>

        <TabsContent value="positions">
          <HrPositionsManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
