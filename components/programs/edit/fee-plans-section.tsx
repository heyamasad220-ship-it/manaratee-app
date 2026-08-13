"use client"

import {
  ProgramFeePlanEditor,
  type FeePlanEditorState,
} from "@/components/programs/program-fee-plan-editor"
import type {
  ProgramOfferingDiscountRule,
  ProgramOfferingFeePlan,
  ProgramOfferingFeePlanComponent,
} from "@/lib/programs/program-fee-plan-types"
import type { InvalidFeePlanLink } from "@/lib/programs/program-fee-plan-queries"
import type { ProgramRegistrationOption } from "@/lib/programs/program-registration-option-types"

export function FeePlansSection({
  programId,
  offeringId,
  feePlans,
  feePlanComponents,
  feePlanDiscountRules,
  registrationOptions,
  invalidFeePlanLinks,
  onChange,
  draftMode = false,
  showBillingScheduleLink = true,
  programKind = "academic",
}: {
  programId: string
  offeringId: string
  feePlans: ProgramOfferingFeePlan[]
  feePlanComponents: ProgramOfferingFeePlanComponent[]
  feePlanDiscountRules: ProgramOfferingDiscountRule[]
  registrationOptions: ProgramRegistrationOption[]
  invalidFeePlanLinks: InvalidFeePlanLink[]
  onChange: (state: FeePlanEditorState) => void
  draftMode?: boolean
  showBillingScheduleLink?: boolean
  programKind?: string | null
}) {
  return (
    <div className="space-y-4">
      {invalidFeePlanLinks.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          <p className="font-medium">Invalid fee plan links</p>
          <p className="mt-1 text-amber-900">
            The following registration options reference fee plans that are
            missing or inactive. Customer registration will fail until fixed.
          </p>
          <ul className="mt-2 list-disc pl-5">
            {invalidFeePlanLinks.map((link) => (
              <li key={link.optionId}>
                {link.optionName} ({link.optionType}) → {link.feePlanId}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ProgramFeePlanEditor
        programId={programId}
        offeringId={offeringId}
        plans={feePlans}
        components={feePlanComponents}
        discountRules={feePlanDiscountRules}
        registrationOptions={registrationOptions}
        onChange={onChange}
        draftMode={draftMode}
        showBillingScheduleLink={showBillingScheduleLink}
        programKind={programKind}
      />
    </div>
  )
}
