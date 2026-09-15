"use client"

import * as React from "react"

import { OfferingScheduleSummaryCard } from "@/components/programs/offering-schedule-summary-card"
import { OfferingSimpleScheduleForm } from "@/components/programs/offering-simple-schedule-form"
import { ProgramSessionsEditor } from "@/components/programs/program-sessions-editor"
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
  return (
    <ProgramSessionsEditor
      programId={programId}
      offeringId={offering.id}
      sessions={workspaceData.sessions}
      sessionRegistrationEnabled={sessionRegistrationEnabled}
      plain
    />
  )
}

export function OfferingSchedulePanel({
  programId,
  offering,
  workspaceData,
  variant = "full",
  deliveryFormat,
  facilityVenueId,
  saveHandlerRef,
  disabled = false,
}: {
  programId: string
  offering: ProgramOffering
  workspaceData: OfferingWorkspaceData
  /** `simple` = time / repeat / days only (edit dialog Advanced Settings). */
  variant?: "full" | "simple"
  deliveryFormat?: ProgramOffering["delivery_format"]
  facilityVenueId?: string
  saveHandlerRef?: React.MutableRefObject<(() => Promise<boolean>) | null>
  disabled?: boolean
}) {
  if (variant === "simple") {
    return (
      <OfferingSimpleScheduleForm
        offering={offering}
        programId={programId}
        items={workspaceData.scheduleItems}
        deliveryFormat={deliveryFormat}
        facilityVenueId={facilityVenueId}
        saveHandlerRef={saveHandlerRef}
        disabled={disabled}
      />
    )
  }

  return (
    <OfferingScheduleSummaryCard
      offering={offering}
      programId={programId}
      items={workspaceData.scheduleItems}
      venues={workspaceData.venues}
    />
  )
}
