"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  XCircle,
  ArrowRight,
} from "lucide-react"
import {
  fetchApplicationDashboardStats,
  fetchApplicationTypeDefinitions,
} from "@/lib/applications/application-actions"
import {
  moduleApplicationsUrl,
  peopleManagementApplicationsUrl,
} from "@/lib/applications/application-routes"
import {
  getTypeLabel,
  isWorkforceModuleOwner,
  MODULE_OWNER_LABELS,
  type ApplicationDashboardStats,
  type ApplicationTypeDefinition,
  type ModuleOwner,
} from "@/lib/applications/application-types"
import { WORKFORCE_MODULE_LABEL } from "@/lib/hr/hr-module-label"

function listUrlForScope(scope: {
  moduleOwner?: ModuleOwner
  applicationType?: string
  status?: "pending_review" | "approved" | "rejected"
}) {
  if (isWorkforceModuleOwner(scope.moduleOwner) || (!scope.moduleOwner && !scope.applicationType)) {
    return peopleManagementApplicationsUrl({
      status: scope.status,
      applicationType: scope.applicationType,
    })
  }

  return moduleApplicationsUrl({
    moduleOwner: scope.moduleOwner,
    applicationType: scope.applicationType,
    status: scope.status,
  })
}

export function ApplicationsOverviewClient() {
  const searchParams = useSearchParams()
  const moduleOwner = (searchParams.get("module_owner") as ModuleOwner | null) ?? undefined
  const applicationType = searchParams.get("application_type") ?? undefined

  const scope = useMemo(
    () => ({ moduleOwner, applicationType }),
    [moduleOwner, applicationType]
  )

  const [stats, setStats] = useState<ApplicationDashboardStats | null>(null)
  const [typeRegistry, setTypeRegistry] = useState<Record<string, ApplicationTypeDefinition>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [statsData, registry] = await Promise.all([
          fetchApplicationDashboardStats({
            moduleOwner: scope.moduleOwner,
            applicationType: scope.applicationType,
          }),
          fetchApplicationTypeDefinitions(),
        ])
        setStats(statsData)
        setTypeRegistry(registry)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard")
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [scope.applicationType, scope.moduleOwner])

  const scopeLabel = applicationType
    ? getTypeLabel(applicationType, typeRegistry)
    : moduleOwner
      ? `${MODULE_OWNER_LABELS[moduleOwner]} Applications`
      : "Applications"

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading applications dashboard...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-sm text-red-700">{error}</CardContent>
        </Card>
      </div>
    )
  }

  const statCards = [
    {
      label: "Total Applications",
      value: stats?.total ?? 0,
      icon: FileText,
      href: listUrlForScope(scope),
    },
    {
      label: "Pending Review",
      value: stats?.pendingReview ?? 0,
      icon: Clock,
      href: listUrlForScope({ ...scope, status: "pending_review" }),
    },
    {
      label: "Approved",
      value: stats?.approved ?? 0,
      icon: CheckCircle,
      href: listUrlForScope({ ...scope, status: "approved" }),
    },
    {
      label: "Rejected",
      value: stats?.rejected ?? 0,
      icon: XCircle,
      href: listUrlForScope({ ...scope, status: "rejected" }),
    },
  ]

  const showModuleShortcuts = !moduleOwner && !applicationType

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {!moduleOwner && !applicationType && (
        <p className="text-sm text-muted-foreground">
          Application management is organized under {WORKFORCE_MODULE_LABEL}, Vendor Hub,
          and Programs in the sidebar.
        </p>
      )}

      <div className="flex flex-wrap gap-4 [&>*]:w-fit">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <Button variant="link" className="mt-2 h-auto p-0" asChild>
                <Link href={card.href}>
                  View
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By Application Type</CardTitle>
            <CardDescription>{scopeLabel} volume by type</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Object.entries(stats?.byType ?? {}).length === 0 && (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            )}
            {Object.entries(stats?.byType ?? {}).map(([typeId, count]) => (
              <div key={typeId} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">{getTypeLabel(typeId, typeRegistry)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{count}</span>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={listUrlForScope({ ...scope, applicationType: typeId })}>Open</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {showModuleShortcuts && (
          <Card>
            <CardHeader>
              <CardTitle>Module Shortcuts</CardTitle>
              <CardDescription>Open applications from each owning module</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">
                  {WORKFORCE_MODULE_LABEL} Applications
                </span>
                <Button variant="outline" size="sm" asChild>
                  <Link href={peopleManagementApplicationsUrl()}>View</Link>
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">Vendor Applications</span>
                <Button variant="outline" size="sm" asChild>
                  <Link href={moduleApplicationsUrl({ applicationType: "vendor" })}>View</Link>
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">Financial Assistance</span>
                <Button variant="outline" size="sm" asChild>
                  <Link href={moduleApplicationsUrl({ applicationType: "financial_aid" })}>
                    View
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
