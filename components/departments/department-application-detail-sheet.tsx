"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import {
  ProgramApplicationFormFields,
  type ProgramApplicationFormValues,
} from "@/components/programs/program-application-form-fields"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  evaluateProgramApplication,
  fetchProgramApplicationOfferingsAction,
  unapproveProgramApplication,
  updateProgramApplicationDetails,
  withdrawProgramApplication,
} from "@/lib/programs/program-application-actions"
import type { ProgramApplicationWithDetails } from "@/lib/programs/program-application-types"
import {
  EMPTY_PROGRAM_APPLICATION_ANSWERS,
  PROGRAM_APPLICATION_STATUS_LABELS,
  PROGRAM_APPLICANT_TYPE_LABELS,
  canWithdrawProgramApplication,
  normalizeProgramApplicationAnswers,
  resolveRequestedOfferingIds,
} from "@/lib/programs/program-application-types"
import { createClient } from "@/lib/supabase/client"

type DepartmentApplicationDetailDialogProps = {
  application: ProgramApplicationWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged?: () => void
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function DepartmentApplicationDetailDialog({
  application,
  open,
  onOpenChange,
  onChanged,
}: DepartmentApplicationDetailDialogProps) {
  const supabase = createClient()
  const [values, setValues] = React.useState<ProgramApplicationFormValues>({
    participantName: "",
    applicantType: "returning",
    offeringIds: [],
    answers: { ...EMPTY_PROGRAM_APPLICATION_ANSWERS },
  })
  const [offerings, setOfferings] = React.useState<
    Array<{ id: string; name: string }>
  >([])
  const [loadingOfferings, setLoadingOfferings] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [deciding, setDeciding] = React.useState<
    "approved" | "not_approved" | "unapprove" | "withdraw" | null
  >(null)
  const [confirmWithdraw, setConfirmWithdraw] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const canEvaluate = application?.status === "submitted"
  const canUnapprove =
    application?.status === "approved" && application.enrollment_id == null
  const canWithdraw = application
    ? canWithdrawProgramApplication(application)
    : false
  const canEdit =
    application?.status === "submitted" ||
    (application?.status === "approved" && application.enrollment_id == null)

  React.useEffect(() => {
    if (!open) {
      setConfirmWithdraw(false)
      return
    }
    if (!application) return
    setError(null)
    setConfirmWithdraw(false)
    const answers = normalizeProgramApplicationAnswers(
      application.application_answers
    )
    const offeringIds = resolveRequestedOfferingIds(
      application.offering_id,
      answers
    )
    setValues({
      participantName: application.participant_name,
      applicantType: application.applicant_type,
      offeringIds,
      answers: {
        ...answers,
        requested_offering_ids: offeringIds.length > 0 ? offeringIds : null,
      },
    })

    let cancelled = false
    setLoadingOfferings(true)
    void fetchProgramApplicationOfferingsAction(application.program_id).then(
      (result) => {
        if (cancelled) return
        const rows = [...(result.offerings || [])]
        for (const id of offeringIds) {
          if (!rows.some((row) => row.id === id)) {
            const label =
              id === application.offering_id
                ? application.approved_offering_name ||
                  application.offering_name ||
                  "Current course"
                : "Course"
            rows.unshift({ id, name: label })
          }
        }
        setOfferings(rows)
        setLoadingOfferings(false)
      }
    )
    return () => {
      cancelled = true
    }
  }, [application, open])

  async function requireUserId() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      setError("You must be signed in to evaluate applications.")
      return null
    }
    return user.id
  }

  function buildSavePayload() {
    if (!application) return null
    const offeringIds = values.offeringIds
    if (offeringIds.length === 0) {
      setError("Select at least one course.")
      return null
    }
    return {
      applicationId: application.id,
      participantName: values.participantName,
      applicantType: values.applicantType,
      offeringId: offeringIds[0],
      offeringIds,
      answers: {
        ...values.answers,
        requested_offering_ids: offeringIds,
      },
    }
  }

  async function handleSave() {
    if (!application || !canEdit) return
    const payload = buildSavePayload()
    if (!payload) return

    setSaving(true)
    setError(null)
    const result = await updateProgramApplicationDetails(payload)
    setSaving(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    onChanged?.()
  }

  async function handleDecision(decision: "approved" | "not_approved") {
    if (!application || !canEvaluate) return
    const userId = await requireUserId()
    if (!userId) return

    const payload = buildSavePayload()
    if (!payload) return

    setDeciding(decision)
    setError(null)

    const saveResult = await updateProgramApplicationDetails(payload)
    if (!saveResult.success) {
      setDeciding(null)
      setError(saveResult.error)
      return
    }

    const result = await evaluateProgramApplication({
      applicationId: application.id,
      decision,
      approvedOfferingId: payload.offeringId,
      evaluatedByUserId: userId,
    })
    setDeciding(null)
    if (!result.success) {
      setError(result.error)
      return
    }
    onChanged?.()
    onOpenChange(false)
  }

  async function handleUnapprove() {
    if (!application || !canUnapprove) return
    setDeciding("unapprove")
    setError(null)
    const result = await unapproveProgramApplication({
      applicationId: application.id,
    })
    setDeciding(null)
    if (!result.success) {
      setError(result.error)
      return
    }
    onChanged?.()
    onOpenChange(false)
  }

  async function handleWithdraw() {
    if (!application || !canWithdraw) return
    setDeciding("withdraw")
    setError(null)
    const result = await withdrawProgramApplication({
      applicationId: application.id,
    })
    setDeciding(null)
    setConfirmWithdraw(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    onChanged?.()
    onOpenChange(false)
  }

  const busy = saving || deciding !== null

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="space-y-1 border-b px-6 py-4 text-left">
          <DialogTitle>Application</DialogTitle>
          <DialogDescription>
            Review and edit answers, then save. Approve when the application is
            ready.
          </DialogDescription>
          {application ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="secondary">
                {PROGRAM_APPLICATION_STATUS_LABELS[application.status]}
              </Badge>
              <Badge
                variant="secondary"
                className={
                  application.applicant_type === "new"
                    ? "bg-sky-50 text-sky-800"
                    : undefined
                }
              >
                {PROGRAM_APPLICANT_TYPE_LABELS[application.applicant_type]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Submitted {formatDate(application.created_at)}
              </span>
            </div>
          ) : null}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!application ? (
            <p className="text-sm text-muted-foreground">
              No application selected.
            </p>
          ) : loadingOfferings ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading form…
            </div>
          ) : (
            <ProgramApplicationFormFields
              values={values}
              onChange={setValues}
              offerings={offerings}
              disabled={!canEdit || busy}
              showParticipantName
              idPrefix={`app-${application.id}`}
            />
          )}

          {error ? (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          ) : null}
        </div>

        {application && (canEdit || canWithdraw) ? (
          <DialogFooter className="gap-2 border-t px-6 py-4 sm:justify-start">
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void handleSave()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            ) : null}
            {canEvaluate ? (
              <>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDecision("approved")}
                >
                  {deciding === "approved" ? "Approving…" : "Approve"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void handleDecision("not_approved")}
                >
                  {deciding === "not_approved" ? "Working…" : "Not approve"}
                </Button>
              </>
            ) : null}
            {canUnapprove ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void handleUnapprove()}
              >
                {deciding === "unapprove" ? "Working…" : "Un-approve"}
              </Button>
            ) : null}
            {canWithdraw ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmWithdraw(true)}
              >
                Withdraw
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>

    <AlertDialog
      open={confirmWithdraw}
      onOpenChange={(open) => {
        if (!busy) setConfirmWithdraw(open)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Withdraw {application?.participant_name || "this applicant"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            They leave Pending or Approved — Registration pending and appear
            under Withdrawn. This application can no longer be used to
            register.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              event.preventDefault()
              void handleWithdraw()
            }}
          >
            {deciding === "withdraw" ? "Working…" : "Withdraw"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

/** @deprecated Use DepartmentApplicationDetailDialog */
export const DepartmentApplicationDetailSheet =
  DepartmentApplicationDetailDialog
