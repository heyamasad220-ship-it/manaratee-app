"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  MoreHorizontal,
  Plus,
  Search,
  Users,
} from "lucide-react"
import type {
  ChildcareProviderRecord,
  ChildcareProviderStats,
} from "@/lib/hr/childcare-provider-actions"
import { fetchApplicationDashboardStats } from "@/lib/applications/application-actions"
import { HR_CHILDCARE_APPLICATIONS_PATH, CUSTOMER_CHILDCARE_APPLY_PATH } from "@/lib/applications/application-routes"
import {
  hrOverviewHref,
  parseHrDirectoryView,
} from "@/lib/hr/hr-overview-path"
import { HrCategoryApplicationsPanel } from "@/components/applications/hr-category-applications-panel"
import { HrDirectoryShell } from "@/components/workforce/hr-directory-shell"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 10

const STATUS_DOT_CLASS: Record<ChildcareProviderRecord["status"], string> = {
  Active: "bg-emerald-500",
  Inactive: "bg-muted-foreground",
}

interface HrChildcarePanelProps {
  providers: ChildcareProviderRecord[]
  stats: ChildcareProviderStats
}

function getInitials(name: string) {
  return (name?.trim() || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function csvEscape(value: string | number) {
  const text = String(value ?? "")
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function downloadProvidersCsv(rows: ChildcareProviderRecord[]) {
  const header = [
    "Name",
    "Email",
    "Phone",
    "Experience",
    "Age Groups",
    "Hours",
    "Events",
    "Status",
  ]
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.name,
        row.email,
        row.phone,
        row.experience,
        row.ageGroups,
        row.totalHours,
        row.eventsWorked,
        row.status,
      ]
        .map(csvEscape)
        .join(",")
    ),
  ]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `childcare-providers-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function HrChildcarePanel({ providers, stats }: HrChildcarePanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"Active" | "Inactive">("Active")
  const [directoryTab, setDirectoryTab] = useState<"providers" | "applications">(
    () => {
      const view = parseHrDirectoryView(searchParams, { legacyTabParam: true })
      if (view === "applications") return view
      return "providers"
    }
  )
  const [applicationsCount, setApplicationsCount] = useState(0)
  const [page, setPage] = useState(1)
  const [selectedProvider, setSelectedProvider] = useState<ChildcareProviderRecord | null>(
    null
  )

  useEffect(() => {
    void fetchApplicationDashboardStats({ applicationType: "childcare_provider" })
      .then((dashboardStats) => {
        setApplicationsCount(dashboardStats.pendingReview || dashboardStats.total)
      })
      .catch((error) => {
        console.error("Error loading childcare application stats:", error)
        setApplicationsCount(0)
      })
  }, [])

  useEffect(() => {
    const view = parseHrDirectoryView(searchParams, { legacyTabParam: true })
    if (view === "applications") {
      setDirectoryTab("applications")
    } else {
      setDirectoryTab("providers")
    }
  }, [searchParams])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, directoryTab])

  function setDirectoryTabAndUrl(tabId: "providers" | "applications") {
    setDirectoryTab(tabId)
    if (tabId === "applications") {
      router.replace(hrOverviewHref({ tab: "childcare", view: "applications" }), {
        scroll: false,
      })
      return
    }
    router.replace(hrOverviewHref({ tab: "childcare" }), { scroll: false })
  }

  const filtered = useMemo(() => {
    let result =
      statusFilter === "Inactive"
        ? providers.filter((provider) => provider.status === "Inactive")
        : providers.filter((provider) => provider.status !== "Inactive")

    const query = search.trim().toLowerCase()
    if (query) {
      result = result.filter(
        (provider) =>
          provider.name.toLowerCase().includes(query) ||
          provider.email.toLowerCase().includes(query) ||
          provider.phone.toLowerCase().includes(query)
      )
    }

    return result
  }, [providers, statusFilter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filtered.length)
  const pagedRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  return (
    <>
      <HrDirectoryShell
        title="Childcare Providers"
        description="Manage childcare providers linked to applications and contacts. Review applications to add providers to this directory."
        onExport={
          directoryTab === "applications" ? undefined : () => downloadProvidersCsv(filtered)
        }
        exportDisabled={filtered.length === 0}
        primaryAction={
          directoryTab === "applications" ? undefined : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    const url = `${window.location.origin}${CUSTOMER_CHILDCARE_APPLY_PATH}`
                    await navigator.clipboard.writeText(url)
                  } catch (error) {
                    console.error("Could not copy apply link:", error)
                  }
                }}
              >
                Copy apply link
              </Button>
              <Button type="button" onClick={() => setDirectoryTabAndUrl("applications")}>
                <Plus className="mr-2 h-4 w-4" />
                Review Applications
              </Button>
            </div>
          )
        }
        tabs={[
          { id: "providers", label: "Providers" },
          {
            id: "applications",
            label: "Applications",
            count: applicationsCount,
          },
        ]}
        activeTab={directoryTab}
        onTabChange={(tabId) => {
          if (tabId === "providers" || tabId === "applications") {
            setDirectoryTabAndUrl(tabId)
          }
        }}
        stats={
          directoryTab === "applications" ? undefined : (
            <StatCardsRow equal columns={4}>
              <StatCard
                layout="header"
                fill
                tone="blue"
                label="Total Providers"
                value={stats.totalProviders}
                icon={Users}
              />
              <StatCard
                layout="header"
                fill
                tone="emerald"
                label="Active Providers"
                value={stats.activeProviders}
                icon={CheckCircle2}
              />
              <StatCard
                layout="header"
                fill
                tone="violet"
                label="Total Hours"
                value={stats.totalHours.toLocaleString()}
                icon={Clock}
              />
              <StatCard
                layout="header"
                fill
                tone="amber"
                label="Events Worked"
                value={stats.totalEventsWorked}
                icon={Users}
              />
            </StatCardsRow>
          )
        }
        filters={
          directoryTab === "applications" ? undefined : (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name, email, or phone..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as "Active" | "Inactive")
                }
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )
        }
        footer={
          directoryTab === "applications" || filtered.length === 0 ? undefined : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {pageStart} to {pageEnd} of {filtered.length} providers
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )
        }
      >
        {directoryTab === "applications" ? (
          <Suspense
            fallback={
              <div className="h-64 animate-pulse rounded-lg bg-muted" />
            }
          >
            <HrCategoryApplicationsPanel
              applicationType="childcare_provider"
              syncPath={HR_CHILDCARE_APPLICATIONS_PATH}
              title="Childcare Applications"
              description="Review childcare provider application submissions."
            />
          </Suspense>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-card py-12 text-center text-sm text-muted-foreground">
            {providers.length === 0
              ? "No approved childcare providers yet. Review applications to add providers to this directory."
              : "No providers match your search or filters."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Age Groups</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRows.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{getInitials(provider.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setSelectedProvider(provider)}
                            className="font-medium text-left hover:text-primary hover:underline"
                          >
                            {provider.name}
                          </button>
                          <p className="truncate text-xs text-muted-foreground">
                            {provider.email || "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{provider.phone}</TableCell>
                    <TableCell>{provider.experience}</TableCell>
                    <TableCell>{provider.ageGroups}</TableCell>
                    <TableCell className="tabular-nums font-medium">
                      {provider.totalHours}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {provider.eventsWorked}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 text-sm">
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            STATUS_DOT_CLASS[provider.status]
                          )}
                        />
                        {provider.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedProvider(provider)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/applications/${provider.applicationId}`}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Application
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </HrDirectoryShell>

      <Dialog open={!!selectedProvider} onOpenChange={() => setSelectedProvider(null)}>
        <DialogContent className="max-w-2xl">
          {selectedProvider && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedProvider.name}
                  <Badge
                    variant={selectedProvider.status === "Active" ? "default" : "secondary"}
                    className={
                      selectedProvider.status === "Active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }
                  >
                    {selectedProvider.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {selectedProvider.experience} experience
                  {selectedProvider.certifications !== "—"
                    ? ` | ${selectedProvider.certifications}`
                    : ""}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="info" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="history">
                    History ({selectedProvider.history.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="mt-4">
                  <div className="flex flex-col gap-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Phone</span>
                        <span className="text-sm font-medium">{selectedProvider.phone}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Email</span>
                        <span className="text-sm font-medium">{selectedProvider.email}</span>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border border-border p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {selectedProvider.totalHours}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Hours</p>
                      </div>
                      <div className="rounded-lg border border-border p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {selectedProvider.eventsWorked}
                        </p>
                        <p className="text-xs text-muted-foreground">Events Worked</p>
                      </div>
                      <div className="rounded-lg border border-border p-4 text-center">
                        <p className="text-2xl font-bold text-primary">—</p>
                        <p className="text-xs text-muted-foreground">Positive Reviews</p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Age Groups</span>
                        <span className="text-sm font-medium">{selectedProvider.ageGroups}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Availability</span>
                        <span className="text-sm font-medium">
                          {selectedProvider.availability}
                        </span>
                      </div>
                    </div>

                    {selectedProvider.certifications !== "—" && (
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Certifications</span>
                        <div className="flex flex-wrap gap-2">
                          {selectedProvider.certifications.split(", ").map((cert) => (
                            <Badge key={cert} variant="secondary">
                              {cert}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedProvider.notes && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Notes</span>
                        <p className="text-sm">{selectedProvider.notes}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Event participation history will appear here once providers are assigned to
                    events.
                  </p>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedProvider(null)}>
                  Close
                </Button>
                <Button asChild>
                  <Link href={`/applications/${selectedProvider.applicationId}`}>
                    View Application
                  </Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
