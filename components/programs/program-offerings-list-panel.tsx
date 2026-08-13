"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Copy, Eye, GripVertical, Link2, Loader2, MoreHorizontal, Plus, Trash2 } from "lucide-react"

import type { ProgramGender } from "@/components/programs/edit/types"
import { ADULT_MIN_AGE } from "@/components/programs/edit/utils"
import { OfferingBasicsForm } from "@/components/programs/offering-basics-form"
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
  getHierarchyLabels,
  PROGRAM_LABEL,
  YEAR_SEASON_LABEL,
} from "@/lib/programs/program-display-labels"
import { buildCopyName } from "@/lib/programs/program-fee-plan-copy-utils"
import type { OfferingDeliveryFormat } from "@/lib/programs/program-offering-attributes"
import { isOfferingEnrollmentOpen } from "@/lib/programs/program-offering-display"
import { duplicateProgramOffering } from "@/lib/programs/program-offering-duplicate-actions"
import {
  resolveEffectiveOfferingDates,
  type ProgramDefaultsSource,
} from "@/lib/programs/program-offering-inherit"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import {
  OFFERING_DELIVERY_FORMAT_LABELS,
  type ProgramOffering,
} from "@/lib/programs/program-offering-types"
import {
  isSeasonalProgramKind,
  type ProgramKind,
} from "@/lib/programs/program-kind"
import type { Program } from "@/lib/programs/program-types"
import {
  buildProgramCustomerUrl,
  buildProgramRegistrationUrl,
} from "@/lib/programs/program-customer-url"
import { cn } from "@/lib/utils"

function formatTuitionAmount(amount: number | null | undefined) {
  if (amount == null || !Number.isFinite(amount)) return "—"
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  })
}

function moveOfferingRow<T>(items: T[], fromIndex: number, toIndex: number) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items
  }
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

function offeringRowsSignature(rows: ProgramDetailOfferingRow[]) {
  return rows
    .map(
      (row) =>
        `${row.offering.id}:${row.offering.sort_order ?? 0}:${row.offering.name}`
    )
    .join("|")
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
  primaryInstructor?: string | null
  tuitionAmount?: number | null
  daysLabel?: string | null
  timesLabel?: string | null
}

export function ProgramOfferingsListPanel({
  program,
  departmentId = null,
  rows,
  archivedCount,
  showArchived,
  addDisabled = false,
  onOfferingsChanged,
  allowedProgramKinds,
}: {
  program: ProgramOfferingsListProgram
  /** When set, manage links stay under the department workspace. */
  departmentId?: string | null
  rows: ProgramDetailOfferingRow[]
  archivedCount: number
  showArchived?: ProgramDetailOfferingRow[]
  /** When true, hide/disable Add (e.g. “All years” filter). */
  addDisabled?: boolean
  /** Refetch client-held offering rows after mutations (department panel). */
  onOfferingsChanged?: () => void | Promise<void>
  /** Org packaging — which modes may be created from Add. */
  allowedProgramKinds?: ProgramKind[]
}) {
  const router = useRouter()
  const parentIsSeasonal = isSeasonalProgramKind(program.program_kind)
  const hierarchy = getHierarchyLabels(program.program_kind)
  const kindChoices =
    allowedProgramKinds && allowedProgramKinds.length > 0
      ? allowedProgramKinds
      : (["academic", "seasonal"] as ProgramKind[])
  /** Under an academic year, Add creates an offering — kind is locked. */
  const lockKindToParent = !parentIsSeasonal
  const defaultCreateKind: ProgramKind = lockKindToParent
    ? "academic"
    : parentIsSeasonal
      ? kindChoices.includes("seasonal")
        ? "seasonal"
        : kindChoices[0] ?? "academic"
      : kindChoices.includes("academic")
        ? "academic"
        : kindChoices[0] ?? "academic"
  const [addOpen, setAddOpen] = React.useState(false)
  const [createKind, setCreateKind] =
    React.useState<ProgramKind>(defaultCreateKind)
  const [offeringName, setOfferingName] = React.useState("")
  const [deliveryFormat, setDeliveryFormat] =
    React.useState<OfferingDeliveryFormat>("in_person")
  const [openEnrollment, setOpenEnrollment] = React.useState(parentIsSeasonal)
  const [startDate, setStartDate] = React.useState(program.start_date || "")
  const [endDate, setEndDate] = React.useState(program.end_date || "")
  const [enrollmentOpenDate, setEnrollmentOpenDate] = React.useState(
    program.enrollment_open_date || ""
  )
  const [enrollmentCloseDate, setEnrollmentCloseDate] = React.useState(
    program.enrollment_close_date || ""
  )
  const [primaryInstructorId, setPrimaryInstructorId] = React.useState("")
  const [gender, setGender] = React.useState<ProgramGender>("All")
  const [minAge, setMinAge] = React.useState<number | null>(null)
  const [maxAge, setMaxAge] = React.useState<number | null>(null)
  const [capacity, setCapacity] = React.useState("")
  const [feeAmount, setFeeAmount] = React.useState("")
  const [staffOptions, setStaffOptions] = React.useState<
    Array<{ id: string; full_name: string | null; email: string | null }>
  >([])
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = React.useState<string | null>(null)
  const [deletingOfferingId, setDeletingOfferingId] = React.useState<string | null>(
    null
  )
  const [duplicateTarget, setDuplicateTarget] =
    React.useState<ProgramOffering | null>(null)
  const [duplicateName, setDuplicateName] = React.useState("")
  const [isDuplicating, setIsDuplicating] = React.useState(false)
  const [duplicateError, setDuplicateError] = React.useState<string | null>(null)
  const [orderedRows, setOrderedRows] = React.useState(rows)
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = React.useState<number | null>(
    null
  )
  const [isReordering, setIsReordering] = React.useState(false)

  const rowsSignature = offeringRowsSignature(rows)
  React.useEffect(() => {
    setOrderedRows(rows)
  }, [rows, rowsSignature])

  const showDetailFields = !(createKind === "academic" && parentIsSeasonal)

  function showActionFeedback(message: string) {
    setActionFeedback(message)
    window.setTimeout(() => setActionFeedback(null), 2500)
  }

  async function refreshOfferingsList() {
    if (onOfferingsChanged) {
      await onOfferingsChanged()
      return
    }
    router.refresh()
  }

  async function persistOfferingOrder(nextRows: ProgramDetailOfferingRow[]) {
    const previous = orderedRows
    setOrderedRows(nextRows)
    setIsReordering(true)
    try {
      const { reorderProgramOfferings } = await import(
        "@/lib/programs/program-offering-actions"
      )
      await reorderProgramOfferings({
        programId: program.id,
        orderedOfferingIds: nextRows.map((row) => row.offering.id),
      })
      showActionFeedback("Order saved.")
      await refreshOfferingsList()
    } catch (error) {
      setOrderedRows(previous)
      showActionFeedback(
        error instanceof Error ? error.message : "Could not save order."
      )
    } finally {
      setIsReordering(false)
    }
  }

  function handleDropOnIndex(toIndex: number) {
    if (draggedIndex === null) {
      setDropTargetIndex(null)
      return
    }
    if (draggedIndex === toIndex) {
      setDraggedIndex(null)
      setDropTargetIndex(null)
      return
    }
    const nextRows = moveOfferingRow(orderedRows, draggedIndex, toIndex)
    setDraggedIndex(null)
    setDropTargetIndex(null)
    void persistOfferingOrder(nextRows)
  }

  function openDuplicateDialog(offering: ProgramOffering) {
    setDuplicateTarget(offering)
    setDuplicateName(buildCopyName(offering.name))
    setDuplicateError(null)
  }

  function closeDuplicateDialog() {
    if (isDuplicating) return
    setDuplicateTarget(null)
    setDuplicateName("")
    setDuplicateError(null)
  }

  async function handleDuplicate() {
    if (!duplicateTarget) return

    const name = duplicateName.trim()
    if (!name) {
      setDuplicateError(`${PROGRAM_LABEL} name is required.`)
      return
    }

    setIsDuplicating(true)
    setDuplicateError(null)

    try {
      await duplicateProgramOffering(duplicateTarget.id, name)
      setDuplicateTarget(null)
      setDuplicateName("")
      showActionFeedback(`${PROGRAM_LABEL} duplicated.`)
      await refreshOfferingsList()
    } catch (error) {
      setDuplicateError(
        error instanceof Error
          ? error.message
          : `Could not duplicate ${PROGRAM_LABEL.toLowerCase()}.`
      )
    } finally {
      setIsDuplicating(false)
    }
  }

  React.useEffect(() => {
    if (!addOpen) return
    const nextKind = parentIsSeasonal ? "seasonal" : "academic"
    setCreateKind(nextKind)
    setOpenEnrollment(nextKind === "seasonal")
    setStartDate(program.start_date || "")
    setEndDate(program.end_date || "")
    setEnrollmentOpenDate(program.enrollment_open_date || "")
    setEnrollmentCloseDate(program.enrollment_close_date || "")
    void (async () => {
      try {
        const { searchProgramStaffContactsAction } = await import(
          "@/lib/programs/program-staff-assignment-actions"
        )
        const rows = await searchProgramStaffContactsAction("", {
          departmentId,
        })
        setStaffOptions(
          (rows || []).map((row) => ({
            id: row.id,
            full_name: row.full_name ?? null,
            email: row.email ?? null,
          }))
        )
      } catch {
        setStaffOptions([])
      }
    })()
  }, [
    addOpen,
    departmentId,
    parentIsSeasonal,
    program.start_date,
    program.end_date,
    program.enrollment_open_date,
    program.enrollment_close_date,
  ])

  function resetCreateForm() {
    setOfferingName("")
    setDeliveryFormat("in_person")
    const nextKind = parentIsSeasonal ? "seasonal" : "academic"
    setCreateKind(nextKind)
    setOpenEnrollment(nextKind === "seasonal")
    setStartDate(program.start_date || "")
    setEndDate(program.end_date || "")
    setEnrollmentOpenDate(program.enrollment_open_date || "")
    setEnrollmentCloseDate(program.enrollment_close_date || "")
    setPrimaryInstructorId("")
    setGender("All")
    setMinAge(null)
    setMaxAge(null)
    setCapacity("")
    setFeeAmount("")
    setCreateError(null)
  }

  function parseOptionalNumber(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }

  async function applyInstructorAndFee(input: {
    programId: string
    offeringId: string
    offeringName: string
  }) {
    if (primaryInstructorId) {
      const { createProgramStaffAssignment } = await import(
        "@/lib/programs/program-staff-assignment-actions"
      )
      await createProgramStaffAssignment({
        programId: input.programId,
        offeringId: input.offeringId,
        contactId: primaryInstructorId,
        assignmentRole: "primary_instructor",
      })
    }

    const fee = parseOptionalNumber(feeAmount)
    if (fee != null && fee > 0) {
      const { saveOfferingFeePlans } = await import(
        "@/lib/programs/program-fee-plan-actions"
      )
      await saveOfferingFeePlans({
        programId: input.programId,
        offeringId: input.offeringId,
        plans: [
          {
            name: `${input.offeringName} — Program Fee`,
            plan_type: "one_time",
            is_default: true,
            is_active: true,
            deposit_amount: 0,
            payment_due_day: null,
            installment_count: null,
            components: [
              {
                component_type: "tuition",
                label: "Program Fee",
                amount: fee,
                pricing_model: "flat",
                quantity_mode: "fixed",
                quantity_value: 1,
                sort_order: 0,
                is_active: true,
                billing_scope: "individual",
              },
            ],
          },
        ],
        discountRules: [],
        optionFeePlanLinks: [],
      })
    }
  }

  function buildEligibilityAttributes() {
    const capacityValue = parseOptionalNumber(capacity)
    const limited = capacityValue != null && capacityValue > 0
    return {
      gender,
      min_age: minAge,
      max_age: maxAge,
      audience_type:
        minAge != null && minAge >= ADULT_MIN_AGE
          ? ("adult" as const)
          : ("youth" as const),
      capacity_mode: limited ? ("limited" as const) : ("unlimited" as const),
      capacity: limited ? capacityValue : null,
    }
  }

  async function handleCreate() {
    const name = offeringName.trim()
    if (!name) {
      setCreateError("Name is required.")
      return
    }

    if (
      minAge != null &&
      maxAge != null &&
      minAge > maxAge
    ) {
      setCreateError("Minimum age cannot be greater than maximum age.")
      return
    }

    if (createKind === "seasonal" && !departmentId) {
      setCreateError("Seasonal camps must be created from a department.")
      return
    }

    setCreating(true)
    setCreateError(null)

    const eligibility = buildEligibilityAttributes()

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
          start_date: startDate || null,
          end_date: endDate || null,
          enrollment_open_date: enrollmentOpenDate || null,
          enrollment_close_date: enrollmentCloseDate || null,
          gender,
          min_age: minAge,
          max_age: maxAge,
          capacity: eligibility.capacity ?? 0,
          program_type: eligibility.audience_type,
        })
        if (created.offeringId) {
          await applyInstructorAndFee({
            programId: created.programId,
            offeringId: created.offeringId,
            offeringName: name,
          })
        }
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
        start_date: startDate || program.start_date,
        end_date: endDate || program.end_date,
        enrollment_open_date:
          enrollmentOpenDate || program.enrollment_open_date,
        enrollment_close_date:
          enrollmentCloseDate || program.enrollment_close_date,
        status: program.status === "draft" ? "draft" : "active",
        inherit_dates: false,
        inherit_eligibility: false,
        inherit_enrollment: false,
        attributes: {
          delivery_format: deliveryFormat,
          application_required: !openEnrollment,
          ...eligibility,
        },
      })
      await applyInstructorAndFee({
        programId: program.id,
        offeringId: created.id as string,
        offeringName: name,
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

  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-h-5 text-xs text-muted-foreground">
            {actionFeedback || null}
          </div>
          <Button
            size="sm"
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={addDisabled}
            title={
              addDisabled
                ? `Select a ${hierarchy.containerSingular.toLowerCase()} to add a ${hierarchy.offeringSingular.toLowerCase()}.`
                : undefined
            }
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add {hierarchy.offeringSingular}
          </Button>
        </div>

        {orderedRows.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No {hierarchy.offeringPlural.toLowerCase()} yet. Add a{" "}
              {hierarchy.offeringSingular.toLowerCase()} to open registration,
              fees, and schedule.
            </p>
            {!addDisabled ? (
              <Button
                type="button"
                size="sm"
                className="mt-4"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add first {hierarchy.offeringSingular.toLowerCase()}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <span className="sr-only">Reorder</span>
                  </TableHead>
                  <TableHead>{hierarchy.offeringSingular}</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Program Fee</TableHead>
                  <TableHead>Primary Instructor</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Times</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderedRows.map(
                  (
                    {
                      offering,
                      enrolled,
                      primaryInstructor,
                      tuitionAmount,
                      daysLabel,
                      timesLabel,
                    },
                    index
                  ) => {
                  const effectiveDates = resolveEffectiveOfferingDates(
                    offering,
                    program as ProgramDefaultsSource
                  )
                  const enrollmentOpen = isOfferingEnrollmentOpen({
                    enrollment_open_date: effectiveDates.enrollment_open_date,
                    enrollment_close_date: effectiveDates.enrollment_close_date,
                  })
                  const manageHref = programOfferingManageHref(
                    program.id,
                    offering.id,
                    { departmentId }
                  )
                  const editHref = programOfferingManageHref(
                    program.id,
                    offering.id,
                    { departmentId, edit: true }
                  )
                  return (
                    <TableRow
                      key={offering.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/40",
                        draggedIndex === index && "opacity-50",
                        dropTargetIndex === index &&
                          draggedIndex !== index &&
                          "bg-primary/5 ring-1 ring-inset ring-primary/20"
                      )}
                      tabIndex={0}
                      role="link"
                      aria-label={`Open ${offering.name}`}
                      onClick={() => router.push(manageHref)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          router.push(manageHref)
                        }
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = "move"
                        setDropTargetIndex(index)
                      }}
                      onDragLeave={() => {
                        setDropTargetIndex((current) =>
                          current === index ? null : current
                        )
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        handleDropOnIndex(index)
                      }}
                    >
                      <TableCell
                        className="w-10 align-middle"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          draggable={!isReordering}
                          aria-label={`Reorder ${offering.name}`}
                          title="Drag to reorder"
                          className="flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isReordering}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move"
                            event.dataTransfer.setData(
                              "text/plain",
                              String(index)
                            )
                            setDraggedIndex(index)
                          }}
                          onDragEnd={() => {
                            setDraggedIndex(null)
                            setDropTargetIndex(null)
                          }}
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          className="text-left text-sky-700 hover:underline"
                          onClick={(event) => {
                            event.stopPropagation()
                            router.push(editHref)
                          }}
                        >
                          {offering.name}
                        </button>
                      </TableCell>
                      <TableCell>
                        {
                          OFFERING_DELIVERY_FORMAT_LABELS[
                            offering.delivery_format ?? "in_person"
                          ]
                        }
                      </TableCell>
                      <TableCell>{formatTuitionAmount(tuitionAmount)}</TableCell>
                      <TableCell>{primaryInstructor || "—"}</TableCell>
                      <TableCell>{daysLabel || "—"}</TableCell>
                      <TableCell>{timesLabel || "—"}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p>
                            {formatOfferingEnrollmentLabel(enrolled, offering, {
                              capacityAppliesPerSession: parentIsSeasonal,
                            })}
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
                      <TableCell
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Actions for ${offering.name}`}
                              disabled={deletingOfferingId === offering.id}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                window.open(
                                  buildProgramCustomerUrl(
                                    program.id,
                                    window.location.origin
                                  ),
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Preview page
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                void (async () => {
                                  if (
                                    offering.status !== "active" ||
                                    program.status !== "active"
                                  ) {
                                    showActionFeedback(
                                      `Set ${YEAR_SEASON_LABEL.toLowerCase()} and ${PROGRAM_LABEL.toLowerCase()} to Active before sharing.`
                                    )
                                    return
                                  }
                                  try {
                                    const url = buildProgramRegistrationUrl(
                                      program.id,
                                      window.location.origin
                                    )
                                    await navigator.clipboard.writeText(url)
                                    showActionFeedback(
                                      "Registration link copied."
                                    )
                                  } catch {
                                    showActionFeedback("Failed to copy link.")
                                  }
                                })()
                              }}
                            >
                              <Link2 className="mr-2 h-4 w-4" />
                              Share link
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDuplicateDialog(offering)}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              disabled={enrolled > 0}
                              onClick={() => {
                                void (async () => {
                                  if (enrolled > 0) {
                                    showActionFeedback(
                                      "Delete is unavailable while this offering has registrations."
                                    )
                                    return
                                  }
                                  const confirmed = window.confirm(
                                    `Delete ${offering.name}? This cannot be undone.`
                                  )
                                  if (!confirmed) return
                                  setDeletingOfferingId(offering.id)
                                  try {
                                    const { deleteProgramOffering } =
                                      await import(
                                        "@/lib/programs/program-offering-actions"
                                      )
                                    await deleteProgramOffering(offering.id)
                                    showActionFeedback("Offering deleted.")
                                    await refreshOfferingsList()
                                  } catch (error) {
                                    showActionFeedback(
                                      error instanceof Error
                                        ? error.message
                                        : "Could not delete offering."
                                    )
                                  } finally {
                                    setDeletingOfferingId(null)
                                  }
                                })()
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
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
          open={duplicateTarget !== null}
          onOpenChange={(open) => {
            if (!open) closeDuplicateDialog()
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Duplicate {PROGRAM_LABEL.toLowerCase()}</DialogTitle>
              <DialogDescription>
                Copy registration options, pricing, sessions, and billing
                schedule from {duplicateTarget?.name}. {YEAR_SEASON_LABEL}-level
                settings such as eligibility and capacity groups stay shared.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="list-duplicate-offering-name">
                New {PROGRAM_LABEL.toLowerCase()} name
              </Label>
              <Input
                id="list-duplicate-offering-name"
                value={duplicateName}
                onChange={(event) => setDuplicateName(event.target.value)}
                placeholder={`${duplicateTarget?.name || PROGRAM_LABEL} (copy)`}
                disabled={isDuplicating}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void handleDuplicate()
                  }
                }}
              />
              {duplicateError ? (
                <p className="text-sm text-destructive">{duplicateError}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDuplicateDialog}
                disabled={isDuplicating}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleDuplicate()}
                disabled={isDuplicating || !duplicateName.trim()}
              >
                {isDuplicating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Duplicating…
                  </>
                ) : (
                  `Duplicate ${PROGRAM_LABEL.toLowerCase()}`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open)
            if (!open) resetCreateForm()
          }}
        >
          <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
            <DialogHeader className="shrink-0 space-y-1.5 border-b px-6 py-4 text-left">
              <DialogTitle>
                Add{" "}
                {createKind === "seasonal"
                  ? getHierarchyLabels("seasonal").containerSingular
                  : parentIsSeasonal
                    ? getHierarchyLabels("academic").containerSingular
                    : hierarchy.offeringSingular}
              </DialogTitle>
              <DialogDescription>
                {createKind === "seasonal"
                  ? "Create a camp or season product. Schedule sessions can be set after create."
                  : parentIsSeasonal
                    ? "Starts a new academic year for this department. Add classes under it afterward."
                    : `Create a class or track under this ${hierarchy.containerSingular.toLowerCase()}. Dates default from the ${hierarchy.containerSingular.toLowerCase()}; schedule is set after create.`}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <OfferingBasicsForm
                mode="create"
                disabled={creating}
                showDetailFields={showDetailFields}
                departmentId={departmentId}
                staffOptions={staffOptions}
                kindRadioName="dept-add-program-kind"
                allowedKinds={
                  lockKindToParent ? (["academic"] as ProgramKind[]) : kindChoices
                }
                hideKindPicker={lockKindToParent || kindChoices.length <= 1}
                values={{
                  kind: createKind,
                  name: offeringName,
                  deliveryFormat,
                  startDate,
                  endDate,
                  enrollmentOpenDate,
                  enrollmentCloseDate,
                  primaryInstructorId,
                  gender,
                  minAge,
                  maxAge,
                  capacity,
                  feeAmount,
                  openEnrollment,
                }}
                onChange={(patch) => {
                  if (patch.kind !== undefined) setCreateKind(patch.kind)
                  if (patch.name !== undefined) setOfferingName(patch.name)
                  if (patch.deliveryFormat !== undefined) {
                    setDeliveryFormat(patch.deliveryFormat)
                  }
                  if (patch.startDate !== undefined) {
                    setStartDate(patch.startDate)
                  }
                  if (patch.endDate !== undefined) setEndDate(patch.endDate)
                  if (patch.enrollmentOpenDate !== undefined) {
                    setEnrollmentOpenDate(patch.enrollmentOpenDate)
                  }
                  if (patch.enrollmentCloseDate !== undefined) {
                    setEnrollmentCloseDate(patch.enrollmentCloseDate)
                  }
                  if (patch.primaryInstructorId !== undefined) {
                    setPrimaryInstructorId(patch.primaryInstructorId)
                  }
                  if (patch.gender !== undefined) setGender(patch.gender)
                  if (patch.minAge !== undefined) setMinAge(patch.minAge)
                  if (patch.maxAge !== undefined) setMaxAge(patch.maxAge)
                  if (patch.capacity !== undefined) setCapacity(patch.capacity)
                  if (patch.feeAmount !== undefined) {
                    setFeeAmount(patch.feeAmount)
                  }
                  if (patch.openEnrollment !== undefined) {
                    setOpenEnrollment(patch.openEnrollment)
                  }
                }}
              />

              {createError ? (
                <p className="text-sm text-destructive">{createError}</p>
              ) : null}
            </div>
            <DialogFooter className="shrink-0 border-t px-6 py-4">
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
      </CardContent>
    </Card>
  )
}
