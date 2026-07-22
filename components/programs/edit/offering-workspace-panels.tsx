"use client"

import * as React from "react"
import { Pencil } from "lucide-react"

import { OfferingScheduleSummaryCard } from "@/components/programs/offering-schedule-summary-card"
import { ProgramSessionsEditor } from "@/components/programs/program-sessions-editor"
import { OfferingWeeklyScheduleEditor } from "@/components/programs/offering-weekly-schedule-editor"
import { Button } from "@/components/ui/button"
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
    return null
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
  const [editing, setEditing] = React.useState(
    workspaceData.scheduleItems.length === 0
  )

  React.useEffect(() => {
    if (workspaceData.scheduleItems.length === 0) {
      setEditing(true)
    }
  }, [workspaceData.scheduleItems.length])

  return (
    <div className="space-y-4">
      <OfferingScheduleSummaryCard
        offering={offering}
        items={workspaceData.scheduleItems}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing((current) => !current)}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {editing ? "Done" : "Edit weekly times"}
          </Button>
        }
      />

      {editing ? (
        <OfferingWeeklyScheduleEditor
          programId={programId}
          offeringId={offering.id}
          offeringName={offering.name}
          items={workspaceData.scheduleItems}
        />
      ) : null}
    </div>
  )
}
