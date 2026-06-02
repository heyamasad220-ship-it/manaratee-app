"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import {
  fetchApplicationsList,
  fetchApplicationTypeDefinitions,
} from "@/lib/applications/application-actions"
import {
  APPLICATION_STATUS_LABELS,
  getTypeLabel,
  MODULE_OWNER_LABELS,
  type ApplicationRecord,
  type ApplicationTypeDefinition,
  type ModuleOwner,
} from "@/lib/applications/application-types"
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge"

export function ApplicationsReportsClient() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [typeRegistry, setTypeRegistry] = useState<Record<string, ApplicationTypeDefinition>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applicationType, setApplicationType] = useState("all")
  const [moduleOwner, setModuleOwner] = useState("all")
  const [status, setStatus] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  async function loadReport() {
    setLoading(true)
    setError(null)
    try {
      const registry = await fetchApplicationTypeDefinitions()
      setTypeRegistry(registry)

      const result = await fetchApplicationsList({
        pageSize: 500,
        applicationType: applicationType === "all" ? undefined : applicationType,
        moduleOwner: moduleOwner === "all" ? undefined : (moduleOwner as ModuleOwner),
        status: status === "all" ? undefined : (status as ApplicationRecord["status"]),
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      setApplications(result.applications)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report")
      setApplications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const summary = useMemo(() => {
    const byType: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    for (const app of applications) {
      byType[app.application_type] = (byType[app.application_type] ?? 0) + 1
      byStatus[app.status] = (byStatus[app.status] ?? 0) + 1
    }
    return { byType, byStatus, total: applications.length }
  }, [applications])

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>
            Filter by application type, status, date range, and module owner
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Select value={applicationType} onValueChange={setApplicationType}>
            <SelectTrigger>
              <SelectValue placeholder="Application Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.values(typeRegistry).map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={moduleOwner} onValueChange={setModuleOwner}>
            <SelectTrigger>
              <SelectValue placeholder="Module Owner" />
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

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <Button onClick={() => void loadReport()}>Run Report</Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Generating report...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{summary.total}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {Object.entries(summary.byStatus).map(([value, count]) => (
                <div key={value} className="flex items-center justify-between">
                  <ApplicationStatusBadge status={value as ApplicationRecord["status"]} />
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By Type</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {Object.entries(summary.byType).map(([typeId, count]) => (
                <div key={typeId} className="flex items-center justify-between text-sm">
                  <span>{getTypeLabel(typeId, typeRegistry)}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
