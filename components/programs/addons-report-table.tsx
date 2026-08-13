"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ShoppingBag } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ListPagination } from "@/components/ui/list-pagination"
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
import type {
  AddonReportPaymentStatus,
  AddonReportRow,
} from "@/lib/programs/addon-display"
import { getReportHierarchyLabels } from "@/lib/programs/program-display-labels"
import {
  DEFAULT_LIST_PAGE_SIZE,
  slicePageItems,
} from "@/lib/ui/list-pagination"
import { useProgramKindReportPreset } from "@/hooks/use-program-kind-report-preset"

type OfferingActivityFilter = "all" | "active" | "closed"
type PaymentStatusFilter = "all" | AddonReportPaymentStatus

const ALL = "all"
const TABLE_COLSPAN = 10

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function formatQuantity(value: number) {
  if (Number.isInteger(value)) return String(value)
  return String(Math.round(value * 100) / 100)
}

function statusBadge(status: AddonReportPaymentStatus) {
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

function matchesText(value: string | null | undefined, filter: string) {
  const needle = filter.trim().toLowerCase()
  if (!needle) return true
  return (value || "").toLowerCase().includes(needle)
}

function uniqueOptions(
  rows: AddonReportRow[],
  getId: (row: AddonReportRow) => string | null,
  getLabel: (row: AddonReportRow) => string
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

export function AddonsReportTable({
  rows,
}: {
  rows: AddonReportRow[]
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE)
  const [searchInput, setSearchInput] = useState("")
  const [searchFilter, setSearchFilter] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState(ALL)
  const { kindFilter, setKindFilter } = useProgramKindReportPreset()
  const [programFilter, setProgramFilter] = useState(ALL)
  const [offeringFilter, setOfferingFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] =
    useState<OfferingActivityFilter>("active")
  const [addonTypeFilter, setAddonTypeFilter] = useState(ALL)
  const [paymentStatusFilter, setPaymentStatusFilter] =
    useState<PaymentStatusFilter>(ALL)

  useEffect(() => {
    setProgramFilter(ALL)
    setOfferingFilter(ALL)
  }, [kindFilter])

  const reportLabels = getReportHierarchyLabels(
    kindFilter === "all" ? null : kindFilter
  )

  const departmentOptions = useMemo(
    () =>
      uniqueOptions(
        rows,
        (row) => row.departmentId,
        (row) => row.departmentName
      ),
    [rows]
  )

  const programOptions = useMemo(() => {
    let scoped = rows
    if (departmentFilter !== ALL) {
      scoped = scoped.filter((row) => row.departmentId === departmentFilter)
    }
    if (kindFilter !== "all") {
      scoped = scoped.filter((row) => row.programKind === kindFilter)
    }
    return uniqueOptions(
      scoped,
      (row) => row.programId,
      (row) => row.programName
    )
  }, [rows, departmentFilter, kindFilter])

  const offeringOptions = useMemo(() => {
    const scoped = rows.filter((row) => {
      if (departmentFilter !== ALL && row.departmentId !== departmentFilter) {
        return false
      }
      if (kindFilter !== "all" && row.programKind !== kindFilter) {
        return false
      }
      if (programFilter !== ALL && row.programId !== programFilter) {
        return false
      }
      return true
    })
    return uniqueOptions(
      scoped,
      (row) => row.offeringId,
      (row) => row.offeringName
    )
  }, [rows, departmentFilter, kindFilter, programFilter])

  const addonTypeOptions = useMemo(() => {
    const types = [...new Set(rows.map((row) => row.addonType).filter(Boolean))]
    return types.sort((a, b) => a.localeCompare(b))
  }, [rows])

  useEffect(() => {
    if (
      programFilter !== ALL &&
      !programOptions.some((option) => option.id === programFilter)
    ) {
      setProgramFilter(ALL)
    }
  }, [programFilter, programOptions])

  useEffect(() => {
    if (
      offeringFilter !== ALL &&
      !offeringOptions.some((option) => option.id === offeringFilter)
    ) {
      setOfferingFilter(ALL)
    }
  }, [offeringFilter, offeringOptions])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchFilter(searchInput)
      setPage(1)
    }, 200)
    return () => window.clearTimeout(handle)
  }, [searchInput])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (departmentFilter !== ALL && row.departmentId !== departmentFilter) {
        return false
      }
      if (kindFilter !== "all" && row.programKind !== kindFilter) {
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
      if (addonTypeFilter !== ALL && row.addonType !== addonTypeFilter) {
        return false
      }
      if (
        paymentStatusFilter !== ALL &&
        row.status !== paymentStatusFilter
      ) {
        return false
      }
      if (
        !matchesText(row.participantName, searchFilter) &&
        !matchesText(row.contactName, searchFilter) &&
        !matchesText(row.contactEmail, searchFilter) &&
        !matchesText(row.contactPhone, searchFilter) &&
        !matchesText(row.addonType, searchFilter)
      ) {
        return false
      }
      return true
    })
  }, [
    rows,
    departmentFilter,
    kindFilter,
    programFilter,
    offeringFilter,
    statusFilter,
    addonTypeFilter,
    paymentStatusFilter,
    searchFilter,
  ])

  const pageRows = slicePageItems(filteredRows, page, pageSize)

  useEffect(() => {
    setPage(1)
  }, [
    departmentFilter,
    kindFilter,
    programFilter,
    offeringFilter,
    statusFilter,
    addonTypeFilter,
    paymentStatusFilter,
  ])

  const filtersActive =
    departmentFilter !== ALL ||
    kindFilter !== "all" ||
    programFilter !== ALL ||
    offeringFilter !== ALL ||
    statusFilter !== "active" ||
    addonTypeFilter !== ALL ||
    paymentStatusFilter !== ALL ||
    Boolean(searchFilter)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5 sm:min-w-[12rem] sm:flex-1">
          <Label htmlFor="addons-search">Search</Label>
          <Input
            id="addons-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Contact, participant, or add-on"
          />
        </div>
        <div className="space-y-1.5 sm:w-44">
          <Label>Department</Label>
          <Select
            value={departmentFilter}
            onValueChange={(value) => {
              setDepartmentFilter(value)
              setProgramFilter(ALL)
              setOfferingFilter(ALL)
            }}
          >
            <SelectTrigger>
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
        <div className="space-y-1.5 sm:w-36">
          <Label htmlFor="addons-kind">Type</Label>
          <Select
            value={kindFilter}
            onValueChange={(value) => {
              setKindFilter(value as "all" | "academic" | "seasonal")
              setProgramFilter(ALL)
              setOfferingFilter(ALL)
            }}
          >
            <SelectTrigger id="addons-kind">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="academic">Academic</SelectItem>
              <SelectItem value="seasonal">Seasonal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:w-44">
          <Label>{reportLabels.containerSingular}</Label>
          <Select
            value={programFilter}
            onValueChange={(value) => {
              setProgramFilter(value)
              setOfferingFilter(ALL)
            }}
          >
            <SelectTrigger>
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
        <div className="space-y-1.5 sm:w-44">
          <Label>{reportLabels.offeringSingular}</Label>
          <Select value={offeringFilter} onValueChange={setOfferingFilter}>
            <SelectTrigger>
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
        <div className="space-y-1.5 sm:w-36">
          <Label>Program Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as OfferingActivityFilter)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value={ALL}>All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:w-44">
          <Label>Add-on Type</Label>
          <Select value={addonTypeFilter} onValueChange={setAddonTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {addonTypeOptions.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:w-36">
          <Label>Payment Status</Label>
          <Select
            value={paymentStatusFilter}
            onValueChange={(value) =>
              setPaymentStatusFilter(value as PaymentStatusFilter)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
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
            className="sm:mb-0.5"
            onClick={() => {
              setDepartmentFilter(ALL)
              setKindFilter("all")
              setProgramFilter(ALL)
              setOfferingFilter(ALL)
              setStatusFilter("active")
              setAddonTypeFilter(ALL)
              setPaymentStatusFilter(ALL)
              setSearchInput("")
              setSearchFilter("")
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Participant</TableHead>
              <TableHead>{reportLabels.containerSingular}</TableHead>
              <TableHead>{reportLabels.offeringSingular}</TableHead>
              <TableHead>Add-on Type</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Amount Due</TableHead>
              <TableHead className="text-right">Amount Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={TABLE_COLSPAN} className="p-0">
                  <Card className="border-0 shadow-none">
                    <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                      <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                      <p className="font-medium">No add-ons found</p>
                      <p className="max-w-md text-sm text-muted-foreground">
                        Purchased materials, lunch, uniforms, field trips, and
                        other extras will appear here.
                      </p>
                    </CardContent>
                  </Card>
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="min-w-[12rem] align-top">
                    <div className="space-y-0.5">
                      {row.contactProfileId ? (
                        <Link
                          href={contactProfileHref(row.contactProfileId)}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.contactName}
                        </Link>
                      ) : (
                        <span className="font-medium">{row.contactName}</span>
                      )}
                      {row.contactEmail ? (
                        <div className="text-xs text-muted-foreground">
                          {row.contactEmail}
                        </div>
                      ) : null}
                      {row.contactPhone ? (
                        <div className="text-xs text-muted-foreground">
                          {row.contactPhone}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[10rem] font-medium align-top">
                    {row.participantName}
                  </TableCell>
                  <TableCell className="whitespace-nowrap align-top">
                    {row.programName}
                  </TableCell>
                  <TableCell className="whitespace-nowrap align-top">
                    {row.offeringName}
                  </TableCell>
                  <TableCell className="whitespace-nowrap align-top">
                    {row.addonType}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap align-top">
                    {formatQuantity(row.quantity)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap align-top font-medium">
                    {formatCurrency(row.amountDue)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap align-top">
                    {formatCurrency(row.amountPaid)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap align-top">
                    {formatCurrency(row.balance)}
                  </TableCell>
                  <TableCell className="align-top">
                    {statusBadge(row.status)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filteredRows.length > 0 ? (
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={filteredRows.length}
          entryLabel="add-ons"
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
