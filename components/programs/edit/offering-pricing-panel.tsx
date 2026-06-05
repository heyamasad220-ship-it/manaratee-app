"use client"

import { OfferingSimplePricingEditor } from "@/components/programs/edit/offering-simple-pricing-editor"
import type { OfferingWorkspaceData } from "@/lib/programs/offering-workspace-types"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import type { ProgramRegistrationOption } from "@/lib/programs/program-registration-option-types"

export function OfferingPricingPanel({
  programId,
  offering,
  workspaceData,
  registrationOptions,
  onNavigateNext,
}: {
  programId: string
  offering: ProgramOffering
  workspaceData: OfferingWorkspaceData
  registrationOptions: ProgramRegistrationOption[]
  onNavigateNext?: () => void
}) {
  return (
    <OfferingSimplePricingEditor
      programId={programId}
      offering={offering}
      workspaceData={workspaceData}
      registrationOptions={registrationOptions}
      onNavigateNext={onNavigateNext}
    />
  )
}
