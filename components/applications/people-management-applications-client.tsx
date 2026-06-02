"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { LayoutGrid, FileText, Layers } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ApplicationsModulePage } from "@/components/applications/applications-module-page"
import { ApplicationTemplatesPanel } from "@/components/applications/application-templates-panel"
import {
  peopleManagementApplicationsUrl,
  type PeopleManagementApplicationsPageTab,
} from "@/lib/applications/application-routes"
import type { ApplicationStatusTabId } from "@/lib/applications/application-status-tabs"

const pageTabValues = ["overview", "submissions", "templates"] as const

function normalizePageTab(
  tabParam: string | null,
  searchParams: URLSearchParams
): PeopleManagementApplicationsPageTab {
  if (tabParam && pageTabValues.includes(tabParam as PeopleManagementApplicationsPageTab)) {
    return tabParam as PeopleManagementApplicationsPageTab
  }

  if (searchParams.get("application_type") || searchParams.get("status")) {
    return "submissions"
  }

  return "overview"
}

export function PeopleManagementApplicationsClient({
  hubApplicationTypes,
}: {
  hubApplicationTypes: readonly string[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<PeopleManagementApplicationsPageTab>(() =>
    normalizePageTab(searchParams.get("tab"), searchParams)
  )

  const applicationTypeFromUrl = searchParams.get("application_type") ?? undefined

  useEffect(() => {
    setActiveTab(normalizePageTab(searchParams.get("tab"), searchParams))
  }, [searchParams])

  const handleTabChange = useCallback(
    (value: string) => {
      const tab = normalizePageTab(value, searchParams)
      setActiveTab(tab)

      const href = peopleManagementApplicationsUrl({
        pageTab: tab,
        applicationType: tab === "submissions" ? applicationTypeFromUrl : undefined,
        status:
          tab === "submissions"
            ? (searchParams.get("status") as ApplicationStatusTabId | undefined)
            : undefined,
      })
      router.replace(href, { scroll: false })
    },
    [applicationTypeFromUrl, router, searchParams]
  )

  const navigateToSubmissions = useCallback(
    (options?: { statusTab?: ApplicationStatusTabId; applicationType?: string }) => {
      setActiveTab("submissions")
      const href = peopleManagementApplicationsUrl({
        pageTab: "submissions",
        status: options?.statusTab,
        applicationType: options?.applicationType ?? applicationTypeFromUrl,
      })
      router.replace(href, { scroll: false })
    },
    [applicationTypeFromUrl, router]
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">Applications</h2>
        <p className="text-sm text-muted-foreground">
          Review submissions, track status, and configure application templates.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutGrid className="size-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="submissions" className="gap-2">
            <FileText className="size-4" />
            Submissions
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Layers className="size-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          {activeTab === "overview" && (
            <ApplicationsModulePage
              moduleOwner="hr"
              hubApplicationTypes={hubApplicationTypes}
              section="overview"
              hidePageHeader
              onNavigateToSubmissions={navigateToSubmissions}
            />
          )}
        </TabsContent>

        <TabsContent value="submissions" className="mt-0">
          {activeTab === "submissions" && (
            <ApplicationsModulePage
              moduleOwner="hr"
              hubApplicationTypes={hubApplicationTypes}
              section="submissions"
              hidePageHeader
              pageTab="submissions"
            />
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-0">
          {activeTab === "templates" && (
            <ApplicationTemplatesPanel hubApplicationTypes={hubApplicationTypes} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
