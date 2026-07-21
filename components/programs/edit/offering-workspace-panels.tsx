"use client"

import { ProgramSessionsEditor } from "@/components/programs/program-sessions-editor"
import { OfferingWeeklyScheduleEditor } from "@/components/programs/offering-weekly-schedule-editor"
import type { OfferingWorkspaceData } from "@/lib/programs/offering-workspace-types"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"

export function OfferingSessionsPanel({
  programId,
  offering,
  workspaceData,
  sessionRegistrationEnabled,
}: {
  programId: string
  offering: ProgramOffering
  workspaceData: OfferingWorkspaceData
  sessionRegistrationEnabled: boolean
}) {
  if (!sessionRegistrationEnabled) {
    return (
      <div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
        <p className="font-medium">Session registration is off</p>
        <p className="text-muted-foreground">
          Enable <strong>Session-Based Registration</strong>,{" "}
          <strong>Single Session</strong>, or <strong>Drop-In</strong> on the
          Registration subtab for this offering before adding sessions.
        </p>
      </div>
    )
  }

  return (
    <ProgramSessionsEditor
      programId={programId}
      offeringId={offering.id}
      sessions={workspaceData.sessions}
    />
  )
}

export function OfferingSchedulePanel({
  programId,
  offering,
  workspaceData,
}: {
  programId: string
  offering: ProgramOffering
  workspaceData: OfferingWorkspaceData
}) {
  return (
    <OfferingWeeklyScheduleEditor
      programId={programId}
      offeringId={offering.id}
      offeringName={offering.name}
      items={workspaceData.scheduleItems}
    />
  )
}
