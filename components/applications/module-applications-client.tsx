"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { LayoutGrid, FileText, Layers } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ApplicationsModulePage } from "@/components/applications/applications-module-page"
import { ApplicationTemplatesPanel } from "@/components/applications/application-templates-panel"
import {
  applicationsPageUrl,
  type ApplicationsPageTab,
} from "@/lib/applications/application-routes"
import type { ApplicationStatusTabId } from "@/lib/applications/application-status-tabs"
import type { ModuleOwner } from "@/lib/applications/application-types"

const pageTabValues = ["overview", "submissions", "templates"] as const

function normalizePageTab(
  tabParam: string | null,
  searchParams: URLSearchParams
): ApplicationsPageTab {
  if (tabParam && pageTabValues.includes(tabParam as ApplicationsPageTab)) {
    return tabParam as ApplicationsPageTab
  }

  if (searchParams.get("application_type") || searchParams.get("status")) {
    return "submissions"
  }

  return "overview"
}

export function ModuleApplicationsClient({
  moduleOwner,
  basePath,
  title,
  description = "Review submissions, track status, and configure application templates.",
  lockedApplicationType,
  hubApplicationTypes,
}: {
  moduleOwner: ModuleOwner
  basePath: string
  title: string
  description?: string
  lockedApplicationType?: string
  hubApplicationTypes?: readonly string[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<ApplicationsPageTab>(() =>
    normalizePageTab(searchParams.get("tab"), searchParams)
  )

  const resolvedHubTypes = useMemo(
    () => hubApplicationTypes ?? (lockedApplicationType ? [lockedApplicationType] : []),
    [hubApplicationTypes, lockedApplicationType]
  )

  const applicationTypeFromUrl =
    lockedApplicationType ?? searchParams.get("application_type") ?? undefined

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setActiveTab(normalizePageTab(searchParams.get("tab"), searchParams))
  }, [searchParams])

  const handleTabChange = useCallback(
    (value: string) => {
      const tab = normalizePageTab(value, searchParams)
      setActiveTab(tab)

      const href = applicationsPageUrl(basePath, {
        pageTab: tab,
        applicationType: tab === "submissions" ? applicationTypeFromUrl : undefined,
        status:
          tab === "submissions"
            ? (searchParams.get("status") as ApplicationStatusTabId | undefined)
            : undefined,
      })
      router.replace(href, { scroll: false })
    },
    [applicationTypeFromUrl, basePath, router, searchParams]
  )

  const navigateToSubmissions = useCallback(
    (options?: { statusTab?: ApplicationStatusTabId; applicationType?: string }) => {
      setActiveTab("submissions")
      const href = applicationsPageUrl(basePath, {
        pageTab: "submissions",
        status: options?.statusTab,
        applicationType: options?.applicationType ?? applicationTypeFromUrl,
      })
      router.replace(href, { scroll: false })
    },
    [applicationTypeFromUrl, basePath, router]
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {!mounted ? (
        <div className="space-y-6">
          <div className="h-9 w-full max-w-md animate-pulse rounded-lg bg-muted" />
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : (
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
              moduleOwner={moduleOwner}
              basePath={basePath}
              hubApplicationTypes={resolvedHubTypes}
              lockedApplicationType={lockedApplicationType}
              section="overview"
              hidePageHeader
              onNavigateToSubmissions={navigateToSubmissions}
            />
          )}
        </TabsContent>

        <TabsContent value="submissions" className="mt-0">
          {activeTab === "submissions" && (
            <ApplicationsModulePage
              moduleOwner={moduleOwner}
              basePath={basePath}
              hubApplicationTypes={resolvedHubTypes}
              lockedApplicationType={lockedApplicationType}
              section="submissions"
              hidePageHeader
              pageTab="submissions"
            />
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-0">
          {activeTab === "templates" && (
            <ApplicationTemplatesPanel
              moduleOwner={moduleOwner}
              basePath={basePath}
              hubApplicationTypes={resolvedHubTypes}
            />
          )}
        </TabsContent>
      </Tabs>
      )}
    </div>
  )
}
