"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Download, DollarSign, FileText, Gift, Users } from "lucide-react"

import {
  fetchDonorGivingReportExportContextAction,
  fetchDonorSummaryExportAction,
  fetchDonorSummaryPageAction,
  fetchDonorSummaryReportSummaryAction,
  type DonorPledgeFilter,
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
import { clearSelectedOrganizationIdCache } from "@/lib/current-organization"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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

const TAX_YEAR_OPTIONS = [0, 1, 2, 3, 4].map((offset) => new Date().getFullYear() - offset)

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function buildFilterSummary(input: {
  pledgeFilter: DonorPledgeFilter
  lapsedOnly: boolean
  search: string
  minTotalGiven?: number
}) {
  const parts: string[] = []

  if (input.search.trim()) {
    parts.push(`Search: "${input.search.trim()}"`)
  }

  if (input.minTotalGiven != null && input.minTotalGiven > 0) {
    parts.push(`Min total given: $${input.minTotalGiven.toLocaleString()}`)
  }

  if (input.pledgeFilter === "open_pledge") {
    parts.push("Open pledge only")
  } else if (input.pledgeFilter === "no_open_pledge") {
    parts.push("No open pledge")
  }

  if (input.lapsedOnly) {
    parts.push("Lapsed only (no gift in 12+ months)")
  }

  return parts.length > 0 ? parts.join("; ") : "None"
}

export function DonorsReportPanel() {
  const pathname = usePathname()
  const [donors, setDonors] = useState<DonorSummaryReportRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [minTotalGivenFilter, setMinTotalGivenFilter] = useState("")
  const [debouncedMinTotalGiven, setDebouncedMinTotalGiven] = useState<number | undefined>(
    undefined
  )
  const [pledgeFilter, setPledgeFilter] = useState<DonorPledgeFilter>("all")
  const [lapsedOnly, setLapsedOnly] = useState(false)
  const [dateRangeMode, setDateRangeMode] = useState<DonorDateRangeMode>("lifetime")
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()))
  const [customDateFrom, setCustomDateFrom] = useState("")
  const [customDateTo, setCustomDateTo] = useState("")
  const [sortBy, setSortBy] = useState<DonorReportSortBy>("total_donations")
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
      search: debouncedSearch || undefined,
      pledgeFilter: pledgeFilter === "all" ? undefined : pledgeFilter,
      lapsedOnly: lapsedOnly || undefined,
      minTotalGiven: debouncedMinTotalGiven,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
    }),
    [debouncedSearch, pledgeFilter, lapsedOnly, debouncedMinTotalGiven, dateRange]
  )

  const sortAsc = sortBy === "full_name"

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = minTotalGivenFilter.trim()
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
  }, [minTotalGivenFilter])

  useEffect(() => {
    setPage(1)
  }, [
    debouncedSearch,
    pledgeFilter,
    lapsedOnly,
    debouncedMinTotalGiven,
    dateRangeMode,
    taxYear,
    customDateFrom,
    customDateTo,
    sortBy,
  ])

  const loadDonors = useCallback(async () => {
    clearSelectedOrganizationIdCache()
    setLoading(true)
    setError("")

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
      setTotal(0)
    } else {
      setDonors(result.donors)
      setTotal(result.total)
    }

    setLoading(false)
  }, [page, filterInput, sortBy, sortAsc])

  const loadSummary = useCallback(async () => {
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
        pledgeFilter,
        lapsedOnly,
        search: debouncedSearch,
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

      <Card>
        <CardHeader>
          <CardTitle>Donor Giving</CardTitle>
          <CardDescription>
            Click a donor name to open their profile. Outstanding pledge balances are current, not
            limited to the selected gift period.
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

              <Input
                placeholder="Search donor name, email, or phone..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="max-w-sm"
              />

              <Input
                type="number"
                min={0}
                step={1}
                placeholder="Min total given ($)"
                value={minTotalGivenFilter}
                onChange={(event) => setMinTotalGivenFilter(event.target.value)}
                className="w-[170px]"
                aria-label="Minimum total given"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={pledgeFilter}
                onValueChange={(value) => setPledgeFilter(value as DonorPledgeFilter)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Pledge status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All pledge statuses</SelectItem>
                  <SelectItem value="open_pledge">Open pledge</SelectItem>
                  <SelectItem value="no_open_pledge">No open pledge</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value) => setSortBy(value as DonorReportSortBy)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total_donations">Total given (high to low)</SelectItem>
                  <SelectItem value="last_donation_date">Last gift (recent first)</SelectItem>
                  <SelectItem value="outstanding_pledge_balance">
                    Outstanding pledge (high to low)
                  </SelectItem>
                  <SelectItem value="full_name">Name (A–Z)</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="lapsed-only"
                  checked={lapsedOnly}
                  onCheckedChange={(checked) => setLapsedOnly(checked === true)}
                />
                <Label htmlFor="lapsed-only" className="text-sm font-normal">
                  Lapsed only (no gift in 12+ months)
                </Label>
              </div>

              <span className="text-sm text-muted-foreground">
                {total > 0 ? `${rangeStart}–${rangeEnd} of ${total}` : "No donors"}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Total Given</TableHead>
                <TableHead>Gifts</TableHead>
                <TableHead>{lastGiftHeader}</TableHead>
                <TableHead>Outstanding Pledge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Loading report...
                  </TableCell>
                </TableRow>
              )}
              {!loading && error && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-destructive">
                    {error}
                  </TableCell>
                </TableRow>
              )}
              {!loading && !error && donors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
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
                      {lapsedOnly && donor.lifetime_last_donation_date ? (
                        <div className="text-xs text-muted-foreground">
                          Last gift ever: {formatDate(donor.lifetime_last_donation_date)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {formatDonationCurrency(Number(donor.total_donations || 0))}
                    </TableCell>
                    <TableCell>{donor.donation_count ?? 0}</TableCell>
                    <TableCell>{formatDate(donor.last_donation_date)}</TableCell>
                    <TableCell>
                      {Number(donor.outstanding_pledge_balance || 0) > 0 ? (
                        <div className="flex items-center gap-2">
                          <span>
                            {formatDonationCurrency(Number(donor.outstanding_pledge_balance || 0))}
                          </span>
                          {donor.has_open_pledge ? (
                            <Badge className="border-transparent bg-orange-100 text-xs text-orange-700 hover:bg-orange-100">
                              Open
                            </Badge>
                          ) : null}
                        </div>
                      ) : (
                        "—"
                      )}
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
