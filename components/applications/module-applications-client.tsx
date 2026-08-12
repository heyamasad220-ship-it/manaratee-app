"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { LayoutGrid, FileText } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ApplicationsModulePage } from "@/components/applications/applications-module-page"
import {
  applicationsPageUrl,
  type ApplicationsPageTab,
} from "@/lib/applications/application-routes"
import type { ApplicationStatusTabId } from "@/lib/applications/application-status-tabs"
import type { ModuleOwner } from "@/lib/applications/application-types"

const builtInPageTabs = ["overview", "submissions"] as const

export type ModuleApplicationsExtraTab = {
  value: string
  label: string
  icon?: LucideIcon
  content: ReactNode
}

function normalizePageTab(
  tabParam: string | null,
  searchParams: URLSearchParams,
  {
    allowOverview = true,
    extraTabValues = [],
  }: {
    allowOverview?: boolean
    extraTabValues?: string[]
  } = {}
): ApplicationsPageTab {
  if (tabParam && extraTabValues.includes(tabParam)) {
    return tabParam
  }

  // Legacy templates tab → submissions / overview.
  if (tabParam === "templates") {
    return allowOverview ? "overview" : "submissions"
  }

  if (tabParam && builtInPageTabs.includes(tabParam as (typeof builtInPageTabs)[number])) {
    if (tabParam === "overview" && !allowOverview) {
      return "submissions"
    }
    return tabParam as ApplicationsPageTab
  }

  if (searchParams.get("application_type") || searchParams.get("status")) {
    return "submissions"
  }

  return allowOverview ? "overview" : "submissions"
}

export function ModuleApplicationsClient({
  moduleOwner,
  basePath,
  title,
  description = "Review submissions and track application status.",
  lockedApplicationType,
  hubApplicationTypes,
  overviewLeadingContent,
  vendorHubEventId,
  showOverviewTab = true,
  extraTabs = [],
  headerAction,
}: {
  moduleOwner: ModuleOwner
  basePath: string
  title: string
  description?: string
  lockedApplicationType?: string
  hubApplicationTypes?: readonly string[]
  overviewLeadingContent?: ReactNode
  /** When set, application review links include bazaar event context for participation sync. */
  vendorHubEventId?: string
  /** People Management Applications is submissions-only. */
  showOverviewTab?: boolean
  /** Extra page tabs (e.g. Programs Financial Assistance report panels). */
  extraTabs?: ModuleApplicationsExtraTab[]
  /** Optional action beside the page title (e.g. Copy apply link). */
  headerAction?: ReactNode
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const extraTabValues = useMemo(() => extraTabs.map((tab) => tab.value), [extraTabs])
  const tabOptions = useMemo(
    () => ({
      allowOverview: showOverviewTab,
      extraTabValues,
    }),
    [showOverviewTab, extraTabValues]
  )
  const [activeTab, setActiveTab] = useState<ApplicationsPageTab>(() =>
    normalizePageTab(searchParams.get("tab"), searchParams, tabOptions)
  )

  const resolvedHubTypes = useMemo(
    () => hubApplicationTypes ?? (lockedApplicationType ? [lockedApplicationType] : []),
    [hubApplicationTypes, lockedApplicationType]
  )

  const applicationTypeFromUrl =
    lockedApplicationType ?? searchParams.get("application_type") ?? undefined

  const showTabBar = showOverviewTab || extraTabs.length > 0

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setActiveTab(normalizePageTab(searchParams.get("tab"), searchParams, tabOptions))
  }, [searchParams, tabOptions])

  const handleTabChange = useCallback(
    (value: string) => {
      const tab = normalizePageTab(value, searchParams, tabOptions)
      setActiveTab(tab)

      const isExtra = extraTabValues.includes(tab)
      const href = applicationsPageUrl(basePath, {
        pageTab: tab,
        applicationType:
          tab === "submissions" && !isExtra ? applicationTypeFromUrl : undefined,
        status:
          tab === "submissions" && !isExtra
            ? (searchParams.get("status") as ApplicationStatusTabId | undefined)
            : undefined,
      })
      router.replace(href, { scroll: false })
    },
    [applicationTypeFromUrl, basePath, extraTabValues, router, searchParams, tabOptions]
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

  const submissionsPage = (
    <ApplicationsModulePage
      moduleOwner={moduleOwner}
      basePath={basePath}
      hubApplicationTypes={resolvedHubTypes}
      lockedApplicationType={lockedApplicationType}
      section={showOverviewTab && !overviewLeadingContent ? "submissions" : "all"}
      hidePageHeader
      pageTab="submissions"
      vendorHubEventId={vendorHubEventId}
    />
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>

      {!mounted ? (
        <div className="space-y-6">
          {showTabBar ? (
            <div className="h-9 w-full max-w-md animate-pulse rounded-lg bg-muted" />
          ) : null}
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : !showTabBar ? (
        submissionsPage
      ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="flex h-auto flex-wrap">
            {showOverviewTab ? (
              <TabsTrigger value="overview" className="gap-2">
                <LayoutGrid className="size-4" />
                Overview
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="submissions" className="gap-2">
              <FileText className="size-4" />
              Submissions
            </TabsTrigger>
            {extraTabs.map((tab) => {
              const Icon = tab.icon
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                  {Icon ? <Icon className="size-4" /> : null}
                  {tab.label}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {showOverviewTab ? (
            <TabsContent value="overview" className="mt-0 space-y-6">
              {overviewLeadingContent}
              {!overviewLeadingContent && activeTab === "overview" && (
                <ApplicationsModulePage
                  moduleOwner={moduleOwner}
                  basePath={basePath}
                  hubApplicationTypes={resolvedHubTypes}
                  lockedApplicationType={lockedApplicationType}
                  section="overview"
                  hidePageHeader
                  onNavigateToSubmissions={navigateToSubmissions}
                  vendorHubEventId={vendorHubEventId}
                />
              )}
            </TabsContent>
          ) : null}

          <TabsContent value="submissions" className="mt-0">
            {activeTab === "submissions" && submissionsPage}
          </TabsContent>

          {extraTabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-0">
              {activeTab === tab.value ? tab.content : null}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
