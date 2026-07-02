"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, Download, Users, UsersRound } from "lucide-react"

import {
  fetchContactDirectoryExportAction,
  fetchContactDirectoryPageAction,
  fetchContactDirectorySummaryAction,
  fetchContactReportTeamOptionsAction,
} from "@/lib/contacts/contact-report-actions"
import type { ContactDirectoryReportFilters } from "@/lib/contacts/contact-report-types"
import { downloadContactDirectoryCsv } from "@/lib/contacts/contact-report-csv"
import {
  getContactRecordTypeLabel,
  getRoleFilterOptionsForRecordType,
  STATUS_COLORS,
  STATUS_OPTIONS,
  type ContactRecordType,
  type ContactRoleValue,
  type ContactStatus,
} from "@/lib/contacts/contact-constants"
import type { ContactListRow } from "@/lib/contacts/contact-list-actions"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { clearSelectedOrganizationIdCache } from "@/lib/current-organization"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

const PREVIEW_PAGE_SIZE = 50

const RECORD_TYPE_OPTIONS: { label: string; value: ContactRecordType | "all" }[] = [
  { label: "All types", value: "all" },
  { label: "People", value: "individual" },
  { label: "Organizations", value: "organization" },
  { label: "Groups", value: "group" },
]

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function buildFilterSummary(input: {
  search: string
  recordType: ContactRecordType | "all"
  role: ContactRoleValue | "all"
  status: ContactStatus | "all"
  teamName?: string
}) {
  const parts: string[] = []

  if (input.search.trim()) {
    parts.push(`Search: "${input.search.trim()}"`)
  }

  if (input.recordType !== "all") {
    parts.push(`Record type: ${getContactRecordTypeLabel(input.recordType)}`)
  }

  if (input.role !== "all") {
    parts.push(`Role: ${input.role}`)
  }

  if (input.status !== "all") {
    parts.push(`Status: ${input.status}`)
  }

  if (input.teamName) {
    parts.push(`Team: ${input.teamName}`)
  }

  return parts.length > 0 ? parts.join("; ") : "None"
}

export function ContactsDirectoryReportPanel() {
  const pathname = usePathname()
  const [contacts, setContacts] = useState<ContactListRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [recordType, setRecordType] = useState<ContactRecordType | "all">("all")
  const [role, setRole] = useState<ContactRoleValue | "all">("all")
  const [status, setStatus] = useState<ContactStatus | "all">("all")
  const [teamId, setTeamId] = useState<string>("all")
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [error, setError] = useState("")
  const [summary, setSummary] = useState({
    total: 0,
    people: 0,
    organizations: 0,
    groups: 0,
  })

  const roleOptions = useMemo(
    () => getRoleFilterOptionsForRecordType(recordType),
    [recordType]
  )

  const filters = useMemo<ContactDirectoryReportFilters>(
    () => ({
      search: debouncedSearch || undefined,
      recordType,
      role,
      status,
      teamId,
    }),
    [debouncedSearch, recordType, role, status, teamId]
  )

  const selectedTeamName = useMemo(() => {
    if (teamId === "all") return undefined
    return teams.find((team) => team.id === teamId)?.name
  }, [teamId, teams])

  const filterSummary = useMemo(
    () =>
      buildFilterSummary({
        search: debouncedSearch,
        recordType,
        role,
        status,
        teamName: selectedTeamName,
      }),
    [debouncedSearch, recordType, role, status, selectedTeamName]
  )

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, recordType, role, status, teamId])

  useEffect(() => {
    if (role === "all") return
    if (!roleOptions.some((option) => option.value === role)) {
      setRole("all")
    }
  }, [role, roleOptions])

  useEffect(() => {
    void fetchContactReportTeamOptionsAction().then((result) => {
      if (result.success) {
        setTeams(result.teams)
      }
    })
  }, [pathname])

  const loadContacts = useCallback(async () => {
    clearSelectedOrganizationIdCache()
    setLoading(true)
    setError("")

    const result = await fetchContactDirectoryPageAction({ filters, page })

    if (!result.success) {
      setError(result.error)
      setContacts([])
      setTotal(0)
    } else {
      setContacts(result.contacts)
      setTotal(result.total)
    }

    setLoading(false)
  }, [filters, page])

  const loadSummary = useCallback(async () => {
    clearSelectedOrganizationIdCache()
    setSummaryLoading(true)

    const result = await fetchContactDirectorySummaryAction(filters)

    if (!result.success) {
      setError((current) => current || result.error)
      setSummary({ total: 0, people: 0, organizations: 0, groups: 0 })
    } else {
      setSummary(result.summary)
    }

    setSummaryLoading(false)
  }, [filters])

  useEffect(() => {
    void loadContacts()
  }, [loadContacts, pathname])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary, pathname])

  async function handleExportCsv() {
    setExportingCsv(true)

    const result = await fetchContactDirectoryExportAction(filters)

    setExportingCsv(false)

    if (!result.success) {
      alert(result.error || "Export failed")
      return
    }

    if (result.contacts.length === 0) {
      alert("No contacts match the current filters.")
      return
    }

    downloadContactDirectoryCsv(result.contacts, result.generatedAt, filterSummary)
  }

  const totalPages = Math.max(1, Math.ceil(total / PREVIEW_PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : (page - 1) * PREVIEW_PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PREVIEW_PAGE_SIZE, total)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Filter your contact directory and export the full result set as CSV. Preview shows up to{" "}
            {PREVIEW_PAGE_SIZE} rows per page.
          </p>
        </div>
        <Button variant="outline" disabled={exportingCsv || loading} onClick={handleExportCsv}>
          <Download className="mr-2 h-4 w-4" />
          {exportingCsv ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            Same filters that were removed from list pages — use reports for filtered exports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="contact-report-search">Search</Label>
              <Input
                id="contact-report-search"
                placeholder="Name, email, or phone"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Record type</Label>
              <Select
                value={recordType}
                onValueChange={(value) => setRecordType(value as ContactRecordType | "all")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORD_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as ContactRoleValue | "all")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as ContactStatus | "all")}
              >
                <SelectTrigger>
                  <SelectValue />
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
            </div>
            <div className="space-y-2 md:col-span-2 xl:col-span-1">
              <Label>Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="All teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {summaryLoading ? (
        <p className="text-sm text-muted-foreground">Loading summary...</p>
      ) : (
        <DonationMetricCardGrid columns={4}>
          <DonationMetricCard
            title="Total contacts"
            value={summary.total.toLocaleString()}
            icon={Users}
            accent="blue"
          />
          <DonationMetricCard
            title="People"
            value={summary.people.toLocaleString()}
            icon={Users}
            accent="emerald"
          />
          <DonationMetricCard
            title="Organizations"
            value={summary.organizations.toLocaleString()}
            icon={Building2}
            accent="purple"
          />
          <DonationMetricCard
            title="Groups"
            value={summary.groups.toLocaleString()}
            icon={UsersRound}
            accent="amber"
          />
        </DonationMetricCardGrid>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Preview</CardTitle>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading..."
                : total === 0
                  ? "No contacts match"
                  : `Showing ${rangeStart}–${rangeEnd} of ${total.toLocaleString()}`}
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Teams</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Loading contacts...
                  </TableCell>
                </TableRow>
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No contacts match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <Link
                        href={contactProfileHref(contact.id, { returnTo: pathname })}
                        className="font-medium text-primary hover:underline"
                      >
                        {contact.name}
                      </Link>
                      {contact.primaryContactName ? (
                        <p className="text-xs text-muted-foreground">
                          {contact.primaryContactName}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>{contact.email || "—"}</TableCell>
                    <TableCell>{contact.phone || "—"}</TableCell>
                    <TableCell>{getContactRecordTypeLabel(contact.recordType)}</TableCell>
                    <TableCell>
                      {contact.roles.length > 0 ? contact.roles.join(", ") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[contact.status]}>
                        {contact.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {contact.teams.length > 0
                        ? contact.teams.map((team) => team.name).join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell>{formatDate(contact.lastActivity)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  setPage((current) => Math.max(1, current - 1))
                }}
                className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                Page {page} of {totalPages}
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  setPage((current) => Math.min(totalPages, current + 1))
                }}
                className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  )
}
