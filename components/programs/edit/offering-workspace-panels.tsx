"use client"

import Link from "next/link"
import { ArrowRight, CalendarDays } from "lucide-react"

import { ProgramSessionsEditor } from "@/components/programs/program-sessions-editor"
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
}: {
  programId: string
  offering: ProgramOffering
}) {
  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-5">
      <div className="flex items-start gap-3">
        <CalendarDays className="mt-0.5 h-5 w-5 text-muted-foreground" />
        <div className="space-y-2">
          <p className="text-sm font-medium">Weekly schedule</p>
          <p className="text-sm text-muted-foreground">
            The program schedule builder lives on the Schedule page. Activities
            are linked to the program; filter by program when viewing{" "}
            {offering.name}.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/programs/schedule?program=${programId}`}>
              Open schedule builder
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
