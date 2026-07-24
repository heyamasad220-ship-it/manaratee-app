"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Loader2,
  Search,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  fetchApplicationDashboardStats,
  fetchApplicationsList,
  fetchApplicationTypeDefinitions,
} from "@/lib/applications/application-actions"
import {
  applicationsPageUrl,
  HR_COMMITTEE_APPLICATIONS_PATH,
  hrCategoryApplicationsUrl,
  isHrCategoryApplicationsPath,
  MEMBERSHIP_APPLICATIONS_PATH,
  peopleManagementApplicationsUrl,
  PROGRAMS_FINANCIAL_ASSISTANCE_PATH,
  VENDOR_HUB_APPLICATIONS_PATH,
  type PeopleManagementApplicationsPageTab,
} from "@/lib/applications/application-routes"
import {
  APPLICATION_LIST_STATUS_TABS,
  dashboardCardToTabId,
  statusFilterValueForTab,
  statusTabIdFromQueryParam,
  tabIdFromStatusFilter,
  type ApplicationDashboardCardId,
  type ApplicationStatusTabId,
} from "@/lib/applications/application-status-tabs"
import {
  APPLICATION_STATUS_LABELS,
  getTypeIcon,
  getTypeLabel,
  PENDING_STATUSES,
  type ApplicationRecord,
  type ApplicationStatus,
  type ApplicationTypeDefinition,
  type ModuleOwner,
} from "@/lib/applications/application-types"
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge"

type ApplicationsModulePageProps = {
  moduleOwner: ModuleOwner
  basePath?: string
  title?: string
  description?: string
  hideModuleFilter?: boolean
  /** When set, always filter to this application type and hide the type filter. */
  lockedApplicationType?: string
  /** Embed inside another page (reduced chrome, custom URL sync). */
  embedded?: boolean
  /** Base path for URL sync when embedded, e.g. /workforce/employees with tab=applications. */
  embeddedSyncPath?: string
  /** When set, only filter to these types on the hub view (excludes employment on PM Applications). */
  hubApplicationTypes?: readonly string[]
  /** Limit visible sections when used inside tabbed PM Applications page. */
  section?: "all" | "overview" | "submissions"
  hidePageHeader?: boolean
  pageTab?: PeopleManagementApplicationsPageTab
  onNavigateToSubmissions?: (options: {
    statusTab?: ApplicationStatusTabId
    applicationType?: string
  }) => void
  /** When set, application detail links pass bazaar event context for participation sync. */
  vendorHubEventId?: string
}

function buildPageUrl(
  basePath: string,
  options: {
    statusTab?: ApplicationStatusTabId
    applicationType?: string
    moduleOwner?: ModuleOwner
    embedded?: boolean
    embeddedSyncPath?: string
    embeddedTabQueryKey?: string
    pageTab?: PeopleManagementApplicationsPageTab
  }
) {
  if (
    (options.embedded && options.embeddedSyncPath) ||
    isHrCategoryApplicationsPath(basePath)
  ) {
    const path = options.embeddedSyncPath || basePath
    if (path === MEMBERSHIP_APPLICATIONS_PATH || path === HR_COMMITTEE_APPLICATIONS_PATH) {
      const params = new URLSearchParams()
      params.set(options.embeddedTabQueryKey ?? "tab", "applications")
      if (options.statusTab && options.statusTab !== "all") {
        params.set("status", options.statusTab)
      }
      return `${path}?${params.toString()}`
    }

    return hrCategoryApplicationsUrl({
      applicationType: options.applicationType ?? "employment",
      status: options.statusTab,
    })
  }

  if (
    basePath === "/people-management/applications" ||
    basePath === "/settings/applications"
  ) {
    return peopleManagementApplicationsUrl({
      pageTab: options.pageTab ?? "submissions",
      status: options.statusTab,
      applicationType: options.applicationType,
    })
  }

  if (
    basePath === VENDOR_HUB_APPLICATIONS_PATH ||
    basePath === PROGRAMS_FINANCIAL_ASSISTANCE_PATH
  ) {
    return applicationsPageUrl(basePath, {
      pageTab: options.pageTab ?? "submissions",
      status: options.statusTab,
      applicationType: options.applicationType,
    })
  }

  const params = new URLSearchParams()
  if (options.applicationType) params.set("application_type", options.applicationType)
  if (options.moduleOwner) params.set("module_owner", options.moduleOwner)
  if (options.statusTab && options.statusTab !== "all") {
    params.set("status", options.statusTab)
  }
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export function ApplicationsModulePage({
  moduleOwner,
  basePath = "/people-management/applications",
  title = "Applications",
  description = "Review and manage applications",
  hideModuleFilter = true,
  lockedApplicationType,
  embedded = false,
  embeddedSyncPath,
  embeddedTabQueryKey = "tab",
  hubApplicationTypes,
  section = "all",
  hidePageHeader = false,
  pageTab = "submissions",
  onNavigateToSubmissions,
  vendorHubEventId,
}: ApplicationsModulePageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const applicationDetailHref = useCallback(
    (applicationId: string) => {
      const params = new URLSearchParams()
      if (vendorHubEventId) {
        params.set("vendor_hub_event_id", vendorHubEventId)
      }
      const query = params.toString()
      return query ? `/applications/${applicationId}?${query}` : `/applications/${applicationId}`
    },
    [vendorHubEventId]
  )

  const applicationTypeFromUrl = lockedApplicationType
    ?? searchParams.get("application_type")
    ?? undefined
  const statusTabId = statusTabIdFromQueryParam(searchParams.get("status"))

  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [dashboardStats, setDashboardStats] = useState({
    total: 0,
    pendingReview: 0,
    approved: 0,
    rejected: 0,
    byType: {} as Record<string, number>,
  })
  const [typeRegistry, setTypeRegistry] = useState<Record<string, ApplicationTypeDefinition>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState(applicationTypeFromUrl ?? "all")

  const statusFilter = statusFilterValueForTab(statusTabId)

  const syncUrl = useCallback(
    (nextTab: ApplicationStatusTabId, nextType?: string) => {
      const href = buildPageUrl(basePath, {
        statusTab: nextTab,
        applicationType:
          lockedApplicationType ??
          (nextType && nextType !== "all"
            ? nextType
            : typeFilter !== "all"
              ? typeFilter
              : applicationTypeFromUrl),
        moduleOwner,
        embedded,
        embeddedSyncPath,
        embeddedTabQueryKey,
        pageTab,
      })
      router.replace(href, { scroll: false })
    },
    [
      applicationTypeFromUrl,
      basePath,
      embedded,
      embeddedSyncPath,
      embeddedTabQueryKey,
      lockedApplicationType,
      moduleOwner,
      pageTab,
      router,
      typeFilter,
    ]
  )

  const setActiveTab = useCallback(
    (tabId: ApplicationStatusTabId) => {
      if (section === "overview" && onNavigateToSubmissions) {
        onNavigateToSubmissions({ statusTab: tabId })
        return
      }
      syncUrl(tabId, typeFilter)
    },
    [onNavigateToSubmissions, section, syncUrl, typeFilter]
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const registry = await fetchApplicationTypeDefinitions()
      setTypeRegistry(registry)

      const resolvedApplicationType =
        lockedApplicationType ??
        (typeFilter !== "all" ? typeFilter : applicationTypeFromUrl || undefined)

      const hubTypes =
        hubApplicationTypes &&
        !lockedApplicationType &&
        !applicationTypeFromUrl &&
        typeFilter === "all"
          ? [...hubApplicationTypes]
          : undefined

      const listApplicationType = resolvedApplicationType ?? hubTypes

      const scopeFilters = {
        moduleOwner,
        applicationType: listApplicationType,
      }

      const needsList = section === "all" || section === "submissions"
      const needsStats = section === "all" || section === "overview"

      const statsPromise = needsStats
        ? fetchApplicationDashboardStats(scopeFilters)
        : Promise.resolve(null)
      const listPromise = needsList
        ? fetchApplicationsList({
            pageSize: 100,
            moduleOwner,
            applicationType: listApplicationType,
            status:
              statusFilter !== "all"
                ? (statusFilter.split(",") as ApplicationStatus[])
                : undefined,
            search: search.trim() || undefined,
          })
        : Promise.resolve(null)

      const [stats, listResult] = await Promise.all([statsPromise, listPromise])

      if (stats) {
        setDashboardStats({
          total: stats.total,
          pendingReview: stats.pendingReview,
          approved: stats.approved,
          rejected: stats.rejected,
          byType: stats.byType,
        })
      }

      if (listResult) {
        setApplications(listResult.applications)
      } else {
        setApplications([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load applications")
      setApplications([])
    } finally {
      setLoading(false)
    }
  }, [
    applicationTypeFromUrl,
    hubApplicationTypes,
    lockedApplicationType,
    moduleOwner,
    search,
    section,
    statusFilter,
    typeFilter,
  ])

  useEffect(() => {
    if (applicationTypeFromUrl) {
      setTypeFilter(applicationTypeFromUrl)
    }
  }, [applicationTypeFromUrl])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const typeOptions = useMemo(() => {
    const allowedIds = hubApplicationTypes
      ? applicationTypeFromUrl || lockedApplicationType
        ? null
        : new Set(hubApplicationTypes)
      : null

    return Object.values(typeRegistry)
      .filter((type) => type.moduleOwner === moduleOwner)
      .filter((type) => !allowedIds || allowedIds.has(type.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [applicationTypeFromUrl, hubApplicationTypes, lockedApplicationType, moduleOwner, typeRegistry])

  function handleStatusFilterChange(value: string) {
    const nextTab = tabIdFromStatusFilter(value)
    syncUrl(nextTab, typeFilter)
  }

  function handleTypeFilterChange(value: string) {
    setTypeFilter(value)
    syncUrl(statusTabId, value)
  }

  function handleCardClick(cardId: ApplicationDashboardCardId) {
    const nextTab = dashboardCardToTabId(cardId)
    if (section === "overview" && onNavigateToSubmissions) {
      onNavigateToSubmissions({ statusTab: nextTab })
      return
    }
    setActiveTab(nextTab)
  }

  function handleTypeCardClick(typeId: string) {
    if (section === "overview" && onNavigateToSubmissions) {
      onNavigateToSubmissions({ applicationType: typeId })
      return
    }
    setTypeFilter(typeId)
    syncUrl(statusTabId, typeId)
  }

  const showOverview = section === "all" || section === "overview"
  const showSubmissions = section === "all" || section === "submissions"

  const statCards: Array<{
    id: ApplicationDashboardCardId
    label: string
    value: number
    icon: typeof FileText
    iconClass?: string
  }> = [
    { id: "total", label: "Total Applications", value: dashboardStats.total, icon: FileText },
    {
      id: "pending_review",
      label: "Pending Review",
      value: dashboardStats.pendingReview,
      icon: Clock,
      iconClass: "text-amber-500",
    },
    {
      id: "approved",
      label: "Approved",
      value: dashboardStats.approved,
      icon: CheckCircle,
      iconClass: "text-green-500",
    },
    {
      id: "rejected",
      label: "Rejected",
      value: dashboardStats.rejected,
      icon: XCircle,
      iconClass: "text-red-500",
    },
  ]

  return (
    <div className={cn("flex flex-1 flex-col gap-5", embedded ? "" : section === "all" ? "p-6" : "")}>
      {!embedded && !hidePageHeader && (
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-sm text-red-700">
            <strong>Error:</strong> {error}
          </CardContent>
        </Card>
      )}

      {showOverview && (
        <>
          <div className="flex flex-wrap gap-4 [&>*]:w-fit">
            {statCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => handleCardClick(card.id)}
                className="text-left"
              >
                <Card
                  className={cn(
                    "transition-colors hover:border-primary/40 hover:bg-muted/30",
                    section !== "overview" &&
                      dashboardCardToTabId(card.id) === statusTabId &&
                      "border-primary ring-1 ring-primary/20"
                  )}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {card.label}
                    </CardTitle>
                    <card.icon className={cn("h-4 w-4 text-muted-foreground", card.iconClass)} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{card.value}</div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {APPLICATION_LIST_STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  section !== "overview" && statusTabId === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(section === "overview" || section === "all") && typeOptions.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {typeOptions.map((type) => {
                const TypeIcon = getTypeIcon(type.id)
                const count = dashboardStats.byType[type.id] ?? 0

                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleTypeCardClick(type.id)}
                    className="text-left"
                  >
                    <Card className="transition-colors hover:border-primary/40 hover:bg-muted/30">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">{type.label}</CardTitle>
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{count}</div>
                        <p className="text-xs text-muted-foreground">Total submissions</p>
                      </CardContent>
                    </Card>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {showSubmissions && (
        <>
          {section === "submissions" && (
            <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
              {APPLICATION_LIST_STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    statusTabId === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void loadData()
            }}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
            <SelectItem value={PENDING_STATUSES.join(",")}>Pending Review (group)</SelectItem>
          </SelectContent>
        </Select>

        {!lockedApplicationType && (
        <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
          <SelectTrigger className="w-full lg:w-[220px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {typeOptions.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        )}

        <Button variant="outline" onClick={() => void loadData()}>
          Apply
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
          <CardDescription>
            {APPLICATION_LIST_STATUS_TABS.find((tab) => tab.id === statusTabId)?.label ?? "All"}{" "}
            applications
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading applications...
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                applications.map((app) => {
                  const TypeIcon = getTypeIcon(app.application_type)
                  return (
                    <TableRow key={app.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {getTypeLabel(app.application_type, typeRegistry)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {app.contact_id ? (
                          <Link href={`/contacts/${app.contact_id}`} className="hover:underline">
                            {app.applicant_name}
                          </Link>
                        ) : (
                          app.applicant_name
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{app.applicant_email}</TableCell>
                      <TableCell>
                        {app.submitted_at
                          ? new Date(app.submitted_at).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <ApplicationStatusBadge status={app.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(applicationDetailHref(app.id))}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}

              {!loading && applications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No applications found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </>
      )}
    </div>
  )
}
