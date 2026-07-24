"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatOfferingEnrollmentLabel } from "@/lib/programs/program-catalog-capacity"
import {
  PROGRAM_LABEL,
  PROGRAM_LABEL_PLURAL,
  YEAR_SEASON_LABEL,
} from "@/lib/programs/program-display-labels"
import type { OfferingDeliveryFormat } from "@/lib/programs/program-offering-attributes"
import {
  formatOfferingDateRange,
  isOfferingEnrollmentOpen,
} from "@/lib/programs/program-offering-display"
import {
  DEFAULT_NEW_OFFERING_INHERIT_FLAGS,
  resolveEffectiveOfferingDates,
  type ProgramDefaultsSource,
} from "@/lib/programs/program-offering-inherit"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import {
  OFFERING_DELIVERY_FORMAT_LABELS,
  OFFERING_DELIVERY_FORMAT_OPTIONS,
  PROGRAM_OFFERING_STATUS_LABELS,
  type ProgramOffering,
} from "@/lib/programs/program-offering-types"
import type { Program } from "@/lib/programs/program-types"
import { cn } from "@/lib/utils"

const OFFERING_TYPE_LABELS: Record<string, string> = {
  standard: "Standard",
  academic_year: "Academic year",
  summer: "Summer",
  season: "Season",
  recurring: "Recurring",
}

/** Minimal year/season fields needed to list and create programs (offerings). */
export type ProgramOfferingsListProgram = Pick<
  Program,
  | "id"
  | "status"
  | "start_date"
  | "end_date"
  | "enrollment_open_date"
  | "enrollment_close_date"
>

export type ProgramDetailOfferingRow = {
  offering: ProgramOffering
  enrolled: number
}

export function ProgramOfferingsListPanel({
  program,
  rows,
  archivedCount,
  showArchived,
  addDisabled = false,
}: {
  program: ProgramOfferingsListProgram
  rows: ProgramDetailOfferingRow[]
  archivedCount: number
  showArchived?: ProgramDetailOfferingRow[]
  /** When true, hide/disable Add (e.g. “All years” filter). */
  addDisabled?: boolean
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = React.useState(false)
  const [offeringName, setOfferingName] = React.useState("")
  const [deliveryFormat, setDeliveryFormat] =
    React.useState<OfferingDeliveryFormat>("in_person")
  const [inheritDates, setInheritDates] = React.useState(
    DEFAULT_NEW_OFFERING_INHERIT_FLAGS.inherit_dates
  )
  const [inheritEligibility, setInheritEligibility] = React.useState(
    DEFAULT_NEW_OFFERING_INHERIT_FLAGS.inherit_eligibility
  )
  const [inheritEnrollment, setInheritEnrollment] = React.useState(
    DEFAULT_NEW_OFFERING_INHERIT_FLAGS.inherit_enrollment
  )
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)

  function resetCreateForm() {
    setOfferingName("")
    setDeliveryFormat("in_person")
    setInheritDates(DEFAULT_NEW_OFFERING_INHERIT_FLAGS.inherit_dates)
    setInheritEligibility(DEFAULT_NEW_OFFERING_INHERIT_FLAGS.inherit_eligibility)
    setInheritEnrollment(DEFAULT_NEW_OFFERING_INHERIT_FLAGS.inherit_enrollment)
    setCreateError(null)
  }

  async function handleCreateOffering() {
    const name = offeringName.trim()
    if (!name) {
      setCreateError(`${PROGRAM_LABEL} name is required.`)
      return
    }

    setCreating(true)
    setCreateError(null)

    try {
      const { createProgramOffering } = await import(
        "@/lib/programs/program-offering-actions"
      )
      const created = await createProgramOffering(program.id, {
        name,
        offering_type: "standard",
        start_date: program.start_date,
        end_date: program.end_date,
        enrollment_open_date: program.enrollment_open_date,
        enrollment_close_date: program.enrollment_close_date,
        status: program.status === "draft" ? "draft" : "active",
        inherit_dates: inheritDates,
        inherit_eligibility: inheritEligibility,
        inherit_enrollment: inheritEnrollment,
        attributes: {
          delivery_format: deliveryFormat,
        },
      })
      setAddOpen(false)
      resetCreateForm()
      router.push(programOfferingManageHref(program.id, created.id as string))
      router.refresh()
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : `Could not create ${PROGRAM_LABEL.toLowerCase()}.`
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {PROGRAM_LABEL_PLURAL}
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage {PROGRAM_LABEL_PLURAL.toLowerCase()}, pricing, sessions, and
              staff assignments.
            </p>
          </div>
          <Button
            size="sm"
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={addDisabled}
            title={
              addDisabled
                ? `Select a ${YEAR_SEASON_LABEL.toLowerCase()} to add a ${PROGRAM_LABEL.toLowerCase()}.`
                : undefined
            }
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add {PROGRAM_LABEL}
          </Button>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No {PROGRAM_LABEL_PLURAL.toLowerCase()} yet. Add a{" "}
              {PROGRAM_LABEL.toLowerCase()} to open registration, fees, and
              schedule.
            </p>
            {!addDisabled ? (
              <Button
                type="button"
                size="sm"
                className="mt-4"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add first {PROGRAM_LABEL.toLowerCase()}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{PROGRAM_LABEL}</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ offering, enrolled }) => {
                  const effectiveDates = resolveEffectiveOfferingDates(
                    offering,
                    program as ProgramDefaultsSource
                  )
                  const enrollmentOpen = isOfferingEnrollmentOpen({
                    enrollment_open_date: effectiveDates.enrollment_open_date,
                    enrollment_close_date: effectiveDates.enrollment_close_date,
                  })
                  const dateRange = formatOfferingDateRange(
                    effectiveDates.start_date,
                    effectiveDates.end_date
                  )
                  return (
                    <TableRow key={offering.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={programOfferingManageHref(program.id, offering.id)}
                          className="text-sky-600 hover:text-sky-700 hover:underline"
                        >
                          {offering.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {
                          OFFERING_DELIVERY_FORMAT_LABELS[
                            offering.delivery_format ?? "in_person"
                          ]
                        }
                      </TableCell>
                      <TableCell>
                        {OFFERING_TYPE_LABELS[offering.offering_type] ||
                          offering.offering_type}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p>{dateRange}</p>
                          {offering.inherit_dates === true ? (
                            <p className="text-xs text-muted-foreground">
                              From {YEAR_SEASON_LABEL.toLowerCase()}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p>
                            {formatOfferingEnrollmentLabel(enrolled, offering)}
                          </p>
                          <p
                            className={cn(
                              "text-xs",
                              enrollmentOpen
                                ? "text-emerald-700"
                                : "text-muted-foreground"
                            )}
                          >
                            {enrollmentOpen
                              ? "Registration open"
                              : "Registration closed"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full">
                          {PROGRAM_OFFERING_STATUS_LABELS[offering.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {showArchived && showArchived.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Archived ({archivedCount})
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {showArchived.map(({ offering }) => (
                <li key={offering.id}>
                  <Link
                    href={programOfferingManageHref(program.id, offering.id)}
                    className="text-sky-600 hover:text-sky-700 hover:underline"
                  >
                    {offering.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open)
            if (!open) resetCreateForm()
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add {PROGRAM_LABEL.toLowerCase()}</DialogTitle>
              <DialogDescription>
                Create a class or track. {YEAR_SEASON_LABEL} defaults are used
                unless you turn off inherit below. Fees and schedule are set after
                create.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="detail-offering-name">Name</Label>
                <Input
                  id="detail-offering-name"
                  value={offeringName}
                  onChange={(event) => setOfferingName(event.target.value)}
                  placeholder="e.g. Tajweed Beginner — Centre"
                  disabled={creating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="detail-offering-delivery">Delivery</Label>
                <select
                  id="detail-offering-delivery"
                  value={deliveryFormat}
                  onChange={(event) =>
                    setDeliveryFormat(
                      event.target.value as OfferingDeliveryFormat
                    )
                  }
                  disabled={creating}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {OFFERING_DELIVERY_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Create separate {PROGRAM_LABEL_PLURAL.toLowerCase()} for on-site
                  and online when instructors or capacity differ.
                </p>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">
                    Use {YEAR_SEASON_LABEL.toLowerCase()} defaults
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Turn off a group only when this{" "}
                    {PROGRAM_LABEL.toLowerCase()} needs different dates,
                    eligibility, or enrollment settings.
                  </p>
                </div>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>Dates &amp; enrollment window</span>
                  <Switch
                    checked={inheritDates}
                    onCheckedChange={setInheritDates}
                    disabled={creating}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>Eligibility (age / gender)</span>
                  <Switch
                    checked={inheritEligibility}
                    onCheckedChange={setInheritEligibility}
                    disabled={creating}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>Enrollment types &amp; waitlist</span>
                  <Switch
                    checked={inheritEnrollment}
                    onCheckedChange={setInheritEnrollment}
                    disabled={creating}
                  />
                </label>
              </div>

              {createError ? (
                <p className="text-sm text-destructive">{createError}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleCreateOffering()}
                disabled={creating}
              >
                {creating ? "Creating…" : `Create ${PROGRAM_LABEL.toLowerCase()}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
