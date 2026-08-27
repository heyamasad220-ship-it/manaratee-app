"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Building2, Download, Home, Users } from "lucide-react"

import { ContactsFamiliesDirectoryPanel } from "@/components/contacts/contacts-families-directory-panel"
import {
  fetchContactDirectoryExportAction,
  fetchContactDirectoryPageAction,
  fetchContactDirectorySummaryAction,
} from "@/lib/contacts/contact-report-actions"
import type { ContactDirectoryReportFilters } from "@/lib/contacts/contact-report-types"
import { downloadContactDirectoryCsv } from "@/lib/contacts/contact-report-csv"
import {
  getRoleFilterOptionsForRecordType,
  type ContactRecordType,
  type ContactRoleValue,
} from "@/lib/contacts/contact-constants"
import type { ContactListRow } from "@/lib/contacts/contact-list-types"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { fetchFamilyListSummariesAction } from "@/lib/contacts/family-actions"
import { clearSelectedOrganizationIdCache } from "@/lib/current-organization"
import { Badge } from "@/components/ui/badge"
import { PhoneText } from "@/components/ui/phone-text"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { TableColumnHeaderFilter } from "@/components/ui/table-column-header-filter"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { ListPagination } from "@/components/ui/list-pagination"
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/ui/list-pagination"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type DirectoryTab = "individuals" | "organizations" | "families"

function parseDirectoryTab(value: string | null): DirectoryTab {
  if (value === "organizations" || value === "families") return value
  return "individuals"
}

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
  recordType: ContactRecordType
  role: ContactRoleValue | "all"
}) {
  const parts: string[] = []

  if (input.search.trim()) {
    parts.push(`Search: "${input.search.trim()}"`)
  }

  parts.push(
    `Record type: ${input.recordType === "individual" ? "Individuals" : "Organizations"}`
  )

  if (input.role !== "all") {
    parts.push(`Role: ${input.role}`)
  }

  return parts.join("; ")
}

function recordTypeForTab(tab: DirectoryTab): ContactRecordType | null {
  if (tab === "individuals") return "individual"
  if (tab === "organizations") return "organization"
  return null
}

export function ContactsDirectoryReportPanel() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = parseDirectoryTab(searchParams.get("tab"))

  const [contacts, setContacts] = useState<ContactListRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [role, setRole] = useState<ContactRoleValue | "all">("all")
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [error, setError] = useState("")
  const [familyCount, setFamilyCount] = useState(0)
  const [summary, setSummary] = useState({
    total: 0,
    people: 0,
    organizations: 0,
    groups: 0,
  })

  const lockedRecordType = recordTypeForTab(activeTab)

  const roleOptions = useMemo(
    () =>
      getRoleFilterOptionsForRecordType(lockedRecordType ?? "all"),
    [lockedRecordType]
  )

  const filters = useMemo<ContactDirectoryReportFilters>(
    () => ({
      search: debouncedSearch || undefined,
      recordType: lockedRecordType ?? "all",
      role,
      status: "all",
      teamId: "all",
    }),
    [debouncedSearch, lockedRecordType, role]
  )

  const filterSummary = useMemo(
    () =>
      lockedRecordType
        ? buildFilterSummary({
            search: debouncedSearch,
            recordType: lockedRecordType,
            role,
          })
        : "Families directory",
    [debouncedSearch, lockedRecordType, role]
  )

  function setActiveTab(tab: DirectoryTab) {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === "individuals") {
      params.delete("tab")
    } else {
      params.set("tab", tab)
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
    setSearch("")
    setDebouncedSearch("")
    setRole("all")
  }, [activeTab])

  useEffect(() => {
    if (role === "all") return
    if (!roleOptions.some((option) => option.value === role)) {
      setRole("all")
    }
  }, [role, roleOptions])

  const loadContacts = useCallback(async () => {
    if (!lockedRecordType) {
      setContacts([])
      setTotal(0)
      setLoading(false)
      return
    }

    clearSelectedOrganizationIdCache()
    setLoading(true)
    setError("")

    const result = await fetchContactDirectoryPageAction({
      filters,
      page,
      pageSize,
    })

    if (!result.success) {
      setError(result.error)
      setContacts([])
      setTotal(0)
    } else {
      setContacts(result.contacts)
      setTotal(result.total)
    }

    setLoading(false)
  }, [filters, page, pageSize, lockedRecordType])

  const loadSummary = useCallback(async () => {
    clearSelectedOrganizationIdCache()
    setSummaryLoading(true)

    const [summaryResult, familiesResult] = await Promise.all([
      fetchContactDirectorySummaryAction({}),
      fetchFamilyListSummariesAction(),
    ])

    if (!summaryResult.success) {
      setError((current) => current || summaryResult.error)
      setSummary({ total: 0, people: 0, organizations: 0, groups: 0 })
    } else {
      setSummary(summaryResult.summary)
    }

    if (familiesResult.success) {
      setFamilyCount(familiesResult.families.length)
    } else {
      setFamilyCount(0)
    }

    setSummaryLoading(false)
  }, [])

  useEffect(() => {
    void loadContacts()
  }, [loadContacts, pathname])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary, pathname])

  async function handleExportCsv() {
    if (!lockedRecordType) return

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

  const hasActiveFilters =
    Boolean(debouncedSearch.trim()) || role !== "all"

  function clearFilters() {
    setSearch("")
    setDebouncedSearch("")
    setRole("all")
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Browse individuals, organizations, and families. Export filtered contact
            rows as CSV.
          </p>
        </div>
        {activeTab !== "families" ? (
          <Button variant="outline" disabled={exportingCsv || loading} onClick={handleExportCsv}>
            <Download className="mr-2 h-4 w-4" />
            {exportingCsv ? "Exporting..." : "Export CSV"}
          </Button>
        ) : null}
      </div>

      {summaryLoading ? (
        <p className="text-sm text-muted-foreground">Loading summary...</p>
      ) : (
        <DonationMetricCardGrid columns={4} colorful className="w-full">
          <DonationMetricCard
            title="Total contacts"
            value={summary.total.toLocaleString()}
            icon={Users}
            accent="blue"
          />
          <DonationMetricCard
            title="Individuals"
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
            title="Families"
            value={familyCount.toLocaleString()}
            icon={Home}
            accent="amber"
          />
        </DonationMetricCardGrid>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(parseDirectoryTab(value))}
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="individuals">Individuals</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="families">Families</TabsTrigger>
        </TabsList>

        <TabsContent value="individuals" className="mt-0 space-y-4">
          <ContactDirectoryTable
            contacts={contacts}
            loading={loading}
            total={total}
            search={search}
            debouncedSearch={debouncedSearch}
            role={role}
            roleOptions={roleOptions}
            hasActiveFilters={hasActiveFilters}
            pathname={pathname}
            onSearchChange={setSearch}
            onSearchCommit={() => setDebouncedSearch(search.trim())}
            onRoleChange={setRole}
            onClearFilters={clearFilters}
          />
          <ListPagination
            page={page}
            pageSize={pageSize}
            total={total}
            disabled={loading}
            entryLabel="contacts"
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next)
              setPage(1)
            }}
          />
        </TabsContent>

        <TabsContent value="organizations" className="mt-0 space-y-4">
          <ContactDirectoryTable
            contacts={contacts}
            loading={loading}
            total={total}
            search={search}
            debouncedSearch={debouncedSearch}
            role={role}
            roleOptions={roleOptions}
            hasActiveFilters={hasActiveFilters}
            pathname={pathname}
            onSearchChange={setSearch}
            onSearchCommit={() => setDebouncedSearch(search.trim())}
            onRoleChange={setRole}
            onClearFilters={clearFilters}
          />
          <ListPagination
            page={page}
            pageSize={pageSize}
            total={total}
            disabled={loading}
            entryLabel="contacts"
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next)
              setPage(1)
            }}
          />
        </TabsContent>

        <TabsContent value="families" className="mt-0">
          <ContactsFamiliesDirectoryPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ContactDirectoryTable({
  contacts,
  loading,
  total,
  search,
  debouncedSearch,
  role,
  roleOptions,
  hasActiveFilters,
  pathname,
  onSearchChange,
  onSearchCommit,
  onRoleChange,
  onClearFilters,
}: {
  contacts: ContactListRow[]
  loading: boolean
  total: number
  search: string
  debouncedSearch: string
  role: ContactRoleValue | "all"
  roleOptions: { label: string; value: ContactRoleValue }[]
  hasActiveFilters: boolean
  pathname: string
  onSearchChange: (value: string) => void
  onSearchCommit: () => void
  onRoleChange: (value: ContactRoleValue | "all") => void
  onClearFilters: () => void
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Preview</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters ? (
              <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading..."
                : total === 0
                  ? "No contacts match"
                  : `${total.toLocaleString()} matching`}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <TableColumnHeaderFilter
                  label="Contact"
                  active={Boolean(debouncedSearch.trim())}
                >
                  {({ close }) => (
                    <Input
                      placeholder="Name, email, or phone"
                      value={search}
                      onChange={(event) => onSearchChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          onSearchCommit()
                          close()
                        }
                      }}
                    />
                  )}
                </TableColumnHeaderFilter>
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>
                <TableColumnHeaderFilter label="Roles" active={role !== "all"}>
                  {({ close }) => (
                    <Select
                      value={role}
                      onValueChange={(value) => {
                        onRoleChange(value as ContactRoleValue | "all")
                        close()
                      }}
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
                  )}
                </TableColumnHeaderFilter>
              </TableHead>
              <TableHead>Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Loading contacts...
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {hasActiveFilters ? (
                    <div className="flex flex-col items-center gap-2">
                      <span>No contacts match the current filters.</span>
                      <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
                        Clear filters
                      </Button>
                    </div>
                  ) : (
                    "No contacts yet."
                  )}
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
                  <TableCell><PhoneText value={contact.phone} /></TableCell>
                  <TableCell>
                    {contact.roles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {contact.roles.map((roleLabel) => (
                          <Badge key={roleLabel} variant="secondary" className="font-normal">
                            {roleLabel}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{formatDate(contact.lastActivity)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
