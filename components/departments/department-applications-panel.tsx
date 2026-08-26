"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ClipboardCheck, Loader2 } from "lucide-react"

import { DepartmentApplicationDetailDialog } from "@/components/departments/department-application-detail-sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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
import { ListPagination } from "@/components/ui/list-pagination"
import {
  evaluateProgramApplicationsBatch,
  fetchDepartmentApplicationsAction,
  withdrawProgramApplicationsBatch,
} from "@/lib/programs/program-application-actions"
import type {
  ApplicationStatusChip,
  DepartmentApplicationListFilter,
  ProgramApplicantType,
  ProgramApplicationStatus,
  ProgramApplicationWithDetails,
} from "@/lib/programs/program-application-types"
import {
  PROGRAM_APPLICANT_TYPE_LABELS,
  PROGRAM_APPLICATION_STATUS_LABELS,
  applicationStatusChipFor,
  canWithdrawProgramApplication,
  isEvaluationQueueChip,
} from "@/lib/programs/program-application-types"
import { customerProgramRegisterPath } from "@/lib/programs/enrollment-process"
import { PROGRAM_LABEL, PROGRAM_LABEL_PLURAL } from "@/lib/programs/program-display-labels"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  DEFAULT_LIST_PAGE_SIZE,
  slicePageItems,
} from "@/lib/ui/list-pagination"

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatLastUpdated(application: ProgramApplicationWithDetails) {
  // Prefer approval actor/time; otherwise last staff save. Never show applicant submit alone.
  const approvedBy = application.evaluated_by_name?.trim()
  const approvedAt = application.evaluated_at
  if (application.evaluated_by_user_id && approvedAt) {
    const stamp = new Date(approvedAt).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    return approvedBy ? `${approvedBy} · ${stamp}` : stamp
  }

  const updatedBy = application.updated_by_name?.trim()
  const updatedAt = application.updated_by_user_id
    ? application.updated_at
    : null
  if (!updatedAt) return "—"
  const stamp = new Date(updatedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
  return updatedBy ? `${updatedBy} · ${stamp}` : stamp
}

function applicationProgramName(application: ProgramApplicationWithDetails) {
  const primary =
    application.approved_offering_name ||
    application.offering_name ||
    PROGRAM_LABEL
  const extra =
    (application.application_answers?.requested_offering_ids?.length || 0) - 1
  if (extra > 0) {
    return `${primary} (+${extra} more)`
  }
  return primary
}

type DepartmentApplicationsPanelProps = {
  departmentId: string
  departmentName: string
  programId?: string | null
  /** Server list filter. Prefer `all` plus status chips. */
  filter?: DepartmentApplicationListFilter
  statusChip?: ApplicationStatusChip
  onStatusChipChange?: (chip: ApplicationStatusChip) => void
  chipCounts?: Record<ApplicationStatusChip, number>
  evaluationRequired?: boolean
  /** Hide outer title when embedded in Registrations tab. */
  embedded?: boolean
  onCountsMayHaveChanged?: () => void
}

const APPLICATION_CHIPS: { id: ApplicationStatusChip; label: string }[] = [
  { id: "all", label: "All" },
  { id: "evaluation", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "waitlisted", label: "Waitlisted" },
  { id: "declined", label: "Declined" },
  { id: "withdrawn", label: "Withdrawn" },
]

function applicationStatusLabel(status: ProgramApplicationStatus | string) {
  return (
    PROGRAM_APPLICATION_STATUS_LABELS[status as ProgramApplicationStatus] ||
    status
  )
}

function evaluationLabel(application: ProgramApplicationWithDetails) {
  if (application.evaluated_at) return formatDate(application.evaluated_at)
  const status = application.status
  if (
    status === "evaluation_required" ||
    status === "evaluation_scheduled" ||
    status === "evaluation_completed"
  ) {
    return applicationStatusLabel(status)
  }
  return "—"
}

/** Department head queue: applications awaiting evaluation or registration. */
export function DepartmentApplicationsPanel({
  departmentId,
  departmentName,
  programId = null,
  filter = "all",
  statusChip = "all",
  onStatusChipChange,
  chipCounts,
  evaluationRequired: _evaluationRequired = false,
  embedded = false,
  onCountsMayHaveChanged,
}: DepartmentApplicationsPanelProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [applications, setApplications] = React.useState<
    ProgramApplicationWithDetails[]
  >([])
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [batchBusy, setBatchBusy] = React.useState(false)
  const [participantFilter, setParticipantFilter] = React.useState("")
  const [programFilter, setProgramFilter] = React.useState("all")
  const [applicantTypeFilter, setApplicantTypeFilter] = React.useState<
    "all" | ProgramApplicantType
  >("all")
  const [detailApplication, setDetailApplication] =
    React.useState<ProgramApplicationWithDetails | null>(null)
  const [withdrawIds, setWithdrawIds] = React.useState<string[] | null>(null)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(DEFAULT_LIST_PAGE_SIZE)

  const isReview = isEvaluationQueueChip(statusChip)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentApplicationsAction(
      departmentId,
      filter,
      programId
    )
    if (!result.success) {
      setError(result.error)
      setApplications([])
      setSelectedIds([])
      setLoading(false)
      return [] as ProgramApplicationWithDetails[]
    }
    setApplications(result.applications)
    setSelectedIds((current) =>
      current.filter((id) =>
        result.applications.some((application) => application.id === id)
      )
    )
    setLoading(false)
    return result.applications
  }, [departmentId, filter, programId])

  React.useEffect(() => {
    void load()
  }, [load])

  const programOptions = React.useMemo(() => {
    const names = new Set(
      applications.map((application) => applicationProgramName(application))
    )
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [applications])

  const filteredApplications = React.useMemo(() => {
    const nameQuery = participantFilter.trim().toLowerCase()
    return applications.filter((application) => {
      if (
        nameQuery &&
        !application.participant_name.toLowerCase().includes(nameQuery)
      ) {
        return false
      }
      if (
        programFilter !== "all" &&
        applicationProgramName(application) !== programFilter
      ) {
        return false
      }
      if (
        applicantTypeFilter !== "all" &&
        application.applicant_type !== applicantTypeFilter
      ) {
        return false
      }
      if (statusChip !== "all") {
        const chip = applicationStatusChipFor(application.status)
        if (statusChip === "approved") {
          return application.status === "approved"
        }
        if (isEvaluationQueueChip(statusChip)) {
          return chip === "evaluation"
        }
        return chip === statusChip
      }
      return true
    })
  }, [
    applications,
    participantFilter,
    programFilter,
    applicantTypeFilter,
    statusChip,
  ])

  React.useEffect(() => {
    setPage(1)
  }, [participantFilter, programFilter, applicantTypeFilter, filter, statusChip])

  const pagedApplications = React.useMemo(
    () => slicePageItems(filteredApplications, page, pageSize),
    [filteredApplications, page, pageSize]
  )

  const filtersActive =
    Boolean(participantFilter.trim()) ||
    programFilter !== "all" ||
    applicantTypeFilter !== "all" ||
    statusChip !== "all"

  const allSelected =
    pagedApplications.length > 0 &&
    pagedApplications.every((application) =>
      selectedIds.includes(application.id)
    )
  const hasSelection = selectedIds.length > 0

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelectedIds((current) =>
        current.filter(
          (id) => !pagedApplications.some((application) => application.id === id)
        )
      )
      return
    }
    setSelectedIds((current) => {
      const next = new Set(current)
      for (const application of pagedApplications) {
        next.add(application.id)
      }
      return [...next]
    })
  }

  function toggleOne(applicationId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? [...current, applicationId]
        : current.filter((id) => id !== applicationId)
    )
  }

  async function handleBatchDecision(decision: "approved" | "not_approved") {
    if (!hasSelection) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      setError("You must be signed in to evaluate applications.")
      return
    }

    setBatchBusy(true)
    setError(null)
    const result = await evaluateProgramApplicationsBatch({
      applicationIds: selectedIds,
      decision,
      evaluatedByUserId: user.id,
    })
    setBatchBusy(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    if (result.failed > 0) {
      setError(
        `Updated ${result.approved}, failed ${result.failed}${
          result.errors[0] ? `: ${result.errors[0]}` : "."
        }`
      )
    }

    setSelectedIds([])
    await load()
    onCountsMayHaveChanged?.()
    router.refresh()
  }

  const withdrawableSelected = React.useMemo(
    () =>
      applications.filter(
        (application) =>
          selectedIds.includes(application.id) &&
          canWithdrawProgramApplication(application)
      ),
    [applications, selectedIds]
  )

  async function handleBatchWithdraw() {
    const ids = withdrawIds || withdrawableSelected.map((row) => row.id)
    if (ids.length === 0) {
      setError(
        "None of the selected applications can be withdrawn. Registered students must be withdrawn from Registrations."
      )
      setWithdrawIds(null)
      return
    }

    setBatchBusy(true)
    setError(null)
    const result = await withdrawProgramApplicationsBatch({
      applicationIds: ids,
    })
    setBatchBusy(false)
    setWithdrawIds(null)

    if (!result.success) {
      setError(result.error)
      return
    }

    if (result.failed > 0) {
      setError(
        `Withdrew ${result.withdrawn}, failed ${result.failed}${
          result.errors[0] ? `: ${result.errors[0]}` : "."
        }`
      )
    }

    setSelectedIds([])
    await load()
    onCountsMayHaveChanged?.()
    router.refresh()
  }

  const title = embedded ? "Applications" : `Applications · ${departmentName}`
  const description =
    "Open a row to review. Select rows to batch approve, decline, or withdraw."
  const emptyMessage = "No applications yet."
  const columnCount = 8
  const withdrawConfirmCount = withdrawIds?.length || 0
  const withdrawConfirmName =
    withdrawConfirmCount === 1
      ? applications.find((row) => row.id === withdrawIds?.[0])
          ?.participant_name || "this applicant"
      : `${withdrawConfirmCount} applications`

  async function copyRegistrationLink(application: ProgramApplicationWithDetails) {
    const path = customerProgramRegisterPath(
      application.program_id,
      application.approved_offering_id || application.offering_id
    )
    const url = `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      setError("Could not copy the registration link.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            className={
              embedded
                ? "text-base font-semibold tracking-tight"
                : "text-lg font-semibold tracking-tight"
            }
          >
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {hasSelection ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selected
            </span>
            <Button
              type="button"
              size="sm"
              disabled={batchBusy}
              onClick={() => void handleBatchDecision("approved")}
            >
              {batchBusy ? "Working…" : "Approve selected"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={batchBusy}
              onClick={() => void handleBatchDecision("not_approved")}
            >
              Decline selected
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={batchBusy || withdrawableSelected.length === 0}
              onClick={() =>
                setWithdrawIds(withdrawableSelected.map((row) => row.id))
              }
            >
              Withdraw selected
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1">
        {APPLICATION_CHIPS.map((chip) => {
          const count = chipCounts?.[chip.id]
          const active = statusChip === chip.id
          return (
            <Button
              key={chip.id}
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 rounded-full px-3 text-zinc-600 hover:bg-amber-50/70 hover:text-amber-700",
                active && "bg-amber-50 text-amber-700"
              )}
              onClick={() => onStatusChipChange?.(chip.id)}
            >
              {chip.label}
              {count != null && (chip.id === "all" || count > 0) ? (
                <span className="ml-1.5 tabular-nums text-xs">{count}</span>
              ) : null}
            </Button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : applications.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                    aria-label="Select all applications"
                    disabled={batchBusy}
                  />
                </TableHead>
                <TableHead>
                  <TableColumnHeaderFilter
                    label="Participant"
                    active={Boolean(participantFilter.trim())}
                  >
                    {({ close }) => (
                      <Input
                        placeholder="Search by name"
                        value={participantFilter}
                        onChange={(event) =>
                          setParticipantFilter(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") close()
                        }}
                      />
                    )}
                  </TableColumnHeaderFilter>
                </TableHead>
                <TableHead>
                  <TableColumnHeaderFilter
                    label={PROGRAM_LABEL}
                    active={programFilter !== "all"}
                  >
                    {({ close }) => (
                      <Select
                        value={programFilter}
                        onValueChange={(value) => {
                          setProgramFilter(value)
                          close()
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={`All ${PROGRAM_LABEL_PLURAL.toLowerCase()}`}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            All {PROGRAM_LABEL_PLURAL.toLowerCase()}
                          </SelectItem>
                          {programOptions.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableColumnHeaderFilter>
                </TableHead>
                <TableHead>
                  <TableColumnHeaderFilter
                    label="New / Returning"
                    active={applicantTypeFilter !== "all"}
                  >
                    {({ close }) => (
                      <Select
                        value={applicantTypeFilter}
                        onValueChange={(value) => {
                          setApplicantTypeFilter(
                            value as "all" | ProgramApplicantType
                          )
                          close()
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="returning">Returning</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableColumnHeaderFilter>
                </TableHead>
                <TableHead>Application Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Evaluation</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplications.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    {filtersActive
                      ? "No applications match these filters."
                      : emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                pagedApplications.map((application) => {
                  const selected = selectedIds.includes(application.id)
                  return (
                    <TableRow
                      key={application.id}
                      data-state={selected ? "selected" : undefined}
                      className="cursor-pointer hover:bg-muted/40"
                      tabIndex={0}
                      role="button"
                      aria-label={`View application for ${application.participant_name}`}
                      onClick={() => setDetailApplication(application)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          setDetailApplication(application)
                        }
                      }}
                    >
                      <TableCell
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={(checked) =>
                            toggleOne(application.id, checked === true)
                          }
                          aria-label={`Select ${application.participant_name}`}
                          disabled={batchBusy}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sky-700">
                        {application.participant_name}
                      </TableCell>
                      <TableCell>{applicationProgramName(application)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            application.applicant_type === "new"
                              ? "bg-sky-50 text-sky-800"
                              : undefined
                          }
                        >
                          {
                            PROGRAM_APPLICANT_TYPE_LABELS[
                              application.applicant_type
                            ]
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "font-normal",
                            application.status === "withdrawn" &&
                              "bg-muted text-muted-foreground"
                          )}
                        >
                          {applicationStatusLabel(application.status)}
                          {application.status === "approved" &&
                          !application.enrollment_id
                            ? " · Registration pending"
                            : null}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(application.created_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {evaluationLabel(application)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatLastUpdated(application)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1">
                          {application.status === "approved" &&
                          !application.enrollment_id ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              onClick={() =>
                                void copyRegistrationLink(application)
                              }
                            >
                              Copy registration link
                            </Button>
                          ) : null}
                          {canWithdrawProgramApplication(application) ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 text-muted-foreground hover:text-foreground"
                              disabled={batchBusy}
                              onClick={() => setWithdrawIds([application.id])}
                            >
                              Withdraw
                            </Button>
                          ) : application.status === "approved" &&
                            !application.enrollment_id ? null : (
                            <span className="text-xs text-muted-foreground">
                              Review
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && !error && filteredApplications.length > 0 ? (
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={filteredApplications.length}
          entryLabel="applications"
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next)
            setPage(1)
          }}
        />
      ) : null}

      {isReview ? (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <ClipboardCheck className="mr-1 inline h-3.5 w-3.5" />
          Use checkboxes for batch approve. Open a row to review, edit, and
          approve one application at a time.
        </div>
      ) : null}

      <DepartmentApplicationDetailDialog
        application={detailApplication}
        open={detailApplication != null}
        onOpenChange={(open) => {
          if (!open) setDetailApplication(null)
        }}
        onChanged={async () => {
          const rows = await load()
          onCountsMayHaveChanged?.()
          router.refresh()
          setDetailApplication((current) => {
            if (!current) return null
            return rows.find((row) => row.id === current.id) || null
          })
        }}
      />

      <AlertDialog
        open={Boolean(withdrawIds && withdrawIds.length)}
        onOpenChange={(open) => {
          if (!open && !batchBusy) setWithdrawIds(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Withdraw {withdrawConfirmName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They leave Pending or Approved — Registration pending and appear
              under Withdrawn. This application can no longer be used to
              register. Registered students must be withdrawn from
              Registrations instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={batchBusy}
              onClick={(event) => {
                event.preventDefault()
                void handleBatchWithdraw()
              }}
            >
              {batchBusy ? "Working…" : "Withdraw"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
