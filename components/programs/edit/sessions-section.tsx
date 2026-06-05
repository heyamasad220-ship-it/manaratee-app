"use client"

import { ProgramSessionsEditor } from "@/components/programs/program-sessions-editor"
import type { ProgramSession } from "@/lib/programs/program-session-types"

import { EditSectionCard } from "./edit-section-card"

export function SessionsSection({
  programId,
  sessions,
  sessionRegistrationEnabled,
}: {
  programId: string
  sessions: ProgramSession[]
  sessionRegistrationEnabled: boolean
}) {
  if (!sessionRegistrationEnabled) {
    return (
      <EditSectionCard
        title="Sessions"
        description="Session-based registration is currently disabled."
      >
        <p className="text-sm text-muted-foreground">
          Enable session registration on the Registration tab to add and manage
          individual sessions for this program.
        </p>
      </EditSectionCard>
    )
  }

  return (
    <EditSectionCard
      title="Sessions"
      description="Manage individual sessions when session registration is enabled."
    >
      <ProgramSessionsEditor programId={programId} sessions={sessions} />
    </EditSectionCard>
  )
}
