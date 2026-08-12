"use client"

import * as React from "react"
import { Suspense } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { HrChildcarePanel } from "@/components/hr/hr-childcare-panel"
import { StaffRecordsClient } from "@/components/hr/staff-records-client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VolunteersList } from "@/components/workforce/volunteers-list"
import {
  HR_OVERVIEW_TABS,
  hrOverviewHref,
  hrOverviewTabFromPathname,
  parseHrOverviewTab,
  type HrOverviewTab,
} from "@/lib/hr/hr-overview-path"
import type {
  ChildcareProviderRecord,
  ChildcareProviderStats,
} from "@/lib/hr/childcare-provider-actions"

export function HrOverviewClient({
  organizationId,
  childcareProviders,
  childcareStats,
  initialTab,
}: {
  organizationId: string | null
  childcareProviders: ChildcareProviderRecord[]
  childcareStats: ChildcareProviderStats
  initialTab?: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = React.useState<HrOverviewTab>(() =>
    parseHrOverviewTab(
      initialTab ?? hrOverviewTabFromPathname(pathname) ?? searchParams.get("tab")
    )
  )

  React.useEffect(() => {
    setActiveTab(hrOverviewTabFromPathname(pathname))
  }, [pathname])

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

        <TabsContent value="employees" className="mt-0">
          <StaffRecordsClient organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="volunteers" className="mt-0">
          <Suspense
            fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}
          >
            <VolunteersList />
          </Suspense>
        </TabsContent>

        <TabsContent value="childcare" className="mt-0">
          <Suspense
            fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}
          >
            <HrChildcarePanel
              providers={childcareProviders}
              stats={childcareStats}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
