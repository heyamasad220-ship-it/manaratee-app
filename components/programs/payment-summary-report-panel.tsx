"use client"

import * as React from "react"
import Link from "next/link"
import { AlertCircle, Download, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ListPagination } from "@/components/ui/list-pagination"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
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
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  getPaymentSummaryRows,
  type PaymentSummaryRow,
  type PaymentSummaryStatus,
} from "@/lib/programs/payment-summary-report"
import {
  getReportHierarchyLabels,
} from "@/lib/programs/program-display-labels"
import {
  DEFAULT_LIST_PAGE_SIZE,
  slicePageItems,
} from "@/lib/ui/list-pagination"
import { useProgramKindReportPreset } from "@/hooks/use-program-kind-report-preset"

const ALL = "all"

type StatusFilter = "all" | "outstanding" | "paid" | "partial" | "unpaid" | "refunded"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function statusBadge(status: PaymentSummaryStatus) {
  if (status === "paid") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Paid</Badge>
  }
  if (status === "partial") {
    return <Badge variant="secondary">Partial</Badge>
  }
  if (status === "refunded") {
    return <Badge variant="outline">Refunded</Badge>
  }
  return <Badge variant="destructive">Unpaid</Badge>
}

function uniqueOptions(
  rows: PaymentSummaryRow[],
  getId: (row: PaymentSummaryRow) => string | null,
  getLabel: (row: PaymentSummaryRow) => string
) {
  const map = new Map<string, string>()
  for (const row of rows) {
    const id = getId(row)
    if (!id || map.has(id)) continue
    map.set(id, getLabel(row))
  }
  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

function StackedLines({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <div className="space-y-1">
      {values.map((value, index) => (
        <div key={`${value}-${index}`}>{value}</div>
      ))}
    </div>
  )
}

function SummaryContactBlock({
  name,
  contactId,
  email,
  phone,
}: {
  name: string | null
  contactId: string | null
  email: string | null
  phone: string | null
}) {
  if (!name && !contactId && !email && !phone) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <div className="space-y-0.5">
      {contactId ? (
        <Link
          href={contactProfileHref(contactId)}
          className="font-medium text-primary hover:underline"
        >
          {name || "View contact"}
        </Link>
      ) : name ? (
        <span className="font-medium">{name}</span>
      ) : null}
      {email ? (
        <div className="text-xs font-normal text-muted-foreground">{email}</div>
      ) : null}
      {phone ? (
        <div className="text-xs font-normal text-muted-foreground">{phone}</div>
      ) : null}
    </div>
  )
}

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows.map((row) => row.map(escapeCsv).join(",")).join("\n")
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function matchesStatusFilter(status: PaymentSummaryStatus, filter: StatusFilter) {
  if (filter === "all") return true
  if (filter === "outstanding") return status === "unpaid" || status === "partial"
  return status === filter
}

export function PaymentSummaryReportPanel({
  lockedProgramId,
}: {
  lockedProgramId?: string
}) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [items, setItems] = React.useState<PaymentSummaryRow[]>([])
  const { kindFilter: urlKindFilter, setKindFilter } =
    useProgramKindReportPreset()
  const kindFilter = lockedProgramId ? "all" : urlKindFilter
  const [programFilter, setProgramFilter] = React.useState(
    lockedProgramId || ALL
  )
  const [offeringFilter, setOfferingFilter] = React.useState(ALL)
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>(ALL)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(DEFAULT_LIST_PAGE_SIZE)

  React.useEffect(() => {
    if (lockedProgramId) return
    setProgramFilter(ALL)
    setOfferingFilter(ALL)
    setStatusFilter(ALL)
  }, [kindFilter, lockedProgramId])

  const reportLabels = getReportHierarchyLabels(
    kindFilter === "all" ? null : kindFilter
  )

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const result = await getPaymentSummaryRows()
      if (cancelled) return
      if (!result.success) {
        setError(result.error)
        setItems([])
      } else {
        setItems(result.rows)
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const programOptions = React.useMemo(() => {
    const scoped =
      kindFilter === "all"
        ? items
        : items.filter((row) => row.programKind === kindFilter)
    return uniqueOptions(
      scoped,
      (row) => row.programId,
      (row) => row.programName
    )
  }, [items, kindFilter])

  const offeringOptions = React.useMemo(() => {
    let scoped = items
    if (kindFilter !== "all") {
      scoped = scoped.filter((row) => row.programKind === kindFilter)
    }
    const scopedProgramId = lockedProgramId || programFilter
    if (scopedProgramId !== ALL) {
      scoped = scoped.filter((row) => row.programId === scopedProgramId)
    }
    const map = new Map<string, string>()
    for (const row of scoped) {
      row.offeringIds.forEach((id, index) => {
        if (!id || map.has(id)) return
        map.set(id, row.offeringNames[index] || reportLabels.offeringSingular)
      })
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [items, kindFilter, lockedProgramId, programFilter, reportLabels.offeringSingular])

  React.useEffect(() => {
    if (lockedProgramId) return
    if (
      programFilter !== ALL &&
      !programOptions.some((option) => option.id === programFilter)
    ) {
      setProgramFilter(ALL)
    }
  }, [lockedProgramId, programFilter, programOptions])

  React.useEffect(() => {
    if (
      offeringFilter !== ALL &&
      !offeringOptions.some((option) => option.id === offeringFilter)
    ) {
      setOfferingFilter(ALL)
    }
  }, [offeringFilter, offeringOptions])

  const scopedRows = React.useMemo(() => {
    return items.filter((row) => {
      if (kindFilter !== "all" && row.programKind !== kindFilter) return false
      if (
        (lockedProgramId || programFilter !== ALL) &&
        row.programId !== (lockedProgramId || programFilter)
      ) {
        return false
      }
      if (
        offeringFilter !== ALL &&
        !row.offeringIds.includes(offeringFilter)
      ) {
        return false
      }
      return true
    })
  }, [items, kindFilter, lockedProgramId, programFilter, offeringFilter])

  const filteredRows = React.useMemo(
    () =>
      scopedRows.filter((row) => matchesStatusFilter(row.status, statusFilter)),
    [scopedRows, statusFilter]
  )

  const totals = React.useMemo(() => {
    let received = 0
    let balance = 0
    let outstanding = 0
    for (const row of scopedRows) {
      received += row.received
      balance += row.balance
      if (row.balance > 0.009) outstanding += 1
    }
    return { received, balance, outstanding }
  }, [scopedRows])

  const pageRows = React.useMemo(
    () => slicePageItems(filteredRows, page, pageSize),
    [filteredRows, page, pageSize]
  )

  const showContactColumn = filteredRows.some((row) => row.showsContact)
  const tableColSpan = showContactColumn ? 9 : 8

  React.useEffect(() => {
    setPage(1)
  }, [kindFilter, programFilter, offeringFilter, statusFilter, items])

  function handleExport() {
    downloadCsv("payment-summary.csv", [
      [
        "Participants",
        "Email",
        "Phone",
        "Offerings",
        "Program fees",
        "Additional fees",
        "Fee types",
        "Received",
        "Balance",
        "Status",
        ...(showContactColumn
          ? ["Contact", "Contact email", "Contact phone"]
          : []),
      ],
      ...filteredRows.map((row) => [
        row.participantNames.join("; "),
        (row.participants || [])
          .filter((participant) => !participant.isYouth && participant.email)
          .map((participant) => participant.email as string)
          .join("; "),
        (row.participants || [])
          .filter((participant) => !participant.isYouth && participant.phone)
          .map((participant) => participant.phone as string)
          .join("; "),
        row.offeringNames.join("; "),
        row.programFeeLines.join("; "),
        row.additionalFeeLines.map((fee) => fee.label).join("; "),
        row.additionalFeeLines.map((fee) => fee.type).join("; "),
        String(row.received),
        String(row.balance),
        row.status,
        ...(showContactColumn
          ? [
              row.showsContact ? row.contactName : "",
              row.showsContact ? row.contactEmail || "" : "",
              row.showsContact ? row.contactPhone || "" : "",
            ]
          : []),
      ]),
    ])
  }

  const filtersActive =
    (!lockedProgramId && kindFilter !== "all") ||
    (!lockedProgramId && programFilter !== ALL) ||
    offeringFilter !== ALL ||
    statusFilter !== ALL

  return (
    <div className="space-y-4">
      {!loading && !error ? (
        <StatCardsRow equal columns={3} className="gap-3">
          <button
            type="button"
            className="min-w-0 w-full text-left"
            onClick={() =>
              setStatusFilter(
                statusFilter === "outstanding" ? ALL : "outstanding"
              )
            }
          >
            <StatCard
              layout="compact"
              fill
              tone="orange"
              label="Balance Due"
              value={totals.outstanding}
              icon={AlertCircle}
              valueClassName="text-xl"
              hint={formatCurrency(totals.balance)}
            />
          </button>
          <StatCard
            layout="compact"
            fill
            tone="emerald"
            label="Received"
            value={formatCurrency(totals.received)}
            valueClassName="text-xl"
          />
          <StatCard
            layout="compact"
            fill
            tone="slate"
            label="Outstanding"
            value={formatCurrency(totals.balance)}
            valueClassName="text-xl"
          />
        </StatCardsRow>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {lockedProgramId ? null : (
          <>
            <div className="space-y-1.5 sm:w-44">
              <Label htmlFor="payment-summary-kind">Type</Label>
              <Select
                value={kindFilter}
                onValueChange={(value) => {
                  setKindFilter(value as "all" | "academic" | "seasonal")
                  setProgramFilter(ALL)
                  setOfferingFilter(ALL)
                  setStatusFilter(ALL)
                }}
              >
                <SelectTrigger id="payment-summary-kind">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="seasonal">Seasonal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:w-56">
              <Label htmlFor="payment-summary-program">
                {reportLabels.containerSingular}
              </Label>
              <Select
                value={programFilter}
                onValueChange={(value) => {
                  setProgramFilter(value)
                  setOfferingFilter(ALL)
                }}
              >
                <SelectTrigger id="payment-summary-program">
                  <SelectValue
                    placeholder={`All ${reportLabels.containerPlural.toLowerCase()}`}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>
                    All {reportLabels.containerPlural.toLowerCase()}
                  </SelectItem>
                  {programOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        <div className="space-y-1.5 sm:w-56">
          <Label htmlFor="payment-summary-offering">
            {reportLabels.offeringSingular}
          </Label>
          <Select value={offeringFilter} onValueChange={setOfferingFilter}>
            <SelectTrigger id="payment-summary-offering">
              <SelectValue
                placeholder={`All ${reportLabels.offeringPlural.toLowerCase()}`}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>
                All {reportLabels.offeringPlural.toLowerCase()}
              </SelectItem>
              {offeringOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:w-44">
          <Label htmlFor="payment-summary-status">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger id="payment-summary-status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="outstanding">Balance due</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {filtersActive ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (!lockedProgramId) {
                setKindFilter("all")
                setProgramFilter(ALL)
              }
              setOfferingFilter(ALL)
              setStatusFilter(ALL)
            }}
          >
            Clear filters
          </Button>
        ) : null}
        <div className="ml-auto pb-0.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={loading || filteredRows.length === 0}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participants</TableHead>
              <TableHead>Offering</TableHead>
              <TableHead>Program Fees</TableHead>
              <TableHead>Additional Fees</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              {showContactColumn ? <TableHead>Contact</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={tableColSpan}
                  className="py-10 text-center text-muted-foreground"
                >
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading payment summary…
                  </span>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={tableColSpan}
                  className="py-10 text-center text-destructive"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={tableColSpan}
                  className="py-10 text-center text-muted-foreground"
                >
                  No payment summaries found.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="min-w-[10rem] align-top font-medium">
                    <div className="space-y-2">
                      {(row.participants?.length
                        ? row.participants
                        : row.participantNames.map((name) => ({
                            name,
                            contactId: null,
                            email: null,
                            phone: null,
                            isYouth: true,
                          }))
                      ).map((participant, index) =>
                        participant.isYouth ? (
                          <div key={`${row.id}-${participant.name}-${index}`}>
                            {participant.name}
                          </div>
                        ) : (
                          <SummaryContactBlock
                            key={`${row.id}-${participant.contactId || participant.name}-${index}`}
                            name={participant.name}
                            contactId={participant.contactId}
                            email={participant.email}
                            phone={participant.phone}
                          />
                        )
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[10rem] align-top text-sm">
                    <StackedLines values={row.offeringNames} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap align-top">
                    <StackedLines values={row.programFeeLines} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap align-top">
                    <StackedLines
                      values={row.additionalFeeLines.map((fee) => fee.label)}
                    />
                  </TableCell>
                  <TableCell className="align-top text-sm">
                    <StackedLines
                      values={row.additionalFeeLines.map((fee) => fee.type)}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap align-top font-medium">
                    {formatCurrency(row.received)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap align-top">
                    {formatCurrency(row.balance)}
                  </TableCell>
                  <TableCell className="align-top">
                    {statusBadge(row.status)}
                  </TableCell>
                  {showContactColumn ? (
                    <TableCell className="min-w-[12rem] align-top">
                      {row.showsContact ? (
                        <SummaryContactBlock
                          name={row.contactName}
                          contactId={row.contactProfileId}
                          email={row.contactEmail}
                          phone={row.contactPhone}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && !error && filteredRows.length > 0 ? (
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={filteredRows.length}
          entryLabel="registrations"
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next)
            setPage(1)
          }}
        />
      ) : null}
    </div>
  )
}
