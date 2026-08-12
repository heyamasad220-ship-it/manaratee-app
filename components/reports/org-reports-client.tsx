"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { TableColumnHeaderFilter } from "@/components/ui/table-column-header-filter"
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
import { financialActivityStatusBadgeClass } from "@/lib/donations/donation-status"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  PROGRAM_LABEL,
  YEAR_SEASON_LABEL,
} from "@/lib/programs/program-display-labels"
import {
  fetchOrgPaymentTransactionsAction,
  type OrgPaymentTransactionRow,
  type OrgPaymentTransactionStatus,
} from "@/lib/reports/org-payment-transactions"
import { cn } from "@/lib/utils"

const ALL = "all"
type OfferingActivityFilter = "all" | "active" | "closed"
type PaymentStatusFilter = "default" | "all" | OrgPaymentTransactionStatus

const PAYMENT_STATUS_FILTERS: Array<{
  value: PaymentStatusFilter
  label: string
}> = [
  { value: "default", label: "Hide voided" },
  { value: "Succeeded", label: "Succeeded" },
  { value: "Failed", label: "Failed" },
  { value: "Refunded", label: "Refunded" },
  { value: "Voided", label: "Voided" },
  { value: "all", label: "All statuses" },
]

function formatCurrency(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function uniqueOptions(
  rows: OrgPaymentTransactionRow[],
  getId: (row: OrgPaymentTransactionRow) => string | null,
  getLabel: (row: OrgPaymentTransactionRow) => string | null
) {
  const map = new Map<string, string>()
  for (const row of rows) {
    const id = getId(row)
    const label = getLabel(row)
    if (!id || map.has(id)) continue
    map.set(id, label || id)
  }
  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

function PaymentTransactionsTable({
  rows,
  paymentStatusFilter,
  onPaymentStatusFilterChange,
}: {
  rows: OrgPaymentTransactionRow[]
  paymentStatusFilter: PaymentStatusFilter
  onPaymentStatusFilterChange: (value: PaymentStatusFilter) => void
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Payment date</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Program</TableHead>
            <TableHead>Offering</TableHead>
            <TableHead>Payment type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Payment method</TableHead>
            <TableHead>
              <TableColumnHeaderFilter
                label="Status"
                active={paymentStatusFilter !== "default"}
              >
                {({ close }) => (
                  <Select
                    value={paymentStatusFilter}
                    onValueChange={(value) => {
                      onPaymentStatusFilterChange(value as PaymentStatusFilter)
                      close()
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUS_FILTERS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </TableColumnHeaderFilter>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                No matching transactions.
              </TableCell>
            </TableRow>
          ) : null}
          {rows.map((row) => {
            const contactHref = row.contactProfileId
              ? contactProfileHref(row.contactProfileId, "financial")
              : row.detailHref
            return (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDate(row.paidAt)}
                </TableCell>
                <TableCell>
                  {contactHref ? (
                    <Link
                      href={contactHref}
                      className="font-medium text-sky-600 hover:underline"
                    >
                      {row.contactName}
                    </Link>
                  ) : (
                    <span className="font-medium">{row.contactName}</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.programName || "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.offeringName || "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.paymentType}
                </TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap">
                  {formatCurrency(row.amount)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.paymentMethod}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "rounded-full",
                      financialActivityStatusBadgeClass(row.status)
                    )}
                  >
                    {row.status}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function OrgReportsClient({
  basePath = "/finance/transactions",
}: {
  /** Path used for legacy tab URL cleanup (Finance Transactions or /reports). */
  basePath?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<OrgPaymentTransactionRow[]>([])
  const [departmentFilter, setDepartmentFilter] = React.useState(ALL)
  const [programFilter, setProgramFilter] = React.useState(ALL)
  const [offeringFilter, setOfferingFilter] = React.useState(ALL)
  const [statusFilter, setStatusFilter] =
    React.useState<OfferingActivityFilter>("active")
  const [paymentStatusFilter, setPaymentStatusFilter] =
    React.useState<PaymentStatusFilter>("default")

  React.useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "failed" || tab === "more" || tab === "payments") {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("tab")
      const query = params.toString()
      router.replace(query ? `${basePath}?${query}` : basePath)
    }
  }, [basePath, router, searchParams])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const result = await fetchOrgPaymentTransactionsAction({
        limit: 400,
      })
      if (cancelled) return
      if (!result.success) {
        setError(result.error)
        setRows([])
      } else {
        setRows(result.rows)
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const departmentOptions = React.useMemo(
    () =>
      uniqueOptions(
        rows,
        (row) => row.departmentId,
        (row) => row.departmentName
      ),
    [rows]
  )

  const programOptions = React.useMemo(() => {
    const scoped =
      departmentFilter === ALL
        ? rows
        : rows.filter((row) => row.departmentId === departmentFilter)
    return uniqueOptions(
      scoped,
      (row) => row.programId,
      (row) => row.programName
    )
  }, [rows, departmentFilter])

  const offeringOptions = React.useMemo(() => {
    let scoped = rows
    if (departmentFilter !== ALL) {
      scoped = scoped.filter((row) => row.departmentId === departmentFilter)
    }
    if (programFilter !== ALL) {
      scoped = scoped.filter((row) => row.programId === programFilter)
    }
    return uniqueOptions(
      scoped,
      (row) => row.offeringId,
      (row) => row.offeringName
    )
  }, [rows, departmentFilter, programFilter])

  React.useEffect(() => {
    if (
      programFilter !== ALL &&
      !programOptions.some((option) => option.id === programFilter)
    ) {
      setProgramFilter(ALL)
    }
  }, [programFilter, programOptions])

  React.useEffect(() => {
    if (
      offeringFilter !== ALL &&
      !offeringOptions.some((option) => option.id === offeringFilter)
    ) {
      setOfferingFilter(ALL)
    }
  }, [offeringFilter, offeringOptions])

  const filteredRows = React.useMemo(() => {
    return rows.filter((row) => {
      if (departmentFilter !== ALL && row.departmentId !== departmentFilter) {
        return false
      }
      if (programFilter !== ALL && row.programId !== programFilter) {
        return false
      }
      if (offeringFilter !== ALL && row.offeringId !== offeringFilter) {
        return false
      }
      if (statusFilter !== ALL && row.offeringActivity !== statusFilter) {
        return false
      }
      if (paymentStatusFilter === "default") {
        return row.status !== "Voided"
      }
      if (paymentStatusFilter !== "all" && row.status !== paymentStatusFilter) {
        return false
      }
      return true
    })
  }, [
    rows,
    departmentFilter,
    programFilter,
    offeringFilter,
    statusFilter,
    paymentStatusFilter,
  ])

  const filtersActive =
    departmentFilter !== ALL ||
    programFilter !== ALL ||
    offeringFilter !== ALL ||
    statusFilter !== "active" ||
    paymentStatusFilter !== "default"

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading transactions…
      </div>
    )
  }

  if (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5 sm:w-44">
          <Label htmlFor="transactions-department">Department</Label>
          <Select
            value={departmentFilter}
            onValueChange={(value) => {
              setDepartmentFilter(value)
              setProgramFilter(ALL)
              setOfferingFilter(ALL)
            }}
          >
            <SelectTrigger id="transactions-department">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All departments</SelectItem>
              {departmentOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:w-44">
          <Label htmlFor="transactions-program">{YEAR_SEASON_LABEL}</Label>
          <Select
            value={programFilter}
            onValueChange={(value) => {
              setProgramFilter(value)
              setOfferingFilter(ALL)
            }}
          >
            <SelectTrigger id="transactions-program">
              <SelectValue
                placeholder={`All ${YEAR_SEASON_LABEL.toLowerCase()}s`}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>
                All {YEAR_SEASON_LABEL.toLowerCase()}s
              </SelectItem>
              {programOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:w-44">
          <Label htmlFor="transactions-offering">{PROGRAM_LABEL}</Label>
          <Select value={offeringFilter} onValueChange={setOfferingFilter}>
            <SelectTrigger id="transactions-offering">
              <SelectValue
                placeholder={`All ${PROGRAM_LABEL.toLowerCase()}s`}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>
                All {PROGRAM_LABEL.toLowerCase()}s
              </SelectItem>
              {offeringOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:w-40">
          <Label htmlFor="transactions-program-status">Program Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as OfferingActivityFilter)
            }
          >
            <SelectTrigger id="transactions-program-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value={ALL}>All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {filtersActive ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDepartmentFilter(ALL)
              setProgramFilter(ALL)
              setOfferingFilter(ALL)
              setStatusFilter("active")
              setPaymentStatusFilter("default")
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <PaymentTransactionsTable
        rows={filteredRows}
        paymentStatusFilter={paymentStatusFilter}
        onPaymentStatusFilterChange={setPaymentStatusFilter}
      />
    </div>
  )
}
