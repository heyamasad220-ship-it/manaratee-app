"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Clock,
  HeartHandshake,
  Loader2,
  Plus,
  Search,
  User,
  UserX,
} from "lucide-react"
import { createVolunteer } from "@/lib/volunteers/volunteer-actions"
import {
  fetchVolunteersList,
  type VolunteerListRow,
} from "@/lib/workforce/volunteer-queries"
import type { VolunteerStatus } from "@/lib/volunteers/volunteer-types"
import { formatStatusLabel } from "@/lib/volunteers/volunteer-utils"
import { fetchApplicationDashboardStats } from "@/lib/applications/application-actions"
import { HR_VOLUNTEER_APPLICATIONS_PATH } from "@/lib/applications/application-routes"
import { HrCategoryApplicationsPanel } from "@/components/applications/hr-category-applications-panel"
import { HrContactPicker } from "@/components/hr/hr-contact-picker"
import {
  HrDirectoryShell,
  formatEmploymentTenure,
  formatShortDate,
} from "@/components/workforce/hr-directory-shell"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 10

const STATUS_OPTIONS: { value: VolunteerStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "inactive", label: "Inactive" },
]

const STATUS_DOT_CLASS: Record<VolunteerStatus, string> = {
  active: "bg-emerald-500",
  pending: "bg-amber-500",
  inactive: "bg-muted-foreground",
}

function getInitials(name: string) {
  return (name?.trim() || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function percentOfTotal(count: number, total: number) {
  if (total <= 0) return "0% of total"
  const pct = (count / total) * 100
  const formatted = Number.isInteger(pct) ? String(pct) : pct.toFixed(1)
  return `${formatted}% of total`
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadVolunteersCsv(rows: VolunteerListRow[]) {
  const header = ["Name", "Email", "Phone", "Status", "Join Date", "Skills"]
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.name,
        row.email,
        row.phone,
        formatStatusLabel(row.status),
        row.joinDate || "",
        row.skills.join("; "),
      ]
        .map(csvEscape)
        .join(",")
    ),
  ]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `volunteers-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function VolunteersList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [rows, setRows] = useState<VolunteerListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<VolunteerStatus | "all">("all")
  const [directoryTab, setDirectoryTab] = useState<"volunteers" | "applications" | "archived">(
    () => (searchParams.get("tab") === "applications" ? "applications" : "volunteers")
  )
  const [applicationsCount, setApplicationsCount] = useState(0)
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [selectedContactLabel, setSelectedContactLabel] = useState("")
  const [form, setForm] = useState({
    status: "active" as VolunteerStatus,
    skills: "",
    notes: "",
  })

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "applications") {
      setDirectoryTab("applications")
    } else if (tab === "archived") {
      setDirectoryTab("archived")
    } else {
      setDirectoryTab("volunteers")
    }
  }, [searchParams])

  function setDirectoryTabAndUrl(tabId: "volunteers" | "applications" | "archived") {
    setDirectoryTab(tabId)
    if (tabId === "applications") {
      router.replace(`${HR_VOLUNTEER_APPLICATIONS_PATH}?tab=applications`, { scroll: false })
      return
    }
    if (tabId === "archived") {
      router.replace(`${HR_VOLUNTEER_APPLICATIONS_PATH}?tab=archived`, { scroll: false })
      return
    }
    router.replace(HR_VOLUNTEER_APPLICATIONS_PATH, { scroll: false })
  }

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchVolunteersList({
        search,
        status: "all",
        page: 1,
        pageSize: 1000,
      })
      setRows(result.rows)
    } catch (error) {
      console.error("Error loading volunteers:", error)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    void fetchApplicationDashboardStats({ applicationType: "volunteer" })
      .then((stats) => {
        setApplicationsCount(stats.pendingReview || stats.total)
      })
      .catch((error) => {
        console.error("Error loading volunteer application stats:", error)
        setApplicationsCount(0)
      })
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, directoryTab])

  const stats = useMemo(() => {
    const total = rows.length
    const active = rows.filter((row) => row.status === "active").length
    const pending = rows.filter((row) => row.status === "pending").length
    const inactive = rows.filter((row) => row.status === "inactive").length
    return { total, active, pending, inactive }
  }, [rows])

  const filteredRows = useMemo(() => {
    let result = rows

    if (directoryTab === "archived") {
      result = result.filter((row) => row.status === "inactive")
    } else if (statusFilter === "all") {
      result = result.filter((row) => row.status !== "inactive")
    } else {
      result = result.filter((row) => row.status === statusFilter)
    }

    return result
  }, [rows, directoryTab, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = filteredRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filteredRows.length)
  const pagedRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  async function handleAddVolunteer() {
    if (!selectedContactId) {
      alert("Select a contact first. Create them in Contacts if they are not listed.")
      return
    }

    setSaving(true)
    try {
      const { contactId } = await createVolunteer({
        contactId: selectedContactId,
        first_name: "",
        last_name: "",
        status: form.status,
        join_date: new Date().toISOString().slice(0, 10),
        skills: form.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        availability: [],
        notes: form.notes.trim() || undefined,
      })
      setAddOpen(false)
      setSelectedContactId(null)
      setSelectedContactLabel("")
      setForm({
        status: "active",
        skills: "",
        notes: "",
      })
      await loadRows()
      if (contactId) {
        router.push(`/contacts/${contactId}`)
      } else {
        router.refresh()
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not add volunteer"
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <HrDirectoryShell
        title="Volunteers"
        description="Volunteer roster with sign-ups, service history, and credentials. Volunteers are linked to their contact profiles."
        onExport={
          directoryTab === "applications"
            ? undefined
            : () => downloadVolunteersCsv(filteredRows)
        }
        exportDisabled={loading || filteredRows.length === 0}
        primaryAction={
          directoryTab === "applications" ? undefined : (
            <Button type="button" onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Volunteer
            </Button>
          )
        }
        tabs={[
          { id: "volunteers", label: "Volunteers" },
          {
            id: "applications",
            label: "Applications",
            count: applicationsCount,
          },
          { id: "archived", label: "Archived" },
        ]}
        activeTab={directoryTab}
        onTabChange={(tabId) => {
          if (tabId === "volunteers" || tabId === "applications" || tabId === "archived") {
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
                label="Total Volunteers"
                value={stats.total}
                icon={HeartHandshake}
                hint="All volunteers"
              />
              <StatCard
                layout="header"
                fill
                tone="emerald"
                label="Active"
                value={stats.active}
                icon={User}
                hint={percentOfTotal(stats.active, stats.total)}
              />
              <StatCard
                layout="header"
                fill
                tone="amber"
                label="Pending"
                value={stats.pending}
                icon={Clock}
                hint={percentOfTotal(stats.pending, stats.total)}
              />
              <StatCard
                layout="header"
                fill
                tone="slate"
                label="Inactive"
                value={stats.inactive}
                icon={UserX}
                hint={percentOfTotal(stats.inactive, stats.total)}
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
              {directoryTab === "volunteers" ? (
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as VolunteerStatus | "all")
                  }
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          )
        }
        footer={
          directoryTab === "applications" || filteredRows.length === 0 ? undefined : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {pageStart} to {pageEnd} of {filteredRows.length} volunteers
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
              applicationType="volunteer"
              syncPath={HR_VOLUNTEER_APPLICATIONS_PATH}
              title="Volunteer Applications"
              description="Review volunteer application submissions."
            />
          </Suspense>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading volunteers...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-lg border border-border bg-card py-12 text-center text-sm text-muted-foreground">
            No volunteers match these filters.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Volunteer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRows.map((row) => {
                  const tenure = formatEmploymentTenure(row.joinDate)
                  return (
                    <TableRow key={row.volunteerId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>{getInitials(row.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium">{row.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {row.email || row.phone || "—"}
                            </p>
                            {row.email && row.phone ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {row.phone}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2 text-sm">
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              STATUS_DOT_CLASS[row.status]
                            )}
                          />
                          {formatStatusLabel(row.status)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatShortDate(row.joinDate)}</div>
                        {tenure ? (
                          <div className="text-xs text-muted-foreground">{tenure}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {row.skills.length > 0
                          ? row.skills.slice(0, 3).join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.contactId ? (
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/contacts/${row.contactId}`}>Open profile</Link>
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </HrDirectoryShell>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) {
            setSelectedContactId(null)
            setSelectedContactLabel("")
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add volunteer</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Search for an existing contact. If they are not in Contacts yet, create them there
              first.
            </p>
          </DialogHeader>
          <div className="grid gap-4">
            <HrContactPicker
              selectedContactId={selectedContactId}
              selectedLabel={selectedContactLabel}
              onChange={(contact) => {
                setSelectedContactId(contact.contactId)
                const name = contact.full_name?.trim() || "Unnamed"
                const detail = contact.email || contact.phone
                setSelectedContactLabel(detail ? `${name} (${detail})` : name)
              }}
              onClear={() => {
                setSelectedContactId(null)
                setSelectedContactLabel("")
              }}
              disabled={saving}
            />
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((c) => ({ ...c, status: value as VolunteerStatus }))
                }
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vol-skills">Skills (comma-separated)</Label>
              <Input
                id="vol-skills"
                value={form.skills}
                onChange={(e) => setForm((c) => ({ ...c, skills: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vol-notes">Notes</Label>
              <Textarea
                id="vol-notes"
                value={form.notes}
                onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
                rows={2}
                disabled={saving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAddVolunteer} disabled={saving || !selectedContactId}>
              {saving ? "Saving..." : "Add volunteer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
