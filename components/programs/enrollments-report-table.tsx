"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Users } from "lucide-react"

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
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { participantProfileHref } from "@/lib/programs/participant-profile-path"
import { getReportHierarchyLabels } from "@/lib/programs/program-display-labels"
import {
  DEFAULT_LIST_PAGE_SIZE,
  slicePageItems,
} from "@/lib/ui/list-pagination"
import { useProgramKindReportPreset } from "@/hooks/use-program-kind-report-preset"
import type {
  EnrollmentRowStatus,
  EnrollmentsReportTableRow,
  OfferingActivityStatus,
} from "@/lib/programs/enrollments-report-types"

export type {
  EnrollmentRowStatus,
  EnrollmentsReportTableRow,
  OfferingActivityStatus,
}

type OfferingActivityFilter = "all" | OfferingActivityStatus

const ALL = "all"

function matchesText(value: string | null | undefined, filter: string) {
  const needle = filter.trim().toLowerCase()
  if (!needle) return true
  return (value || "").toLowerCase().includes(needle)
}

function uniqueOptions(
  rows: EnrollmentsReportTableRow[],
  getId: (row: EnrollmentsReportTableRow) => string | null,
  getLabel: (row: EnrollmentsReportTableRow) => string
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

export function EnrollmentsReportTable({
  rows,
  emptyMessage = "No enrollments found",
  emptyDescription = "Try clearing filters, or enrollments will appear here after registration.",
  lockedProgramId,
}: {
  rows: EnrollmentsReportTableRow[]
  emptyMessage?: string
  emptyDescription?: string
  lockedProgramId?: string
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE)
  const [searchInput, setSearchInput] = useState("")
  const [searchFilter, setSearchFilter] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState(ALL)
  const { kindFilter: urlKindFilter, setKindFilter } =
    useProgramKindReportPreset()
  const kindFilter = lockedProgramId ? "all" : urlKindFilter
  const [programFilter, setProgramFilter] = useState(lockedProgramId || ALL)
  const [offeringFilter, setOfferingFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] =
    useState<OfferingActivityFilter>("active")

  useEffect(() => {
    if (lockedProgramId) return
    setProgramFilter(ALL)
    setOfferingFilter(ALL)
  }, [kindFilter, lockedProgramId])

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

  const safeProgramFilter = useMemo(() => {
    if (lockedProgramId) return lockedProgramId
    if (programFilter === ALL) return ALL
    return programOptions.some((option) => option.id === programFilter)
      ? programFilter
      : ALL
  }, [lockedProgramId, programFilter, programOptions])

  const offeringOptions = useMemo(() => {
    let scoped = rows
    if (departmentFilter !== ALL) {
      scoped = scoped.filter((row) => row.departmentId === departmentFilter)
    }
    if (kindFilter !== "all") {
      scoped = scoped.filter((row) => row.programKind === kindFilter)
    }
    if (safeProgramFilter !== ALL) {
      scoped = scoped.filter((row) => row.programId === safeProgramFilter)
    }
    return uniqueOptions(
      scoped,
      (row) => row.offeringId,
      (row) => row.offeringName
    )
  }, [rows, departmentFilter, kindFilter, safeProgramFilter])

  const safeOfferingFilter = useMemo(() => {
    if (offeringFilter === ALL) return ALL
    return offeringOptions.some((option) => option.id === offeringFilter)
      ? offeringFilter
      : ALL
  }, [offeringFilter, offeringOptions])

  useEffect(() => {
    if (programFilter !== safeProgramFilter) {
      setProgramFilter(safeProgramFilter)
    }
  }, [programFilter, safeProgramFilter])

  useEffect(() => {
    if (offeringFilter !== safeOfferingFilter) {
      setOfferingFilter(safeOfferingFilter)
    }
  }, [offeringFilter, safeOfferingFilter])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchFilter(searchInput)
      setPage((current) => (current === 1 ? current : 1))
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
      if (safeProgramFilter !== ALL && row.programId !== safeProgramFilter) {
        return false
      }
      if (safeOfferingFilter !== ALL && row.offeringId !== safeOfferingFilter) {
        return false
      }
      if (statusFilter !== ALL && row.offeringActivity !== statusFilter) {
        return false
      }
      if (
        !matchesText(row.participantName, searchFilter) &&
        !matchesText(row.contactName, searchFilter) &&
        !matchesText(row.contactEmail, searchFilter) &&
        !matchesText(row.contactPhone, searchFilter)
      ) {
        return false
      }
      return true
    })
  }, [
    rows,
    departmentFilter,
    kindFilter,
    safeProgramFilter,
    safeOfferingFilter,
    statusFilter,
    searchFilter,
  ])

  const pageRows = slicePageItems(filteredRows, page, pageSize)

  useEffect(() => {
    setPage((current) => (current === 1 ? current : 1))
  }, [
    departmentFilter,
    kindFilter,
    safeProgramFilter,
    safeOfferingFilter,
    statusFilter,
  ])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5 sm:min-w-[12rem] sm:flex-1">
          <Label htmlFor="enrollments-search">Search</Label>
          <Input
            id="enrollments-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Contact or participant"
          />
        </div>
        {lockedProgramId ? null : (
          <>
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
            <div className="space-y-1.5 sm:w-40">
              <Label>Type</Label>
              <Select
                value={kindFilter}
                onValueChange={(value) => {
                  setKindFilter(value as "all" | "academic" | "seasonal")
                  setProgramFilter(ALL)
                  setOfferingFilter(ALL)
                }}
              >
                <SelectTrigger>
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
                value={safeProgramFilter}
                onValueChange={(value) => setProgramFilter(value)}
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
          </>
        )}
        <div className="space-y-1.5 sm:w-44">
          <Label>{reportLabels.offeringSingular}</Label>
          <Select
            value={safeOfferingFilter}
            onValueChange={(value) => setOfferingFilter(value)}
          >
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
          <Label>Status</Label>
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
          {(departmentFilter !== ALL ||
          (!lockedProgramId && kindFilter !== "all") ||
          (!lockedProgramId && safeProgramFilter !== ALL) ||
          safeOfferingFilter !== ALL ||
          statusFilter !== "active" ||
          searchFilter) && (
          <Button
            type="button"
            variant="ghost"
            className="sm:mb-0.5"
            onClick={() => {
              setDepartmentFilter(ALL)
              if (!lockedProgramId) {
                setKindFilter("all")
                setProgramFilter(ALL)
              }
              setOfferingFilter(ALL)
              setStatusFilter("active")
              setSearchInput("")
              setSearchFilter("")
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Participant</TableHead>
              <TableHead>Date of birth</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Allergies</TableHead>
              <TableHead>Photo consent</TableHead>
              <TableHead>{reportLabels.containerSingular}</TableHead>
              <TableHead>{reportLabels.offeringSingular}</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="p-0">
                  <Card className="border-0 shadow-none">
                    <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                      <Users className="h-8 w-8 text-muted-foreground" />
                      <p className="font-medium">{emptyMessage}</p>
                      <p className="max-w-md text-sm text-muted-foreground">
                        {emptyDescription}
                      </p>
                    </CardContent>
                  </Card>
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => {
                const profileHref = row.participantPersonId
                  ? participantProfileHref(row.participantPersonId, {
                      returnTo: "/programs/reports/enrollments",
                    })
                  : null

                return (
                  <TableRow
                    key={row.id}
                    className={
                      profileHref
                        ? "cursor-pointer hover:bg-muted/40"
                        : undefined
                    }
                    onClick={() => {
                      if (!profileHref) return
                      window.location.assign(profileHref)
                    }}
                  >
                    <TableCell className="min-w-[12rem] align-top">
                      <div className="space-y-0.5">
                        {row.contactProfileId ? (
                          <Link
                            href={contactProfileHref(row.contactProfileId)}
                            prefetch={false}
                            className="font-medium text-primary hover:underline"
                            onClick={(event) => event.stopPropagation()}
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
                            <PhoneText value={row.contactPhone} empty="" />
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[10rem] font-medium align-top">
                      {row.participantName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap align-top">
                      {row.dateOfBirthLabel}
                    </TableCell>
                    <TableCell className="whitespace-nowrap align-top">
                      {row.ageLabel}
                    </TableCell>
                    <TableCell className="whitespace-nowrap align-top">
                      {row.genderLabel}
                    </TableCell>
                    <TableCell className="max-w-[14rem] align-top text-sm">
                      {row.allergiesLabel}
                    </TableCell>
                    <TableCell className="whitespace-nowrap align-top">
                      {row.photoConsentLabel}
                    </TableCell>
                    <TableCell className="min-w-[10rem] align-top text-sm">
                      {row.programName}
                    </TableCell>
                    <TableCell className="min-w-[8rem] align-top text-sm">
                      {row.offeringName}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge
                        variant={
                          row.enrollmentStatus === "active"
                            ? "default"
                            : "outline"
                        }
                      >
                        {row.enrollmentStatus === "active"
                          ? "Active"
                          : "Cancelled"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {filteredRows.length > 0 ? (
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={filteredRows.length}
          entryLabel="enrollments"
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
