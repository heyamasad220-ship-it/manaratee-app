"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"

import { EventServiceRequirementsFields } from "@/components/events/event-service-requirements-fields"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  type EventServiceRequirementsFormState,
} from "@/lib/events/event-service-requirements"
import { updateProgramServiceRequirements } from "@/lib/service-participations/service-participation-actions"

type ProgramServiceRequirementsPanelProps = {
  programId: string
  initialForm: EventServiceRequirementsFormState
}

export function ProgramServiceRequirementsPanel({
  programId,
  initialForm,
}: ProgramServiceRequirementsPanelProps) {
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    setSaved(false)

    startTransition(async () => {
      try {
        await updateProgramServiceRequirements({ programId, form })
        setSaved(true)
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Could not save service needs."
        )
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Service needs</CardTitle>
        <p className="text-sm text-muted-foreground">
          When this program is active, eligible volunteers, childcare providers, and
          vendors can sign up from the customer Opportunities page. Parent childcare
          registration is also enabled when childcare is on.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {saved ? (
          <p className="text-sm text-green-700">Service needs saved.</p>
        ) : null}
        <EventServiceRequirementsFields
          value={form}
          onChange={(next) => {
            setSaved(false)
            setForm(next)
          }}
        />
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save service needs"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
