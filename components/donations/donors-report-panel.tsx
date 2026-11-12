"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import {
  fetchDonorGivingReportExportContextAction,
  fetchDonorSummaryExportAction,
  fetchDonorSummaryPageAction,
  fetchDonorSummaryReportSummaryAction,
  type DonorReportLastGiftFilter,
  type DonorSummaryReportRow,
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
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination"
import { ListPagination } from "@/components/ui/list-pagination"
import { PhoneText } from "@/components/ui/phone-text"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { TableColumnHeaderFilter } from "@/components/ui/table-column-header-filter"
import { Download, DollarSign, FileText, Gift, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { STAFF_MAIN_CONTENT_STICKY_TOP_CLASS } from "@/lib/layout/staff-dashboard-chrome"

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

const DONOR_TABLE_COLSPAN = 6

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
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [donors, setDonors] = useState<DonorSummaryReportRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DONATIONS_PAGE_SIZE)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [minTotalGivenFilterInput, setMinTotalGivenFilterInput] = useState("")
  const [debouncedMinTotalGiven, setDebouncedMinTotalGiven] = useState<number | undefined>(
    undefined
  )
  const [lastGiftFilter, setLastGiftFilter] = useState<DonorReportLastGiftFilter>("all")
  const [dateRangeMode, setDateRangeMode] = useState<DonorDateRangeMode>("lifetime")
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()))
  const [customDateFrom, setCustomDateFrom] = useState("")
  const [customDateTo, setCustomDateTo] = useState("")
  const sortBy: DonorReportSortBy = "total_donations"
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
    if (!searchParams.has("view") && searchParams.get("add") !== "1" && !searchParams.has("campaignId")) {
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    params.delete("view")
    params.delete("add")
    params.delete("campaignId")
    replaceQueryWithoutRefresh(pathname, params)
  }, [pathname, searchParams])

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
      search: search || undefined,
      lastGiftFilter: lastGiftFilter !== "all" ? lastGiftFilter : undefined,
      minTotalGiven: debouncedMinTotalGiven,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
    }),
    [search, lastGiftFilter, debouncedMinTotalGiven, dateRange]
  )

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

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
    search,
    lastGiftFilter,
    debouncedMinTotalGiven,
    dateRangeMode,
    taxYear,
    customDateFrom,
    customDateTo,
  ])

  const loadDonors = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
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
        setTotal(0)
      } else {
        setDonors(result.donors)
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
  }, [page, pageSize, filterInput, sortBy, sortAsc])

  const loadSummary = useCallback(async () => {
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
  }, [filterInput])

  useEffect(() => {
    void loadDonors()
  }, [loadDonors, pathname])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary, pathname])

  async function handleExportCsv() {
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
        search,
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

  const periodControls = (
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
  )

  return (
    <div className="flex flex-col gap-3 p-6">
      <div
        className={cn(
          "sticky z-30 -mx-6 space-y-3 border-b border-border bg-background px-6 pb-3 pt-6",
          STAFF_MAIN_CONTENT_STICKY_TOP_CLASS
        )}
      >
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Donor Giving</h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {periodControls}
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
        </div>

      {summaryLoading ? (
        <p className="text-sm text-muted-foreground">Loading summary...</p>
      ) : (
        <DonationMetricCardGrid colorful columns={3}>
          <DonationMetricCard
            title="Donors"
            value={summary.donorCount}
            icon={Users}
            accent="blue"
          />
          <DonationMetricCard
            title="Total Given"
            value={formatDonationCurrency(summary.totalGiven)}
            icon={DollarSign}
            accent="emerald"
          />
          <DonationMetricCard
            title="Gifts"
            value={summary.giftCount}
            icon={Gift}
            accent="purple"
          />
        </DonationMetricCardGrid>
      )}
      </div>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2">
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, email, or phone"
            aria-label="Search donors"
            className="h-9 max-w-sm"
          />
          <span className="text-sm text-muted-foreground">
            {total > 0 ? `${rangeStart}–${rangeEnd} of ${total}` : "No donors"}
          </span>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                  <>
                    <TableHead>Donor</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell
                    colSpan={DONOR_TABLE_COLSPAN}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Loading report...
                  </TableCell>
                </TableRow>
              )}
              {!loading && error && (
                <TableRow>
                  <TableCell
                    colSpan={DONOR_TABLE_COLSPAN}
                    className="py-8 text-center text-destructive"
                  >
                    {error}
                  </TableCell>
                </TableRow>
              )}
              {!loading && !error && donors.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={DONOR_TABLE_COLSPAN}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No donors match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              {!loading &&
                !error &&
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ListPagination
        page={page}
        pageSize={pageSize}
        total={total}
        disabled={loading}
        entryLabel="donors"
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          setPageSize(next)
          setPage(1)
        }}
      />
    </div>
  )
}
