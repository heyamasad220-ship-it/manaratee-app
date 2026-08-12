"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Users } from "lucide-react"

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
import {
  PROGRAM_LABEL,
  YEAR_SEASON_LABEL,
} from "@/lib/programs/program-display-labels"
import {
  DEFAULT_LIST_PAGE_SIZE,
  slicePageItems,
} from "@/lib/ui/list-pagination"

export type OfferingActivityStatus = "active" | "closed"
export type EnrollmentRowStatus = "active" | "cancelled"

export type EnrollmentsReportTableRow = {
  id: string
  contactName: string
  contactProfileId: string | null
  contactEmail: string | null
  contactPhone: string | null
  participantName: string
  dateOfBirthLabel: string
  ageLabel: string
  genderLabel: string
  allergiesLabel: string
  emergencyContactLabel: string
  photoConsentLabel: string
  enrollmentStatus: EnrollmentRowStatus
  departmentId: string | null
  departmentName: string
  programId: string | null
  programName: string
  offeringId: string | null
  offeringName: string
  offeringActivity: OfferingActivityStatus
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
}: {
  rows: EnrollmentsReportTableRow[]
  emptyMessage?: string
  emptyDescription?: string
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE)
  const [searchInput, setSearchInput] = useState("")
  const [searchFilter, setSearchFilter] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState(ALL)
  const [programFilter, setProgramFilter] = useState(ALL)
  const [offeringFilter, setOfferingFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] =
    useState<OfferingActivityFilter>("active")

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

  const offeringOptions = useMemo(() => {
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
      if (programFilter !== ALL && row.programId !== programFilter) {
        return false
      }
      if (offeringFilter !== ALL && row.offeringId !== offeringFilter) {
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
    programFilter,
    offeringFilter,
    statusFilter,
    searchFilter,
  ])

  const pageRows = slicePageItems(filteredRows, page, pageSize)

  useEffect(() => {
    setPage(1)
  }, [departmentFilter, programFilter, offeringFilter, statusFilter])

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
        <div className="space-y-1.5 sm:w-44">
          <Label>Department</Label>
          <Select
            value={departmentFilter}
            onValueChange={(value) => setDepartmentFilter(value)}
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
        <div className="space-y-1.5 sm:w-44">
          <Label>{YEAR_SEASON_LABEL}</Label>
          <Select
            value={programFilter}
            onValueChange={(value) => setProgramFilter(value)}
          >
            <SelectTrigger>
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
          <Label>{PROGRAM_LABEL}</Label>
          <Select
            value={offeringFilter}
            onValueChange={(value) => setOfferingFilter(value)}
          >
            <SelectTrigger>
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
          programFilter !== ALL ||
          offeringFilter !== ALL ||
          statusFilter !== "active" ||
          searchFilter) && (
          <Button
            type="button"
            variant="ghost"
            className="sm:mb-0.5"
            onClick={() => {
              setDepartmentFilter(ALL)
              setProgramFilter(ALL)
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
              <TableHead>Emergency contact</TableHead>
              <TableHead>Photo consent</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="p-0">
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
                  <TableCell className="max-w-[14rem] align-top text-sm">
                    {row.emergencyContactLabel}
                  </TableCell>
                  <TableCell className="whitespace-nowrap align-top">
                    {row.photoConsentLabel}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge
                      variant={
                        row.enrollmentStatus === "active" ? "default" : "outline"
                      }
                    >
                      {row.enrollmentStatus === "active"
                        ? "Active"
                        : "Cancelled"}
                    </Badge>
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
