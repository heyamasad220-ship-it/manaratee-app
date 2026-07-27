"use client"

import type { MutableRefObject, ReactNode } from "react"

import {
  OfferingPaymentStructureSection,
  OfferingPricingAddonsSection,
  OfferingPricingBillingScheduleSection,
  OfferingPricingBillingSetupSection,
  OfferingPricingChargesSection,
  OfferingPricingDiscountsSection,
  OfferingPricingEditorProvider,
  OfferingPricingEditorSections,
  OfferingPricingSaveFooter,
  OfferingSimplePricingEditor,
} from "@/components/programs/edit/offering-simple-pricing-editor"
import type { OfferingWorkspaceData } from "@/lib/programs/offering-workspace-types"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import type { ProgramRegistrationOption } from "@/lib/programs/program-registration-option-types"

export {
  OfferingPaymentStructureSection,
  OfferingPricingAddonsSection,
  OfferingPricingBillingScheduleSection,
  OfferingPricingBillingSetupSection,
  OfferingPricingChargesSection,
  OfferingPricingDiscountsSection,
  OfferingPricingEditorProvider,
  OfferingPricingSaveFooter,
}

type OfferingPricingPanelProps = {
  programId: string
  offering: ProgramOffering
  workspaceData: OfferingWorkspaceData
  registrationOptions: ProgramRegistrationOption[]
  showSaveButton?: boolean
  onBeforeSave?: () => Promise<boolean>
  saveHandlerRef?: MutableRefObject<(() => Promise<boolean>) | null>
  showCharges?: boolean
  showAddons?: boolean
  showPaymentStructure?: boolean
  showBillingSchedule?: boolean
  showDiscounts?: boolean
  showBillingSetup?: boolean
  showTitle?: boolean
  paymentStructureLayout?: "horizontal" | "vertical"
  /** When true, expects an ancestor OfferingPricingEditorProvider. */
  split?: boolean
}

export function OfferingPricingPanel({
  programId,
  offering,
  workspaceData,
  registrationOptions,
  showSaveButton = true,
  onBeforeSave,
  showCharges = true,
  showAddons = false,
  showPaymentStructure = false,
  showBillingSchedule = true,
  showDiscounts = true,
  showBillingSetup = true,
  showTitle = true,
  paymentStructureLayout = "vertical",
  split = false,
}: OfferingPricingPanelProps) {
  const sections = (
    <OfferingPricingEditorSections
      showCharges={showCharges}
      showAddons={showAddons}
      showPaymentStructure={showPaymentStructure}
      showBillingSchedule={showBillingSchedule}
      showDiscounts={showDiscounts}
      showBillingSetup={showBillingSetup}
      showTitle={showTitle}
      showSaveButton={showSaveButton}
      paymentStructureLayout={paymentStructureLayout}
    />
  )

  if (split) {
    return sections
  }

  return (
    <OfferingSimplePricingEditor
      programId={programId}
      offering={offering}
      workspaceData={workspaceData}
      registrationOptions={registrationOptions}
      showSaveButton={showSaveButton}
      onBeforeSave={onBeforeSave}
      showCharges={showCharges}
      showAddons={showAddons}
      showPaymentStructure={showPaymentStructure}
      showBillingSchedule={showBillingSchedule}
      showTitle={showTitle}
      paymentStructureLayout={paymentStructureLayout}
    />
  )
}

export function OfferingPricingProvider({
  children,
  ...providerProps
}: OfferingPricingPanelProps & { children: ReactNode }) {
  return (
    <OfferingPricingEditorProvider
      programId={providerProps.programId}
      offering={providerProps.offering}
      workspaceData={providerProps.workspaceData}
      registrationOptions={providerProps.registrationOptions}
      onBeforeSave={providerProps.onBeforeSave}
      saveHandlerRef={providerProps.saveHandlerRef}
    >
      {children}
    </OfferingPricingEditorProvider>
  )
}
