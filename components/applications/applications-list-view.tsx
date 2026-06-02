"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
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
  fetchApplicationsList,
  fetchApplicationTypeDefinitions,
} from "@/lib/applications/application-actions"
import {
  APPLICATION_STATUS_LABELS,
  getTypeIcon,
  getTypeLabel,
  MODULE_OWNER_LABELS,
  type ApplicationRecord,
  type ApplicationStatus,
  type ApplicationTypeDefinition,
  type ModuleOwner,
} from "@/lib/applications/application-types"
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge"

type ApplicationsListViewProps = {
  title?: string
  description?: string
  initialStatus?: ApplicationStatus | ApplicationStatus[]
  initialApplicationType?: string
  initialModuleOwner?: ModuleOwner
  hideStats?: boolean
  hideTypeFilter?: boolean
  hideModuleFilter?: boolean
  showHeader?: boolean
}

export function ApplicationsListView({
  title = "Applications",
  description = "Review and manage applications",
  initialStatus,
  initialApplicationType,
  initialModuleOwner,
  hideStats = false,
  hideTypeFilter = false,
  hideModuleFilter = false,
  showHeader = true,
}: ApplicationsListViewProps) {
  const router = useRouter()
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [typeRegistry, setTypeRegistry] = useState<Record<string, ApplicationTypeDefinition>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>(
    initialStatus
      ? Array.isArray(initialStatus)
        ? initialStatus.join(",")
        : initialStatus
      : "all"
  )
  const [typeFilter, setTypeFilter] = useState(initialApplicationType ?? "all")
  const [moduleFilter, setModuleFilter] = useState(initialModuleOwner ?? "all")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const registry = await fetchApplicationTypeDefinitions()
      setTypeRegistry(registry)

      const filters: Parameters<typeof fetchApplicationsList>[0] = {
        pageSize: 100,
      }

      if (typeFilter !== "all") filters.applicationType = typeFilter
      if (moduleFilter !== "all") filters.moduleOwner = moduleFilter as ModuleOwner
      if (statusFilter !== "all") {
        filters.status = statusFilter.includes(",")
          ? (statusFilter.split(",") as ApplicationStatus[])
          : (statusFilter as ApplicationStatus)
      }
      if (search.trim()) filters.search = search.trim()

      const result = await fetchApplicationsList(filters)
      setApplications(result.applications)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load applications")
      setApplications([])
    } finally {
      setLoading(false)
    }
  }, [moduleFilter, search, statusFilter, typeFilter])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const stats = useMemo(() => {
    return {
      total: applications.length,
      pendingReview: applications.filter(
        (app) => app.status === "submitted" || app.status === "pending_review"
      ).length,
      approved: applications.filter((app) => app.status === "approved").length,
      rejected: applications.filter((app) => app.status === "rejected").length,
    }
  }, [applications])

  const typeOptions = useMemo(
    () => Object.values(typeRegistry).sort((a, b) => a.sortOrder - b.sortOrder),
    [typeRegistry]
  )

  return (
    <div className="flex flex-1 flex-col gap-5 p-6">
      {showHeader && (
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

      {!hideStats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Applications
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Review
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingReview}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rejected}</div>
            </CardContent>
          </Card>
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

        <Select value={statusFilter} onValueChange={setStatusFilter}>
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
            <SelectItem value="submitted,pending_review">Pending Review (group)</SelectItem>
          </SelectContent>
        </Select>

        {!hideTypeFilter && (
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full lg:w-[200px]">
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

        {!hideModuleFilter && (
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue placeholder="Module" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              {Object.entries(MODULE_OWNER_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
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
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
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
                          <Link
                            href={`/contacts/${app.contact_id}`}
                            className="hover:underline"
                          >
                            {app.applicant_name}
                          </Link>
                        ) : (
                          app.applicant_name
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{app.applicant_email}</TableCell>
                      <TableCell>{MODULE_OWNER_LABELS[app.module_owner]}</TableCell>
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
                          onClick={() => router.push(`/applications/${app.id}`)}
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
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No applications found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
