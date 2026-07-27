"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Archive, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  isSeasonalProgramKind,
  PROGRAM_KIND_LABELS,
  type ProgramKind,
} from "@/lib/programs/program-kind"
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
> & {
  program_kind?: ProgramKind | string | null
}

export type ProgramDetailOfferingRow = {
  offering: ProgramOffering
  enrolled: number
}

export function ProgramOfferingsListPanel({
  program,
  departmentId = null,
  rows,
  archivedCount,
  showArchived,
  addDisabled = false,
}: {
  program: ProgramOfferingsListProgram
  /** When set, manage links stay under the department workspace. */
  departmentId?: string | null
  rows: ProgramDetailOfferingRow[]
  archivedCount: number
  showArchived?: ProgramDetailOfferingRow[]
  /** When true, hide/disable Add (e.g. “All years” filter). */
  addDisabled?: boolean
}) {
  const router = useRouter()
  const parentIsSeasonal = isSeasonalProgramKind(program.program_kind)
  const [addOpen, setAddOpen] = React.useState(false)
  const [createKind, setCreateKind] = React.useState<ProgramKind>(
    parentIsSeasonal ? "seasonal" : "academic"
  )
  const [offeringName, setOfferingName] = React.useState("")
  const [deliveryFormat, setDeliveryFormat] =
    React.useState<OfferingDeliveryFormat>("in_person")
  const [openEnrollment, setOpenEnrollment] = React.useState(parentIsSeasonal)
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)

  const [rowAction, setRowAction] = React.useState<{
    type: "delete" | "archive"
    offering: ProgramOffering
    enrolled: number
  } | null>(null)
  const [rowBusy, setRowBusy] = React.useState(false)
  const [rowError, setRowError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!addOpen) return
    const nextKind = parentIsSeasonal ? "seasonal" : "academic"
    setCreateKind(nextKind)
    setOpenEnrollment(nextKind === "seasonal")
  }, [addOpen, parentIsSeasonal])

  function resetCreateForm() {
    setOfferingName("")
    setDeliveryFormat("in_person")
    const nextKind = parentIsSeasonal ? "seasonal" : "academic"
    setCreateKind(nextKind)
    setOpenEnrollment(nextKind === "seasonal")
    setCreateError(null)
  }

  async function handleCreate() {
    const name = offeringName.trim()
    if (!name) {
      setCreateError("Name is required.")
      return
    }

    if (createKind === "seasonal" && !departmentId) {
      setCreateError("Seasonal camps must be created from a department.")
      return
    }

    setCreating(true)
    setCreateError(null)

    try {
      if (createKind === "seasonal") {
        const { createProgram } = await import("@/lib/programs/program-actions")
        const created = await createProgram({
          name,
          department_id: departmentId,
          program_kind: "seasonal",
          delivery_format: deliveryFormat,
          application_required: !openEnrollment,
          status: "draft",
          visibility: "public",
        })
        setAddOpen(false)
        resetCreateForm()
        if (created.offeringId) {
          router.push(
            programOfferingManageHref(created.programId, created.offeringId, {
              departmentId,
            })
          )
        } else {
          router.push(
            departmentId
              ? `/workforce/departments/${departmentId}?tab=programs&year=${created.programId}`
              : `/programs/${created.programId}`
          )
        }
        router.refresh()
        return
      }

      // Academic: add a class under this year when the year is academic.
      // If the selected year is seasonal, start a new academic year instead.
      if (parentIsSeasonal) {
        if (!departmentId) {
          setCreateError(
            "Create an academic year from Overview, then add classes there."
          )
          setCreating(false)
          return
        }
        const { createProgram } = await import("@/lib/programs/program-actions")
        const created = await createProgram({
          name,
          department_id: departmentId,
          program_kind: "academic",
          status: "draft",
          visibility: "public",
        })
        setAddOpen(false)
        resetCreateForm()
        router.push(
          `/workforce/departments/${departmentId}?tab=programs&year=${created.programId}`
        )
        router.refresh()
        return
      }

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
        inherit_dates: false,
        inherit_eligibility: false,
        inherit_enrollment: false,
        attributes: {
          delivery_format: deliveryFormat,
          application_required: !openEnrollment,
        },
      })
      setAddOpen(false)
      resetCreateForm()
      router.push(
        programOfferingManageHref(program.id, created.id as string, {
          departmentId,
        })
      )
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

  async function confirmRowAction() {
    if (!rowAction) return
    setRowBusy(true)
    setRowError(null)
    try {
      const actions = await import("@/lib/programs/program-offering-actions")
      if (rowAction.type === "delete") {
        await actions.deleteProgramOffering(rowAction.offering.id)
      } else {
        await actions.archiveProgramOffering(rowAction.offering.id)
      }
      setRowAction(null)
      router.refresh()
    } catch (error) {
      setRowError(
        error instanceof Error
          ? error.message
          : `Could not ${rowAction.type} this ${PROGRAM_LABEL.toLowerCase()}.`
      )
    } finally {
      setRowBusy(false)
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
                  <TableHead className="w-[1%] text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
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
                  const manageHref = programOfferingManageHref(
                    program.id,
                    offering.id,
                    { departmentId }
                  )
                  const canDelete = enrolled === 0
                  return (
                    <TableRow key={offering.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={manageHref}
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
                        <p>{dateRange}</p>
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
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Actions for ${offering.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={manageHref}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {canDelete ? (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => {
                                  setRowError(null)
                                  setRowAction({
                                    type: "delete",
                                    offering,
                                    enrolled,
                                  })
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onSelect={() => {
                                  setRowError(null)
                                  setRowAction({
                                    type: "archive",
                                    offering,
                                    enrolled,
                                  })
                                }}
                              >
                                <Archive className="mr-2 h-4 w-4" />
                                Archive
                              </DropdownMenuItem>
                            )}
                            {canDelete && offering.status !== "archived" ? (
                              <DropdownMenuItem
                                onSelect={() => {
                                  setRowError(null)
                                  setRowAction({
                                    type: "archive",
                                    offering,
                                    enrolled,
                                  })
                                }}
                              >
                                <Archive className="mr-2 h-4 w-4" />
                                Archive
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                    href={programOfferingManageHref(program.id, offering.id, {
                      departmentId,
                    })}
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
                {createKind === "seasonal"
                  ? "Create a camp or season product. Dates, eligibility, fees, and sessions are set on the next page — no year defaults to inherit."
                  : parentIsSeasonal
                    ? "Starts a new academic year for this department. Add classes under it afterward."
                    : `Create a class or track under this ${YEAR_SEASON_LABEL.toLowerCase()}. Fees and schedule are set after create.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(PROGRAM_KIND_LABELS) as ProgramKind[]).map(
                    (kind) => (
                      <label
                        key={kind}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm font-medium transition-colors",
                          createKind === kind
                            ? "border-sky-500 bg-sky-50/80"
                            : "hover:bg-muted/40"
                        )}
                      >
                        <input
                          type="radio"
                          name="dept-add-program-kind"
                          className="accent-sky-600"
                          checked={createKind === kind}
                          onChange={() => {
                            setCreateKind(kind)
                            setOpenEnrollment(kind === "seasonal")
                          }}
                          disabled={creating}
                        />
                        {PROGRAM_KIND_LABELS[kind]}
                      </label>
                    )
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="detail-offering-name">Name</Label>
                <Input
                  id="detail-offering-name"
                  value={offeringName}
                  onChange={(event) => setOfferingName(event.target.value)}
                  placeholder={
                    createKind === "seasonal"
                      ? "Camp or season name"
                      : "Class or track name"
                  }
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
                {createKind === "academic" ? (
                  <p className="text-xs text-muted-foreground">
                    Create separate {PROGRAM_LABEL_PLURAL.toLowerCase()} for
                    on-site and online when instructors or capacity differ.
                  </p>
                ) : null}
              </div>

              {!(createKind === "academic" && parentIsSeasonal) ? (
                <label className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm">
                  <span className="space-y-0.5">
                    <span className="block font-medium">
                      Automatically register and pay
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      No Apply / Approve step — customers register and pay
                      immediately.
                    </span>
                  </span>
                  <Switch
                    checked={openEnrollment}
                    onCheckedChange={setOpenEnrollment}
                    disabled={creating}
                  />
                </label>
              ) : null}

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
                onClick={() => void handleCreate()}
                disabled={creating}
              >
                {creating ? "Creating…" : `Create ${PROGRAM_LABEL.toLowerCase()}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={rowAction != null}
          onOpenChange={(open) => {
            if (!open && !rowBusy) {
              setRowAction(null)
              setRowError(null)
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {rowAction?.type === "delete"
                  ? `Delete ${PROGRAM_LABEL.toLowerCase()}?`
                  : `Archive ${PROGRAM_LABEL.toLowerCase()}?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {rowAction?.type === "delete" ? (
                  <>
                    Permanently delete{" "}
                    <span className="font-medium text-foreground">
                      {rowAction.offering.name}
                    </span>
                    . This only works when there are no registrations.
                  </>
                ) : (
                  <>
                    Archive{" "}
                    <span className="font-medium text-foreground">
                      {rowAction?.offering.name}
                    </span>
                    {rowAction && rowAction.enrolled > 0
                      ? ` (${rowAction.enrolled} registration${
                          rowAction.enrolled === 1 ? "" : "s"
                        }). `
                      : ". "}
                    It will move to the archived list and stay available for
                    history.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {rowError ? (
              <p className="text-sm text-destructive">{rowError}</p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={rowBusy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={rowBusy}
                className={
                  rowAction?.type === "delete"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : undefined
                }
                onClick={(event) => {
                  event.preventDefault()
                  void confirmRowAction()
                }}
              >
                {rowBusy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Working…
                  </>
                ) : rowAction?.type === "delete" ? (
                  "Delete"
                ) : (
                  "Archive"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
