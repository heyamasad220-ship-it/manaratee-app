"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import {
  ProgramApplicationFormFields,
  type ProgramApplicationFormValues,
} from "@/components/programs/program-application-form-fields"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { submitProgramApplication } from "@/lib/programs/program-application-actions"
import type { ProgramApplicantType } from "@/lib/programs/program-application-types"
import { EMPTY_PROGRAM_APPLICATION_ANSWERS } from "@/lib/programs/program-application-types"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"

export function ProgramApplyForm({
  organizationId,
  programId,
  userId,
  registrantContactId,
  offerings,
  initialOfferingId,
  familyMembers,
}: {
  organizationId: string
  programId: string
  userId: string
  registrantContactId: string
  offerings: ProgramOffering[]
  initialOfferingId?: string | null
  familyMembers: Array<{ contactId: string; name: string }>
}) {
  const router = useRouter()
  const initialIds = initialOfferingId
    ? [initialOfferingId]
    : offerings[0]?.id
      ? [offerings[0].id]
      : []
  const [participantContactId, setParticipantContactId] = React.useState(
    familyMembers[0]?.contactId || ""
  )
  const [values, setValues] = React.useState<ProgramApplicationFormValues>({
    participantName: familyMembers[0]?.name || "",
    applicantType: "returning" as ProgramApplicantType,
    offeringIds: initialIds,
    answers: {
      ...EMPTY_PROGRAM_APPLICATION_ANSWERS,
      requested_offering_ids: initialIds.length > 0 ? initialIds : null,
    },
  })
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null
  )

  React.useEffect(() => {
    const member = familyMembers.find(
      (row) => row.contactId === participantContactId
    )
    if (member) {
      setValues((current) => ({
        ...current,
        participantName: member.name,
      }))
    }
  }, [participantContactId, familyMembers])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (values.offeringIds.length === 0) {
      setError("Select at least one course.")
      return
    }
    if (!values.participantName.trim()) {
      setError("Full name is required.")
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    const result = await submitProgramApplication({
      organizationId,
      programId,
      offeringId: values.offeringIds[0],
      registrantContactId,
      participantContactId: participantContactId || null,
      participantName: values.participantName,
      applicantType: values.applicantType,
      answers: {
        ...values.answers,
        requested_offering_ids: values.offeringIds,
      },
      source: "customer",
      createdByUserId: userId,
    })

    setIsSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    setSuccessMessage(
      "Application submitted. The department will review it, then you can register."
    )
    router.refresh()
  }

  if (offerings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No programs are available to apply for yet.
      </p>
    )
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      {familyMembers.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor="apply-participant">Participant</Label>
          <select
            id="apply-participant"
            value={participantContactId}
            onChange={(event) => setParticipantContactId(event.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            disabled={isSaving}
          >
            {familyMembers.map((member) => (
              <option key={member.contactId} value={member.contactId}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <ProgramApplicationFormFields
        values={values}
        onChange={setValues}
        offerings={offerings.map((offering) => ({
          id: offering.id,
          name: offering.name,
        }))}
        disabled={isSaving}
        showParticipantName={familyMembers.length === 0}
        idPrefix="customer-apply"
      />

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      {successMessage ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {successMessage}
        </p>
      ) : null}

      <Button type="submit" disabled={isSaving}>
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting…
          </>
        ) : (
          "Submit application"
        )}
      </Button>
    </form>
  )
}
