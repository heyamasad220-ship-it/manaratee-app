"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { submitProgramApplication } from "@/lib/programs/program-application-actions"
import type { ProgramApplicantType } from "@/lib/programs/program-application-types"
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
  const [offeringId, setOfferingId] = React.useState(
    initialOfferingId || offerings[0]?.id || ""
  )
  const [applicantType, setApplicantType] =
    React.useState<ProgramApplicantType>("returning")
  const [participantContactId, setParticipantContactId] = React.useState(
    familyMembers[0]?.contactId || ""
  )
  const [participantName, setParticipantName] = React.useState(
    familyMembers[0]?.name || ""
  )
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null
  )

  React.useEffect(() => {
    const member = familyMembers.find((row) => row.contactId === participantContactId)
    if (member) setParticipantName(member.name)
  }, [participantContactId, familyMembers])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!offeringId) {
      setError("Select an offering.")
      return
    }
    if (!participantName.trim()) {
      setError("Participant name is required.")
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    const result = await submitProgramApplication({
      organizationId,
      programId,
      offeringId,
      registrantContactId,
      participantContactId: participantContactId || null,
      participantName,
      applicantType,
      source: "customer",
      createdByUserId: userId,
    })

    setIsSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    if (result.application.status === "approved") {
      setSuccessMessage(
        "Application approved. You can register when a seat is available."
      )
    } else {
      setSuccessMessage(
        "Application submitted. A department reviewer will evaluate new students."
      )
    }
    router.refresh()
  }

  if (offerings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No offerings are available to apply for yet.
      </p>
    )
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="apply-offering">Offering</Label>
        <select
          id="apply-offering"
          value={offeringId}
          onChange={(event) => setOfferingId(event.target.value)}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          disabled={isSaving}
        >
          {offerings.map((offering) => (
            <option key={offering.id} value={offering.id}>
              {offering.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label>Student type</Label>
        <div className="space-y-2 rounded-md border p-3">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="applicantType"
              className="mt-1"
              checked={applicantType === "returning"}
              onChange={() => setApplicantType("returning")}
              disabled={isSaving}
            />
            <span>
              <span className="font-medium">Returning student</span>
              <span className="block text-xs text-muted-foreground">
                Auto-approved for this offering.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="applicantType"
              className="mt-1"
              checked={applicantType === "new"}
              onChange={() => setApplicantType("new")}
              disabled={isSaving}
            />
            <span>
              <span className="font-medium">New student</span>
              <span className="block text-xs text-muted-foreground">
                Needs department evaluation before you can register.
              </span>
            </span>
          </label>
        </div>
      </div>

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
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="apply-name">Participant name</Label>
          <Input
            id="apply-name"
            value={participantName}
            onChange={(event) => setParticipantName(event.target.value)}
            disabled={isSaving}
            placeholder="Student full name"
          />
        </div>
      )}

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
