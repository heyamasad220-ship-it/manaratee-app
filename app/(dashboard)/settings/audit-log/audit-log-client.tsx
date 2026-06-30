"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Header } from "@/components/layout/header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, ScrollText, Search } from "lucide-react"
import { fetchOrganizationAuditLogsAction } from "@/lib/audit/organization-audit-actions"
import type {
  OrganizationAuditCategory,
  OrganizationAuditLogRow,
} from "@/lib/audit/organization-audit-log"

const CATEGORY_OPTIONS: Array<{ value: OrganizationAuditCategory | "all"; label: string }> = [
  { value: "all", label: "All categories" },
  { value: "financial", label: "Financial" },
  { value: "permission", label: "Permissions" },
]

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatAction(action: string) {
  return action
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" · ")
}

function categoryVariant(category: OrganizationAuditCategory): "default" | "secondary" {
  return category === "financial" ? "default" : "secondary"
}

export function AuditLogClient() {
  const [logs, setLogs] = useState<OrganizationAuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<OrganizationAuditCategory | "all">("all")
  const [search, setSearch] = useState("")

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    const result = await fetchOrganizationAuditLogsAction({
      category,
      search,
      limit: 200,
    })

    if (!result.success) {
      setError(result.error)
      setLogs([])
    } else {
      setLogs(result.logs)
    }

    setLoading(false)
  }, [category, search])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLogs()
    }, search ? 250 : 0)

    return () => window.clearTimeout(timer)
  }, [loadLogs, search])

  const emptyMessage = useMemo(() => {
    if (loading) return null
    if (search.trim()) return "No audit entries match your search."
    if (category !== "all") return `No ${category} audit entries yet.`
    return "No audit entries yet. Financial and permission changes will appear here."
  }, [category, loading, search])

  return (
    <>
      <Header title="Audit Log" />

      <div className="p-6">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <ScrollText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Organization activity</CardTitle>
                  <CardDescription>
                    Append-only history of donation ledger edits, refunds, pledge changes, role
                    updates, and permission toggles.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search summary, actor, or target..."
                  className="pl-9"
                />
              </div>
              <Select
                value={category}
                onValueChange={(value) =>
                  setCategory(value as OrganizationAuditCategory | "all")
                }
              >
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading audit log...
                </div>
              ) : logs.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">{emptyMessage}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">When</TableHead>
                      <TableHead className="w-[120px]">Category</TableHead>
                      <TableHead className="w-[160px]">Action</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead className="w-[180px]">Actor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatTimestamp(log.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={categoryVariant(log.category)}>
                            {log.category === "financial" ? "Financial" : "Permission"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm capitalize text-muted-foreground">
                          {formatAction(log.action)}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{log.summary}</div>
                          {log.target_label ? (
                            <div className="text-xs text-muted-foreground">{log.target_label}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{log.actor_display_name || "Unknown user"}</div>
                          {log.actor_email ? (
                            <div className="text-xs text-muted-foreground">{log.actor_email}</div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
