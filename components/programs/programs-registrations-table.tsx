"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Clock, Users } from "lucide-react"

import { RegistrationRowActions } from "@/components/programs/registration-row-actions"
import { Badge } from "@/components/ui/badge"
import { PhoneText } from "@/components/ui/phone-text"
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
import { TableColumnHeaderFilter } from "@/components/ui/table-column-header-filter"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  getReportHierarchyLabels,
} from "@/lib/programs/program-display-labels"
import type { ProgramKind } from "@/lib/programs/program-kind"
import type { AdditionalFeeItem } from "@/lib/programs/registration-report-helpers"
import {
  DEFAULT_LIST_PAGE_SIZE,
  slicePageItems,
} from "@/lib/ui/list-pagination"
import { useProgramKindReportPreset } from "@/hooks/use-program-kind-report-preset"

export type OfferingActivityStatus = "active" | "closed"
export type FamilyRegistrationStatus = "active" | "cancelled"

export type ProgramsRegistrationTableRow = {
  id: string
  type: "enrollment" | "waitlist"
  contactName: string
  contactProfileId: string | null
  contactEmail: string | null
  contactPhone: string | null
  participantCount: number
  participantNames: string[]
  departmentId: string | null
  departmentName: string
  programId: string | null
  programName: string
  programKind: ProgramKind
  offeringIds: string[]
  offeringNames: string[]
  offeringActivity: OfferingActivityStatus
  registeredDateLabel: string
  registrationFeeLabel: string
  registrationPaidLabel: string
  additionalFees: AdditionalFeeItem[]
  registrationStatus: FamilyRegistrationStatus
  primaryRegistrationId: string
  enrollmentStatus: string | null
  totalAmount: number
  amountPaid: number
  notes: string | null
}

type OfferingActivityFilter = "all" | OfferingActivityStatus

const ALL = "all"

function matchesText(value: string | null | undefined, filter: string) {
  const needle = filter.trim().toLowerCase()
  if (!needle) return true
  return (value || "").toLowerCase().includes(needle)
}

function formatCurrencyAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function AdditionalFeesCell({ fees }: { fees: AdditionalFeeItem[] }) {
  if (!fees.length) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <div className="space-y-1">
      {fees.map((fee, index) => (
        <div key={`${fee.label}-${index}`} className="text-sm">
          <span className="text-foreground">{fee.label}</span>
          <span className="text-muted-foreground">
            {" "}
            {formatCurrencyAmount(fee.amount)}
          </span>
        </div>
      ))}
    </div>
  )
}

function hasOpenBalance(row: ProgramsRegistrationTableRow) {
  if (row.type !== "enrollment") return false
  if (row.registrationStatus === "cancelled") return false
  return row.totalAmount - row.amountPaid > 0.005
}

function uniqueOptions(
  rows: ProgramsRegistrationTableRow[],
  getIds: (row: ProgramsRegistrationTableRow) => Array<string | null>,
  getLabel: (row: ProgramsRegistrationTableRow, id: string) => string
) {
  const map = new Map<string, string>()
  for (const row of rows) {
    for (const id of getIds(row)) {
      if (!id || map.has(id)) continue
      map.set(id, getLabel(row, id))
    }
  }
  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function ProgramsRegistrationsTable({
  rows,
  emptyMessage = "No registrations found",
  emptyDescription = "Try clearing filters, or registrations will appear here after enrollment.",
}: {
  rows: ProgramsRegistrationTableRow[]
  emptyMessage?: string
  emptyDescription?: string
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE)
  const [participantFilterInput, setParticipantFilterInput] = useState("")
  const [participantFilter, setParticipantFilter] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState(ALL)
  const { kindFilter, setKindFilter } = useProgramKindReportPreset()
  const [programFilter, setProgramFilter] = useState(ALL)
  const [offeringFilter, setOfferingFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] =
    useState<OfferingActivityFilter>("active")

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
        (row) => [row.departmentId],
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
      (row) => [row.programId],
      (row) => row.programName
    )
  }, [rows, departmentFilter, kindFilter])

  const offeringOptions = useMemo(() => {
    let scoped = rows
    if (departmentFilter !== ALL) {
      scoped = scoped.filter((row) => row.departmentId === departmentFilter)
    }
    if (kindFilter !== "all") {
      scoped = scoped.filter((row) => row.programKind === kindFilter)
    }
    if (programFilter !== ALL) {
      scoped = scoped.filter((row) => row.programId === programFilter)
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
  }, [rows, departmentFilter, kindFilter, programFilter, reportLabels.offeringSingular])

  useEffect(() => {
    if (
      programFilter !== ALL &&
      !programOptions.some((option) => option.id === programFilter)
    ) {
      setProgramFilter(ALL)
      setOfferingFilter(ALL)
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

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const participantBlob = row.participantNames.join(" ")
      if (!matchesText(participantBlob, participantFilter)) return false
      if (
        departmentFilter !== ALL &&
        row.departmentId !== departmentFilter
      ) {
        return false
      }
      if (kindFilter !== "all" && row.programKind !== kindFilter) {
        return false
      }
      if (programFilter !== ALL && row.programId !== programFilter) {
        return false
      }
      if (
        offeringFilter !== ALL &&
        !row.offeringIds.includes(offeringFilter)
      ) {
        return false
      }
      if (statusFilter !== ALL && row.offeringActivity !== statusFilter) {
        return false
      }
      return true
    })
  }, [
    rows,
    participantFilter,
    departmentFilter,
    kindFilter,
    programFilter,
    offeringFilter,
    statusFilter,
  ])

  const activeEnrollmentCount = useMemo(
    () =>
      filteredRows.reduce((sum, row) => {
        if (row.type !== "enrollment") return sum
        if (row.offeringActivity !== "active") return sum
        if (row.registrationStatus !== "active") return sum
        return sum + row.participantCount
      }, 0),
    [filteredRows]
  )

  const openBalanceCount = useMemo(
    () => filteredRows.filter((row) => hasOpenBalance(row)).length,
    [filteredRows]
  )

  useEffect(() => {
    setPage((current) => (current === 1 ? current : 1))
  }, [
    participantFilter,
    departmentFilter,
    kindFilter,
    programFilter,
    offeringFilter,
    statusFilter,
  ])

  const pageRows = useMemo(
    () => slicePageItems(filteredRows, page, pageSize),
    [filteredRows, page, pageSize]
  )

  const filtersActive =
    Boolean(participantFilter.trim()) ||
    departmentFilter !== ALL ||
    kindFilter !== "all" ||
    programFilter !== ALL ||
    offeringFilter !== ALL ||
    statusFilter !== ALL

  function clearTopFilters() {
    setDepartmentFilter(ALL)
    setKindFilter("all")
    setProgramFilter(ALL)
    setOfferingFilter(ALL)
    setStatusFilter("active")
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 px-4 pt-4 sm:grid-cols-2 sm:px-6 sm:pt-6">
        <Card className="h-full">
          <CardContent className="flex h-full items-center gap-4 p-4">
            <div className="rounded-full bg-muted p-3 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Active Enrollment</p>
              <p className="text-2xl font-bold text-foreground">
                {activeEnrollmentCount}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardContent className="flex h-full items-center gap-4 p-4">
            <div className="rounded-full bg-muted p-3 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Open Balances</p>
              <p className="text-2xl font-bold text-foreground">
                {openBalanceCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3 px-4 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="registrations-department">Department</Label>
            <Select
              value={departmentFilter}
              onValueChange={(value) => {
                setDepartmentFilter(value)
                setProgramFilter(ALL)
                setOfferingFilter(ALL)
              }}
            >
              <SelectTrigger id="registrations-department">
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

          <div className="space-y-1.5">
            <Label htmlFor="registrations-kind">Type</Label>
            <Select
              value={kindFilter}
              onValueChange={(value) => {
              setKindFilter(value as "all" | "academic" | "seasonal")
              setProgramFilter(ALL)
              setOfferingFilter(ALL)
              }}
            >
              <SelectTrigger id="registrations-kind">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="academic">Academic</SelectItem>
                <SelectItem value="seasonal">Seasonal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="registrations-program">
              {reportLabels.containerSingular}
            </Label>
            <Select
              value={programFilter}
              onValueChange={(value) => {
                setProgramFilter(value)
                setOfferingFilter(ALL)
              }}
            >
              <SelectTrigger id="registrations-program">
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

          <div className="space-y-1.5">
            <Label htmlFor="registrations-offering">
              {reportLabels.offeringSingular}
            </Label>
            <Select value={offeringFilter} onValueChange={setOfferingFilter}>
              <SelectTrigger id="registrations-offering">
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

          <div className="space-y-1.5">
            <Label htmlFor="registrations-status">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as OfferingActivityFilter)
              }
            >
              <SelectTrigger id="registrations-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {departmentFilter !== ALL ||
        programFilter !== ALL ||
        offeringFilter !== ALL ||
        statusFilter !== "active" ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearTopFilters}
            >
              Reset filters
            </Button>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Registration date</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-center"># Participants</TableHead>
              <TableHead>
                <TableColumnHeaderFilter
                  label="Participants"
                  active={Boolean(participantFilter.trim())}
                >
                  {({ close }) => (
                    <div className="space-y-2">
                      <Input
                        placeholder="Search by name"
                        value={participantFilterInput}
                        onChange={(event) => {
                          setParticipantFilterInput(event.target.value)
                          setParticipantFilter(event.target.value)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            setParticipantFilter(participantFilterInput)
                            close()
                          }
                        }}
                      />
                      {participantFilter ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => {
                            setParticipantFilterInput("")
                            setParticipantFilter("")
                            close()
                          }}
                        >
                          Clear
                        </Button>
                      ) : null}
                    </div>
                  )}
                </TableColumnHeaderFilter>
              </TableHead>
              <TableHead>Registration fee</TableHead>
              <TableHead>Total paid</TableHead>
              <TableHead>Additional fees</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[90px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-40 text-center">
                  <div className="mx-auto flex max-w-md flex-col items-center gap-1 py-4">
                    <p className="font-medium text-foreground">{emptyMessage}</p>
                    <p className="text-sm text-muted-foreground">
                      {filtersActive
                        ? "No registrations match these filters."
                        : emptyDescription}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {row.registeredDateLabel}
                  </TableCell>

                  <TableCell>
                    <div>
                      {row.contactProfileId ? (
                        <Link
                          href={contactProfileHref(row.contactProfileId)}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.contactName}
                        </Link>
                      ) : (
                        <span className="font-medium text-foreground">
                          {row.contactName}
                        </span>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {row.contactEmail || "No email"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <PhoneText value={row.contactPhone} empty="No phone" />
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-center font-medium">
                    {row.participantCount}
                  </TableCell>

                  <TableCell>
                    <div className="space-y-0.5">
                      {row.participantNames.map((name) => (
                        <div
                          key={`${row.id}-${name}`}
                          className="text-sm text-foreground"
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  </TableCell>

                  <TableCell className="font-medium whitespace-nowrap">
                    {row.registrationFeeLabel}
                  </TableCell>

                  <TableCell className="font-medium whitespace-nowrap">
                    {row.registrationPaidLabel}
                  </TableCell>

                  <TableCell className="min-w-[10rem]">
                    <AdditionalFeesCell fees={row.additionalFees} />
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={
                        row.registrationStatus === "active"
                          ? "default"
                          : "outline"
                      }
                    >
                      {row.registrationStatus === "active"
                        ? "Active"
                        : "Cancelled"}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <RegistrationRowActions
                      registrationId={row.primaryRegistrationId}
                      recordType={row.type}
                      participantName={row.participantNames[0] || row.contactName}
                      enrollmentStatus={row.enrollmentStatus}
                      totalAmount={row.totalAmount}
                      amountPaid={row.amountPaid}
                      notes={row.notes}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filteredRows.length > 0 ? (
        <div className="px-4 pb-4 sm:px-6 sm:pb-6">
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
        </div>
      ) : null}
    </div>
  )
}
