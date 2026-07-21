"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  fetchDonorGivingReportExportContextAction,
  fetchDonorSummaryExportAction,
  fetchDonorSummaryPageAction,
  fetchDonorSummaryReportSummaryAction,
  fetchGroupGivingReportPageAction,
  fetchHouseholdGivingReportPageAction,
  type DonorReportPledgeStatusFilter,
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
} from "@/lib/donations/donor-giving-report"
import { getDonorProfilePath } from "@/lib/donations/donor-profile-path"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { donationGroupHref } from "@/lib/donations/donation-group-path"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination"
import { clearSelectedOrganizationIdCache } from "@/lib/current-organization"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { TableColumnHeaderFilter } from "@/components/ui/table-column-header-filter"
import { Download, DollarSign, FileText, Gift, Home, Users, UsersRound } from "lucide-react"

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

const INDIVIDUAL_TABLE_COLSPAN = 8
const HOUSEHOLD_TABLE_COLSPAN = 10
const GROUP_TABLE_COLSPAN = 10

type DonorsReportView = "individual" | "household" | "group"

function tableColSpan(view: DonorsReportView) {
  if (view === "household") return HOUSEHOLD_TABLE_COLSPAN
  if (view === "group") return GROUP_TABLE_COLSPAN
  return INDIVIDUAL_TABLE_COLSPAN
}

function formatOutstandingBalance(value: number) {
  if (value <= 0) return "—"
  return formatDonationCurrency(value)
}

function PledgeStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) {
    return <span className="text-muted-foreground">—</span>
  }

  switch (status) {
    case "Fulfilled":
      return (
        <Badge className="border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
          Fulfilled
        </Badge>
      )
    case "Partial":
      return (
        <Badge className="border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100">
          Partial
        </Badge>
      )
    case "Open":
      return (
        <Badge className="border-transparent bg-orange-100 text-orange-700 hover:bg-orange-100">
          Open
        </Badge>
      )
    default:
      return <span>{status}</span>
  }
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
  pledgeStatus?: DonorReportPledgeStatusFilter
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

  if (input.pledgeStatus && input.pledgeStatus !== "all") {
    parts.push(`Pledge: ${input.pledgeStatus}`)
  }

  if (input.lastGiftFilter && input.lastGiftFilter !== "all") {
    parts.push(`Last gift: ${formatLastGiftFilterLabel(input.lastGiftFilter)}`)
  }

  return parts.length > 0 ? parts.join("; ") : "None"
}

export function DonorsReportPanel() {
  const pathname = usePathname()
  const router = useRouter()
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
  const [rollupSearch, setRollupSearch] = useState("")
  const [debouncedRollupSearch, setDebouncedRollupSearch] = useState("")
  const [donorNameFilter, setDonorNameFilter] = useState("")
  const [donorNameFilterInput, setDonorNameFilterInput] = useState("")
  const [emailFilter, setEmailFilter] = useState("")
  const [emailFilterInput, setEmailFilterInput] = useState("")
  const [phoneFilter, setPhoneFilter] = useState("")
  const [phoneFilterInput, setPhoneFilterInput] = useState("")
  const [pledgeStatusFilter, setPledgeStatusFilter] =
    useState<DonorReportPledgeStatusFilter>("all")
  const [minTotalGivenFilterInput, setMinTotalGivenFilterInput] = useState("")
  const [debouncedMinTotalGiven, setDebouncedMinTotalGiven] = useState<number | undefined>(
    undefined
  )
  const [lastGiftFilter, setLastGiftFilter] = useState<DonorReportLastGiftFilter>("all")
  const [dateRangeMode, setDateRangeMode] = useState<DonorDateRangeMode>("lifetime")
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()))
  const [customDateFrom, setCustomDateFrom] = useState("")
  const [customDateTo, setCustomDateTo] = useState("")
  const sortBy = "total_donations" as const
  const sortAsc = false
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

  useEffect(() => {
    const view = searchParams.get("view")
    if (view === "group" || view === "household" || view === "individual") {
      setReportView(view)
    }
  }, [searchParams])

  function setReportViewAndUrl(view: DonorsReportView) {
    setReportView(view)
    const params = new URLSearchParams(searchParams.toString())
    if (view === "individual") {
      params.delete("view")
    } else {
      params.set("view", view)
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
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
      search:
        reportView === "household" || reportView === "group"
          ? debouncedRollupSearch || undefined
          : undefined,
      donorName: reportView === "individual" ? donorNameFilter || undefined : undefined,
      email: reportView === "individual" ? emailFilter || undefined : undefined,
      phone: reportView === "individual" ? phoneFilter || undefined : undefined,
      pledgeStatus:
        reportView === "individual" && pledgeStatusFilter !== "all"
          ? pledgeStatusFilter
          : undefined,
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
      pledgeStatusFilter,
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
    pledgeStatusFilter,
    lastGiftFilter,
    debouncedMinTotalGiven,
    dateRangeMode,
    taxYear,
    customDateFrom,
    customDateTo,
    reportView,
  ])

  const loadDonors = useCallback(async () => {
    clearSelectedOrganizationIdCache()
    setLoading(true)
    setError("")

    if (reportView === "household") {
      const result = await fetchHouseholdGivingReportPageAction({
        page,
        pageSize: DONATIONS_PAGE_SIZE,
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

      setSummaryLoading(false)
      setLoading(false)
      return
    }

    if (reportView === "group") {
      const result = await fetchGroupGivingReportPageAction({
        page,
        pageSize: DONATIONS_PAGE_SIZE,
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

      setSummaryLoading(false)
      setLoading(false)
      return
    }

    const result = await fetchDonorSummaryPageAction({
      page,
      pageSize: DONATIONS_PAGE_SIZE,
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

    setLoading(false)
  }, [page, filterInput, sortBy, sortAsc, reportView])

  const loadSummary = useCallback(async () => {
    if (reportView === "household" || reportView === "group") {
      setSummaryLoading(false)
      return
    }

    clearSelectedOrganizationIdCache()
    setSummaryLoading(true)

    const result = await fetchDonorSummaryReportSummaryAction(filterInput)

    if (!result.success) {
      setError((current) => current || result.error)
      setSummary({ donorCount: 0, totalGiven: 0, giftCount: 0 })
    } else {
      setSummary(result.summary)
    }

    setSummaryLoading(false)
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
        pledgeStatus: pledgeStatusFilter,
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

  const totalPages = Math.max(1, Math.ceil(total / DONATIONS_PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : (page - 1) * DONATIONS_PAGE_SIZE + 1
  const rangeEnd = Math.min(page * DONATIONS_PAGE_SIZE, total)
  const lastGiftHeader =
    dateRangeMode === "lifetime" ? "Last Gift" : "Last Gift (in period)"
  const exporting = exportingCsv || exportingPdf

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {periodLabel}. Summary totals and table rows reflect current filters.
          </p>
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
        <CardHeader>
          <CardTitle>
            {reportView === "household"
              ? "Household Giving"
              : reportView === "group"
                ? "Group Giving"
                : "Donor Giving"}
          </CardTitle>
          <CardDescription>
            {reportView === "household"
              ? "Aggregates gifts from active household members. Donations remain on individual contacts."
              : reportView === "group"
                ? "Only groups with gifts or attributed member gifts in the selected period. Combined total = group gifts + attributed member gifts."
                : "Click a donor name to open their profile. Outstanding pledge balances are current, not limited to the selected gift period."}
          </CardDescription>
          <div className="flex flex-col gap-3 pt-2">
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

              {reportView === "household" || reportView === "group" ? (
                <Input
                  placeholder={
                    reportView === "group"
                      ? "Search group or member name..."
                      : "Search household or member name..."
                  }
                  value={rollupSearch}
                  onChange={(event) => setRollupSearch(event.target.value)}
                  className="max-w-sm"
                />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
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
                    <TableHead>{lastGiftHeader}</TableHead>
                    <TableHead>Pledge</TableHead>
                    <TableHead>Outstanding Balance</TableHead>
                  </>
                ) : reportView === "group" ? (
                  <>
                    <TableHead>Group</TableHead>
                    <TableHead>Primary Contact</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Group Gifts</TableHead>
                    <TableHead>Member Gifts</TableHead>
                    <TableHead>Combined Total</TableHead>
                    <TableHead>Gifts</TableHead>
                    <TableHead>{lastGiftHeader}</TableHead>
                    <TableHead>Pledge</TableHead>
                    <TableHead>Outstanding Balance</TableHead>
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
                    <TableHead>
                      <TableColumnHeaderFilter
                        label="Pledge"
                        active={pledgeStatusFilter !== "all"}
                      >
                        {({ close }) => (
                          <Select
                            value={pledgeStatusFilter}
                            onValueChange={(value) => {
                              setPledgeStatusFilter(value as DonorReportPledgeStatusFilter)
                              close()
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="partial">Partial</SelectItem>
                              <SelectItem value="fulfilled">Fulfilled</SelectItem>
                              <SelectItem value="none">No pledge</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableColumnHeaderFilter>
                    </TableHead>
                    <TableHead>Outstanding Balance</TableHead>
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
                    <TableCell>{formatContactField(donor.phone)}</TableCell>
                    <TableCell>
                      {formatDonationCurrency(Number(donor.total_donations || 0))}
                    </TableCell>
                    <TableCell>{donor.donation_count ?? 0}</TableCell>
                    <TableCell>{formatDate(donor.last_donation_date)}</TableCell>
                    <TableCell>
                      <PledgeStatusBadge status={donor.pledge_status} />
                    </TableCell>
                    <TableCell>
                      {formatOutstandingBalance(Number(donor.outstanding_pledge_balance || 0))}
                    </TableCell>
                  </TableRow>
                ))}
              {!loading &&
                !error &&
                reportView === "household" &&
                households.map((household) => (
                  <TableRow key={household.family_id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/contacts/families/${household.family_id}`}
                        className="text-primary hover:underline"
                      >
                        {household.family_name}
                      </Link>
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
                    <TableCell>{formatContactField(household.primary_phone)}</TableCell>
                    <TableCell>{household.member_count}</TableCell>
                    <TableCell>
                      {formatDonationCurrency(Number(household.total_donations || 0))}
                    </TableCell>
                    <TableCell>{household.donation_count ?? 0}</TableCell>
                    <TableCell>{formatDate(household.last_donation_date)}</TableCell>
                    <TableCell>
                      <PledgeStatusBadge status={household.pledge_status} />
                    </TableCell>
                    <TableCell>
                      {formatOutstandingBalance(Number(household.outstanding_pledge_balance || 0))}
                    </TableCell>
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
                    <TableCell>
                      <PledgeStatusBadge status={group.pledge_status} />
                    </TableCell>
                    <TableCell>
                      {formatOutstandingBalance(Number(group.outstanding_pledge_balance || 0))}
                    </TableCell>
                  </TableRow>
                ))}
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
                className={page <= 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                {page} / {totalPages}
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  setPage((current) => Math.min(totalPages, current + 1))
                }}
                className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  )
}
