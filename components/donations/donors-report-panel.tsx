"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

import {
  fetchDonorGivingReportExportContextAction,
  fetchDonorSummaryExportAction,
  fetchDonorSummaryPageAction,
  fetchDonorSummaryReportSummaryAction,
  fetchGroupGivingReportPageAction,
  fetchHouseholdGivingReportPageAction,
  type DonorReportLastGiftFilter,
  type DonorSummaryReportRow,
  type GroupGivingReportRow,
  type HouseholdGivingReportRow,
} from "@/lib/donations/donation-list-actions"
import { downloadDonorGivingReportCsv } from "@/lib/donations/donor-report-csv"
import { downloadDonorGivingReportPdf } from "@/lib/donations/donor-report-pdf"
import {
  formatDonorReportPeriodLabel,
  resolveDonorReportDateRange,
  type DonorDateRangeMode,
  type DonorReportSortBy,
} from "@/lib/donations/donor-giving-report"
import { getDonorProfilePath } from "@/lib/donations/donor-profile-path"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { donationGroupHref } from "@/lib/donations/donation-group-path"
import { createGivingGroupAction } from "@/lib/donations/giving-group-actions"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination"
import { ListPagination } from "@/components/ui/list-pagination"
import { PhoneText } from "@/components/ui/phone-text"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { TableColumnHeaderFilter } from "@/components/ui/table-column-header-filter"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  DollarSign,
  FileText,
  Gift,
  Home,
  Plus,
  Users,
  UsersRound,
} from "lucide-react"

const TAX_YEAR_OPTIONS = [0, 1, 2, 3, 4].map((offset) => new Date().getFullYear() - offset)

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatContactField(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed || "—"
}

const INDIVIDUAL_TABLE_COLSPAN = 6
const HOUSEHOLD_TABLE_COLSPAN = 8
const GROUP_TABLE_COLSPAN = 8

type DonorsReportView = "individual" | "household" | "group"

function tableColSpan(view: DonorsReportView) {
  if (view === "household") return HOUSEHOLD_TABLE_COLSPAN
  if (view === "group") return GROUP_TABLE_COLSPAN
  return INDIVIDUAL_TABLE_COLSPAN
}

function SortableReportHeader({
  label,
  column,
  sortBy,
  sortAsc,
  onToggle,
}: {
  label: string
  column: DonorReportSortBy
  sortBy: DonorReportSortBy
  sortAsc: boolean
  onToggle: (column: DonorReportSortBy) => void
}) {
  const active = sortBy === column
  const Icon = !active ? ArrowUpDown : sortAsc ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
    >
      {label}
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  )
}

const LAST_GIFT_FILTER_OPTIONS: { value: DonorReportLastGiftFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active_12m", label: "Gift within last 12 months" },
  { value: "lapsed_12m", label: "No gift in 12+ months" },
  { value: "lapsed_24m", label: "No gift in 24+ months" },
  { value: "never", label: "Never gave" },
]

function formatLastGiftFilterLabel(filter: DonorReportLastGiftFilter) {
  return LAST_GIFT_FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? filter
}

function buildFilterSummary(input: {
  donorName?: string
  email?: string
  phone?: string
  lastGiftFilter?: DonorReportLastGiftFilter
  search?: string
  minTotalGiven?: number
}) {
  const parts: string[] = []

  if (input.search?.trim()) {
    parts.push(`Search: "${input.search.trim()}"`)
  }

  if (input.donorName?.trim()) {
    parts.push(`Donor: "${input.donorName.trim()}"`)
  }

  if (input.email?.trim()) {
    parts.push(`Email: "${input.email.trim()}"`)
  }

  if (input.phone?.trim()) {
    parts.push(`Phone: "${input.phone.trim()}"`)
  }

  if (input.minTotalGiven != null && input.minTotalGiven > 0) {
    parts.push(`Min total given: $${input.minTotalGiven.toLocaleString()}`)
  }

  if (input.lastGiftFilter && input.lastGiftFilter !== "all") {
    parts.push(`Last gift: ${formatLastGiftFilterLabel(input.lastGiftFilter)}`)
  }

  return parts.length > 0 ? parts.join("; ") : "None"
}

function replaceQueryWithoutRefresh(pathname: string, params: URLSearchParams) {
  const query = params.toString()
  const nextUrl = query ? `${pathname}?${query}` : pathname
  const current =
    typeof window === "undefined"
      ? nextUrl
      : `${window.location.pathname}${window.location.search}`
  if (current === nextUrl) return
  window.history.replaceState(window.history.state, "", nextUrl)
}

export function DonorsReportPanel() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialView = searchParams.get("view")
  const [reportView, setReportView] = useState<DonorsReportView>(
    initialView === "group" || initialView === "household" || initialView === "individual"
      ? initialView
      : "individual"
  )
  const [donors, setDonors] = useState<DonorSummaryReportRow[]>([])
  const [households, setHouseholds] = useState<HouseholdGivingReportRow[]>([])
  const [groups, setGroups] = useState<GroupGivingReportRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DONATIONS_PAGE_SIZE)
  const [rollupSearch, setRollupSearch] = useState("")
  const [debouncedRollupSearch, setDebouncedRollupSearch] = useState("")
  const [donorNameFilter, setDonorNameFilter] = useState("")
  const [donorNameFilterInput, setDonorNameFilterInput] = useState("")
  const [emailFilter, setEmailFilter] = useState("")
  const [emailFilterInput, setEmailFilterInput] = useState("")
  const [phoneFilter, setPhoneFilter] = useState("")
  const [phoneFilterInput, setPhoneFilterInput] = useState("")
  const [minTotalGivenFilterInput, setMinTotalGivenFilterInput] = useState("")
  const [debouncedMinTotalGiven, setDebouncedMinTotalGiven] = useState<number | undefined>(
    undefined
  )
  const [lastGiftFilter, setLastGiftFilter] = useState<DonorReportLastGiftFilter>("all")
  const [dateRangeMode, setDateRangeMode] = useState<DonorDateRangeMode>("lifetime")
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()))
  const [customDateFrom, setCustomDateFrom] = useState("")
  const [customDateTo, setCustomDateTo] = useState("")
  const [sortBy, setSortBy] = useState<DonorReportSortBy>("total_donations")
  const [sortAsc, setSortAsc] = useState(false)
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [error, setError] = useState("")
  const [summary, setSummary] = useState({
    donorCount: 0,
    totalGiven: 0,
    giftCount: 0,
  })
  const [addGroupOpen, setAddGroupOpen] = useState(false)
  const [addGroupName, setAddGroupName] = useState("")
  const [addGroupSaving, setAddGroupSaving] = useState(false)
  const [addGroupError, setAddGroupError] = useState("")

  useEffect(() => {
    const view = searchParams.get("view")
    if (view === "group" || view === "household" || view === "individual") {
      setReportView(view)
    }
    if (view === "group" && searchParams.get("add") === "1") {
      setAddGroupOpen(true)
    }
  }, [searchParams])

  function setReportViewAndUrl(view: DonorsReportView) {
    setReportView(view)
    setPage(1)
    setLoading(true)
    setError("")
    setDonors([])
    setHouseholds([])
    setGroups([])
    setTotal(0)
    setSummary({ donorCount: 0, totalGiven: 0, giftCount: 0 })
    const params = new URLSearchParams(searchParams.toString())
    if (view === "individual") {
      params.delete("view")
    } else {
      params.set("view", view)
    }
    replaceQueryWithoutRefresh(pathname, params)
  }

  function toggleReportSort(column: DonorReportSortBy) {
    setPage(1)
    if (sortBy === column) {
      setSortAsc((current) => !current)
      return
    }
    setSortBy(column)
    setSortAsc(column === "full_name")
  }

  async function handleCreateGroup() {
    const name = addGroupName.trim()
    if (!name) {
      setAddGroupError("Group name is required.")
      return
    }
    setAddGroupSaving(true)
    setAddGroupError("")
    const result = await createGivingGroupAction({ fullName: name })
    setAddGroupSaving(false)
    if (!result.success) {
      setAddGroupError(result.error)
      return
    }
    setAddGroupOpen(false)
    setAddGroupName("")
    router.push(donationGroupHref(result.groupContactId))
  }

  const dateRange = useMemo(
    () =>
      resolveDonorReportDateRange({
        dateRangeMode,
        taxYear: Number(taxYear),
        dateFrom: customDateFrom || undefined,
        dateTo: customDateTo || undefined,
      }),
    [dateRangeMode, taxYear, customDateFrom, customDateTo]
  )

  const periodLabel = useMemo(
    () =>
      formatDonorReportPeriodLabel({
        dateRangeMode,
        taxYear: Number(taxYear),
        dateFrom: customDateFrom || undefined,
        dateTo: customDateTo || undefined,
      }),
    [dateRangeMode, taxYear, customDateFrom, customDateTo]
  )

  const filterInput = useMemo(
    () => ({
      search: reportView === "household" ? debouncedRollupSearch || undefined : undefined,
      donorName: reportView === "individual" ? donorNameFilter || undefined : undefined,
      email: reportView === "individual" ? emailFilter || undefined : undefined,
      phone: reportView === "individual" ? phoneFilter || undefined : undefined,
      lastGiftFilter: lastGiftFilter !== "all" ? lastGiftFilter : undefined,
      minTotalGiven: debouncedMinTotalGiven,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
    }),
    [
      reportView,
      debouncedRollupSearch,
      donorNameFilter,
      emailFilter,
      phoneFilter,
      lastGiftFilter,
      debouncedMinTotalGiven,
      dateRange,
    ]
  )

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedRollupSearch(rollupSearch), 300)
    return () => clearTimeout(timer)
  }, [rollupSearch])

  useEffect(() => {
    const timer = setTimeout(() => setDonorNameFilter(donorNameFilterInput), 300)
    return () => clearTimeout(timer)
  }, [donorNameFilterInput])

  useEffect(() => {
    const timer = setTimeout(() => setEmailFilter(emailFilterInput), 300)
    return () => clearTimeout(timer)
  }, [emailFilterInput])

  useEffect(() => {
    const timer = setTimeout(() => setPhoneFilter(phoneFilterInput), 300)
    return () => clearTimeout(timer)
  }, [phoneFilterInput])

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = minTotalGivenFilterInput.trim()
      if (!trimmed) {
        setDebouncedMinTotalGiven(undefined)
        return
      }
      const parsed = Number(trimmed)
      setDebouncedMinTotalGiven(
        Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [minTotalGivenFilterInput])

  useEffect(() => {
    setPage(1)
  }, [
    debouncedRollupSearch,
    donorNameFilter,
    emailFilter,
    phoneFilter,
    lastGiftFilter,
    debouncedMinTotalGiven,
    dateRangeMode,
    taxYear,
    customDateFrom,
    customDateTo,
    reportView,
  ])

  const loadDonors = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      if (reportView === "household") {
        const result = await fetchHouseholdGivingReportPageAction({
          page,
          pageSize,
          search: filterInput.search,
          dateFrom: filterInput.dateFrom,
          dateTo: filterInput.dateTo,
          sortBy,
          sortAsc,
        })

        if (!result.success) {
          setError(result.error)
          setHouseholds([])
          setGroups([])
          setTotal(0)
          setSummary({ donorCount: 0, totalGiven: 0, giftCount: 0 })
        } else {
          setHouseholds(result.households)
          setGroups([])
          setDonors([])
          setTotal(result.total)
          setSummary({
            donorCount: result.total,
            totalGiven: result.households.reduce(
              (sum, row) => sum + Number(row.total_donations || 0),
              0
            ),
            giftCount: result.households.reduce(
              (sum, row) => sum + Number(row.donation_count || 0),
              0
            ),
          })
        }
        return
      }

      if (reportView === "group") {
        const result = await fetchGroupGivingReportPageAction({
          page,
          pageSize,
          search: filterInput.search,
          dateFrom: filterInput.dateFrom,
          dateTo: filterInput.dateTo,
          sortBy,
          sortAsc,
        })

        if (!result.success) {
          setError(result.error)
          setGroups([])
          setHouseholds([])
          setTotal(0)
          setSummary({ donorCount: 0, totalGiven: 0, giftCount: 0 })
        } else {
          setGroups(result.groups)
          setHouseholds([])
          setDonors([])
          setTotal(result.total)
          setSummary({
            donorCount: result.total,
            totalGiven: result.groups.reduce(
              (sum, row) => sum + Number(row.total_donations || 0),
              0
            ),
            giftCount: result.groups.reduce(
              (sum, row) => sum + Number(row.donation_count || 0),
              0
            ),
          })
        }
        return
      }

      const result = await fetchDonorSummaryPageAction({
        page,
        pageSize,
        ...filterInput,
        sortBy,
        sortAsc,
      })

      if (!result.success) {
        setError(result.error)
        setDonors([])
        setHouseholds([])
        setGroups([])
        setTotal(0)
      } else {
        setDonors(result.donors)
        setHouseholds([])
        setGroups([])
        setTotal(result.total)
      }
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load report."
      if (!/abort/i.test(message)) {
        setError(message)
      }
    } finally {
      setSummaryLoading(false)
      setLoading(false)
    }
  }, [page, pageSize, filterInput, sortBy, sortAsc, reportView])

  const loadSummary = useCallback(async () => {
    if (reportView === "household" || reportView === "group") {
      setSummaryLoading(false)
      return
    }

    setSummaryLoading(true)

    try {
      const result = await fetchDonorSummaryReportSummaryAction(filterInput)

      if (!result.success) {
        setError((current) => current || result.error)
        setSummary({ donorCount: 0, totalGiven: 0, giftCount: 0 })
      } else {
        setSummary(result.summary)
      }
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load summary."
      if (!/abort/i.test(message)) {
        setError((current) => current || message)
      }
    } finally {
      setSummaryLoading(false)
    }
  }, [filterInput, reportView])

  useEffect(() => {
    void loadDonors()
  }, [loadDonors, pathname])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary, pathname])

  async function handleExportCsv() {
    if (reportView === "household" || reportView === "group") {
      alert(
        reportView === "group"
          ? "CSV export for group giving is not available yet."
          : "CSV export for household giving is not available yet."
      )
      return
    }

    setExportingCsv(true)

    const result = await fetchDonorSummaryExportAction({
      ...filterInput,
      sortBy,
      sortAsc,
    })

    setExportingCsv(false)

    if (!result.success) {
      alert(result.error || "Export failed")
      return
    }

    if (result.donors.length === 0) {
      alert("No donors match the current filters.")
      return
    }

    downloadDonorGivingReportCsv(result.donors, result.generatedAt, periodLabel)
  }

  async function handleExportPdf() {
    if (reportView === "household" || reportView === "group") {
      alert(
        reportView === "group"
          ? "PDF export for group giving is not available yet."
          : "PDF export for household giving is not available yet."
      )
      return
    }

    setExportingPdf(true)

    const [exportResult, contextResult] = await Promise.all([
      fetchDonorSummaryExportAction({
        ...filterInput,
        sortBy,
        sortAsc,
      }),
      fetchDonorGivingReportExportContextAction(),
    ])

    setExportingPdf(false)

    if (!exportResult.success) {
      alert(exportResult.error || "Export failed")
      return
    }

    if (!contextResult.success) {
      alert(contextResult.error || "Could not load organization details for PDF")
      return
    }

    if (exportResult.donors.length === 0) {
      alert("No donors match the current filters.")
      return
    }

    await downloadDonorGivingReportPdf({
      organizationName: contextResult.context.organizationName,
      organizationAddress: contextResult.context.organizationAddress,
      taxId: contextResult.context.taxId,
      periodLabel,
      generatedAt: exportResult.generatedAt,
      filterSummary: buildFilterSummary({
        lastGiftFilter,
        donorName: donorNameFilter,
        email: emailFilter,
        phone: phoneFilter,
        minTotalGiven: debouncedMinTotalGiven,
      }),
      summary: exportResult.summary,
      donors: exportResult.donors,
    })
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)
  const lastGiftHeader =
    dateRangeMode === "lifetime" ? "Last Gift" : "Last Gift (in period)"
  const exporting = exportingCsv || exportingPdf

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Donor Giving</h2>
          {reportView === "group" ? null : (
            <p className="text-sm text-muted-foreground">
              Individual, household, and CRM group giving. Household and group totals are aggregations,
              not extra transactions. {periodLabel}.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={reportView === "individual" ? "default" : "outline"}
            onClick={() => setReportViewAndUrl("individual")}
          >
            <Users className="mr-2 h-4 w-4" />
            Individual Giving
          </Button>
          <Button
            variant={reportView === "household" ? "default" : "outline"}
            onClick={() => setReportViewAndUrl("household")}
          >
            <Home className="mr-2 h-4 w-4" />
            Household Giving
          </Button>
          <Button
            variant={reportView === "group" ? "default" : "outline"}
            onClick={() => setReportViewAndUrl("group")}
          >
            <UsersRound className="mr-2 h-4 w-4" />
            Group Giving
          </Button>
          <Button variant="outline" disabled={exporting || loading} onClick={handleExportCsv}>
            <Download className="mr-2 h-4 w-4" />
            {exportingCsv ? "Exporting..." : "Export CSV"}
          </Button>
          <Button variant="outline" disabled={exporting || loading} onClick={handleExportPdf}>
            <FileText className="mr-2 h-4 w-4" />
            {exportingPdf ? "Exporting..." : "Export PDF"}
          </Button>
        </div>
      </div>

      {summaryLoading ? (
        <p className="text-sm text-muted-foreground">Loading summary...</p>
      ) : (
        <DonationMetricCardGrid colorful columns={3}>
          <DonationMetricCard
            title={
              reportView === "household"
                ? "Households"
                : reportView === "group"
                  ? "Groups"
                  : "Donors"
            }
            value={summary.donorCount}
            icon={
              reportView === "household" ? Home : reportView === "group" ? UsersRound : Users
            }
            accent="blue"
          />
          <DonationMetricCard
            title="Total Given"
            value={formatDonationCurrency(summary.totalGiven)}
            icon={DollarSign}
            accent="emerald"
            description={
              reportView === "household"
                ? "Totals for households on this page"
                : reportView === "group"
                  ? "Combined group + attributed gifts on this page"
                  : undefined
            }
          />
          <DonationMetricCard
            title="Gifts"
            value={summary.giftCount}
            icon={Gift}
            accent="purple"
            description={
              reportView === "household"
                ? "Gift count for households on this page"
                : reportView === "group"
                  ? "Gift count for groups on this page"
                  : undefined
            }
          />
        </DonationMetricCardGrid>
      )}

      <Card>
        <CardHeader className="space-y-3">
          {reportView === "group" || reportView === "household" ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle>
                  {reportView === "group" ? "Group Giving" : "Household Giving"}
                </CardTitle>
                {reportView === "group" ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setAddGroupError("")
                      setAddGroupOpen(true)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Group
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={dateRangeMode}
                  onValueChange={(value) => setDateRangeMode(value as DonorDateRangeMode)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                    <SelectItem value="year">Calendar year</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>

                {dateRangeMode === "year" ? (
                  <Select value={taxYear} onValueChange={setTaxYear}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_YEAR_OPTIONS.map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}

                {dateRangeMode === "custom" ? (
                  <>
                    <Input
                      type="date"
                      value={customDateFrom}
                      onChange={(event) => setCustomDateFrom(event.target.value)}
                      className="w-[160px]"
                      aria-label="From date"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="date"
                      value={customDateTo}
                      onChange={(event) => setCustomDateTo(event.target.value)}
                      className="w-[160px]"
                      aria-label="To date"
                    />
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <CardTitle>Donor Giving</CardTitle>
              <CardDescription>
                Click a donor name to open their profile. Pledge details live under Pledges.
              </CardDescription>
            </div>
          )}

          {reportView === "individual" ? (
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={dateRangeMode}
                onValueChange={(value) => setDateRangeMode(value as DonorDateRangeMode)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lifetime">Lifetime</SelectItem>
                  <SelectItem value="year">Calendar year</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>

              {dateRangeMode === "year" ? (
                <Select value={taxYear} onValueChange={setTaxYear}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_YEAR_OPTIONS.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {dateRangeMode === "custom" ? (
                <>
                  <Input
                    type="date"
                    value={customDateFrom}
                    onChange={(event) => setCustomDateFrom(event.target.value)}
                    className="w-[160px]"
                    aria-label="From date"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={customDateTo}
                    onChange={(event) => setCustomDateTo(event.target.value)}
                    className="w-[160px]"
                    aria-label="To date"
                  />
                </>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {reportView === "household" ? (
              <Input
                placeholder="Search household or member name..."
                value={rollupSearch}
                onChange={(event) => setRollupSearch(event.target.value)}
                className="max-w-sm"
              />
            ) : null}
            <span className="text-sm text-muted-foreground">
              {total > 0
                ? `${rangeStart}–${rangeEnd} of ${total}`
                : reportView === "household"
                  ? "No households"
                  : reportView === "group"
                    ? "No groups with gifts in this period"
                    : "No donors"}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {reportView === "household" ? (
                  <>
                    <TableHead>Household</TableHead>
                    <TableHead>Primary Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Total Given</TableHead>
                    <TableHead>Gifts</TableHead>
                    <TableHead>
                      <SortableReportHeader
                        label={lastGiftHeader}
                        column="last_donation_date"
                        sortBy={sortBy}
                        sortAsc={sortAsc}
                        onToggle={toggleReportSort}
                      />
                    </TableHead>
                  </>
                ) : reportView === "group" ? (
                  <>
                    <TableHead>
                      <SortableReportHeader
                        label="Group"
                        column="full_name"
                        sortBy={sortBy}
                        sortAsc={sortAsc}
                        onToggle={toggleReportSort}
                      />
                    </TableHead>
                    <TableHead>Primary Contact</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Group Gifts</TableHead>
                    <TableHead>Member Gifts</TableHead>
                    <TableHead>Combined Total</TableHead>
                    <TableHead>Gifts</TableHead>
                    <TableHead>
                      <SortableReportHeader
                        label={lastGiftHeader}
                        column="last_donation_date"
                        sortBy={sortBy}
                        sortAsc={sortAsc}
                        onToggle={toggleReportSort}
                      />
                    </TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>
                      <TableColumnHeaderFilter
                        label="Donor"
                        active={Boolean(donorNameFilter.trim())}
                      >
                        {({ close }) => (
                          <Input
                            placeholder="Search by name"
                            value={donorNameFilterInput}
                            onChange={(event) => setDonorNameFilterInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                setDonorNameFilter(donorNameFilterInput)
                                close()
                              }
                            }}
                          />
                        )}
                      </TableColumnHeaderFilter>
                    </TableHead>
                    <TableHead>
                      <TableColumnHeaderFilter
                        label="Email"
                        active={Boolean(emailFilter.trim())}
                      >
                        {({ close }) => (
                          <Input
                            placeholder="Search by email"
                            value={emailFilterInput}
                            onChange={(event) => setEmailFilterInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                setEmailFilter(emailFilterInput)
                                close()
                              }
                            }}
                          />
                        )}
                      </TableColumnHeaderFilter>
                    </TableHead>
                    <TableHead>
                      <TableColumnHeaderFilter
                        label="Phone"
                        active={Boolean(phoneFilter.trim())}
                      >
                        {({ close }) => (
                          <Input
                            placeholder="Search by phone"
                            value={phoneFilterInput}
                            onChange={(event) => setPhoneFilterInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                setPhoneFilter(phoneFilterInput)
                                close()
                              }
                            }}
                          />
                        )}
                      </TableColumnHeaderFilter>
                    </TableHead>
                    <TableHead>
                      <TableColumnHeaderFilter
                        label="Total Given"
                        active={debouncedMinTotalGiven != null && debouncedMinTotalGiven > 0}
                      >
                        {({ close }) => (
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            placeholder="Min amount ($)"
                            value={minTotalGivenFilterInput}
                            onChange={(event) =>
                              setMinTotalGivenFilterInput(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                const trimmed = minTotalGivenFilterInput.trim()
                                if (!trimmed) {
                                  setDebouncedMinTotalGiven(undefined)
                                } else {
                                  const parsed = Number(trimmed)
                                  setDebouncedMinTotalGiven(
                                    Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
                                  )
                                }
                                close()
                              }
                            }}
                          />
                        )}
                      </TableColumnHeaderFilter>
                    </TableHead>
                    <TableHead>Gifts</TableHead>
                    <TableHead>
                      <TableColumnHeaderFilter
                        label={lastGiftHeader}
                        active={lastGiftFilter !== "all"}
                      >
                        {({ close }) => (
                          <Select
                            value={lastGiftFilter}
                            onValueChange={(value) => {
                              setLastGiftFilter(value as DonorReportLastGiftFilter)
                              close()
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select filter" />
                            </SelectTrigger>
                            <SelectContent>
                              {LAST_GIFT_FILTER_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableColumnHeaderFilter>
                    </TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell
                    colSpan={tableColSpan(reportView)}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Loading report...
                  </TableCell>
                </TableRow>
              )}
              {!loading && error && (
                <TableRow>
                  <TableCell
                    colSpan={tableColSpan(reportView)}
                    className="py-8 text-center text-destructive"
                  >
                    {error}
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                !error &&
                reportView === "individual" &&
                donors.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={INDIVIDUAL_TABLE_COLSPAN}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No donors match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              {!loading &&
                !error &&
                reportView === "household" &&
                households.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={HOUSEHOLD_TABLE_COLSPAN}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No households match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              {!loading &&
                !error &&
                reportView === "group" &&
                groups.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={GROUP_TABLE_COLSPAN}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No groups received gifts or attributions in this period.
                    </TableCell>
                  </TableRow>
                )}
              {!loading &&
                !error &&
                reportView === "individual" &&
                donors.map((donor) => (
                  <TableRow key={donor.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={getDonorProfilePath(
                          donor.id,
                          donor.donor_type,
                          donor.contact_id
                        )}
                        className="text-primary hover:underline"
                      >
                        {donor.full_name || "Unnamed"}
                      </Link>
                    </TableCell>
                    <TableCell>{formatContactField(donor.email)}</TableCell>
                    <TableCell><PhoneText value={donor.phone} /></TableCell>
                    <TableCell>
                      {formatDonationCurrency(Number(donor.total_donations || 0))}
                    </TableCell>
                    <TableCell>{donor.donation_count ?? 0}</TableCell>
                    <TableCell>{formatDate(donor.last_donation_date)}</TableCell>
                  </TableRow>
                ))}
              {!loading &&
                !error &&
                reportView === "household" &&
                households.map((household) => (
                  <TableRow key={household.family_id}>
                    <TableCell className="font-medium">
                      {household.primary_contact_id ? (
                        <Link
                          href={contactProfileHref(household.primary_contact_id, {
                            tab: "financial",
                            list: "families",
                          })}
                          className="text-primary hover:underline"
                        >
                          {household.family_name}
                        </Link>
                      ) : (
                        household.family_name
                      )}
                    </TableCell>
                    <TableCell>
                      {household.primary_contact_id ? (
                        <Link
                          href={contactProfileHref(household.primary_contact_id, {
                            tab: "financial",
                          })}
                          className="text-primary hover:underline"
                        >
                          {household.primary_name}
                        </Link>
                      ) : (
                        household.primary_name
                      )}
                    </TableCell>
                    <TableCell>{formatContactField(household.primary_email)}</TableCell>
                    <TableCell><PhoneText value={household.primary_phone} /></TableCell>
                    <TableCell>{household.member_count}</TableCell>
                    <TableCell>
                      {formatDonationCurrency(Number(household.total_donations || 0))}
                    </TableCell>
                    <TableCell>{household.donation_count ?? 0}</TableCell>
                    <TableCell>{formatDate(household.last_donation_date)}</TableCell>
                  </TableRow>
                ))}
              {!loading &&
                !error &&
                reportView === "group" &&
                groups.map((group) => (
                  <TableRow key={group.group_contact_id}>
                    <TableCell className="font-medium">
                      <Link
                        href={donationGroupHref(group.group_contact_id, {
                          tab: "financial",
                          returnTo: "/donations/reports/donors?view=group",
                        })}
                        className="text-primary hover:underline"
                      >
                        {group.group_name}
                      </Link>
                    </TableCell>
                    <TableCell>{formatContactField(group.primary_contact_name)}</TableCell>
                    <TableCell>{group.member_count}</TableCell>
                    <TableCell>
                      {formatDonationCurrency(Number(group.group_gifts_total || 0))}
                    </TableCell>
                    <TableCell>
                      {formatDonationCurrency(Number(group.member_gifts_total || 0))}
                    </TableCell>
                    <TableCell>
                      {formatDonationCurrency(Number(group.total_donations || 0))}
                    </TableCell>
                    <TableCell>{group.donation_count ?? 0}</TableCell>
                    <TableCell>{formatDate(group.last_donation_date)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ListPagination
        page={page}
        pageSize={pageSize}
        total={total}
        disabled={loading}
        entryLabel={
          reportView === "household"
            ? "households"
            : reportView === "group"
              ? "groups"
              : "donors"
        }
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          setPageSize(next)
          setPage(1)
        }}
      />

      <Dialog
        open={addGroupOpen}
        onOpenChange={(open) => {
          setAddGroupOpen(open)
          if (!open) {
            setAddGroupName("")
            setAddGroupError("")
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Group</DialogTitle>
            <DialogDescription>
              Create a giving group to track donations attributed to a department, committee, or
              other collective. You can set status and category after it opens.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-giving-group-name">Group name</Label>
            <Input
              id="new-giving-group-name"
              value={addGroupName}
              onChange={(event) => setAddGroupName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  void handleCreateGroup()
                }
              }}
              placeholder="Qur'an Institute for Ladies"
            />
            {addGroupError ? (
              <p className="text-sm text-red-600">{addGroupError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddGroupOpen(false)}
              disabled={addGroupSaving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleCreateGroup()} disabled={addGroupSaving}>
              {addGroupSaving ? "Creating..." : "Create group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
