"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { DepartmentsManager } from "@/components/departments/departments-manager"
import { FinancePayrollQueuePanel } from "@/components/finance/finance-payroll-queue-panel"
import { HrChildcarePanel } from "@/components/hr/hr-childcare-panel"
import { HrOverviewDashboard } from "@/components/hr/hr-reports-client"
import { StaffRecordsClient } from "@/components/hr/staff-records-client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VolunteersList } from "@/components/workforce/volunteers-list"
import {
  HR_OVERVIEW_TABS,
  hrOverviewHref,
  parseHrOverviewTab,
  type HrOverviewTab,
} from "@/lib/hr/hr-overview-path"
import type { ChildcareProviderRecord, ChildcareProviderStats } from "@/lib/hr/childcare-provider-actions"

export function HrOverviewClient({
  organizationId,
  overviewStats,
  childcareProviders,
  childcareStats,
  initialTab,
}: {
  organizationId: string | null
  overviewStats: {
    employees: number
    volunteers: number
    childcareProviders: number
  }
  childcareProviders: ChildcareProviderRecord[]
  childcareStats: ChildcareProviderStats
  initialTab?: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = React.useState<HrOverviewTab>(() =>
    parseHrOverviewTab(initialTab ?? searchParams.get("tab"))
  )

  React.useEffect(() => {
    setActiveTab(parseHrOverviewTab(searchParams.get("tab")))
  }, [searchParams])

  function onTabChange(value: string) {
    const next = parseHrOverviewTab(value)
    setActiveTab(next)
    router.replace(hrOverviewHref({ tab: next }), { scroll: false })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Tabs value={activeTab} onValueChange={onTabChange} className="gap-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          {HR_OVERVIEW_TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="rounded-md border border-transparent px-3 py-1.5 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <HrOverviewDashboard
            organizationId={organizationId}
            volunteerCount={overviewStats.volunteers}
            childcareProviderCount={overviewStats.childcareProviders}
          />
        </TabsContent>

        <TabsContent value="departments" className="mt-0">
          <DepartmentsManager />
        </TabsContent>

        <TabsContent value="employees" className="mt-0">
          <StaffRecordsClient organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="volunteers" className="mt-0">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
            <VolunteersList />
          </Suspense>
        </TabsContent>

        <TabsContent value="childcare" className="mt-0">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
            <HrChildcarePanel providers={childcareProviders} stats={childcareStats} />
          </Suspense>
        </TabsContent>

        <TabsContent value="payroll" className="mt-0">
          <FinancePayrollQueuePanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
