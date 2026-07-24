"use client"

import * as React from "react"

import { EditSectionCard } from "@/components/programs/edit/edit-section-card"
import { gradesApplyForMinAge } from "@/components/programs/edit/utils"
import type { ProgramGender } from "@/components/programs/edit/types"
import {
  ProgramCapacityGroupEditor,
  type ProgramCapacityGroupEditorHandle,
} from "@/components/programs/program-capacity-group-editor"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ProgramCapacityGroupInput } from "@/lib/programs/program-capacity-group-types"
import type { Program } from "@/lib/programs/program-types"

export type OfferingRegistrationCapacitySectionHandle = {
  flushCapacityGroups: () => ProgramCapacityGroupInput[]
}

export const OfferingRegistrationCapacitySection = React.forwardRef<
  OfferingRegistrationCapacitySectionHandle,
  {
    program: Program
    fullProgramEnabled: boolean
    sessionRegistrationEnabled: boolean
    minAge: number | null
    gradeLevels: string[]
    programGender: ProgramGender
    capacity: number
    onCapacityChange: (capacity: number) => void
    capacityGroups: ProgramCapacityGroupInput[]
    onCapacityGroupsChange: (groups: ProgramCapacityGroupInput[]) => void
    enableWaitlist: boolean
    waitlistCapacity: string
    onWaitlistCapacityChange: (value: string) => void
    enrolled?: number
  }
>(function OfferingRegistrationCapacitySection(
  {
    program,
    fullProgramEnabled,
    sessionRegistrationEnabled,
    minAge,
    gradeLevels,
    programGender,
    capacity,
    onCapacityChange,
    capacityGroups,
    onCapacityGroupsChange,
    enableWaitlist,
    waitlistCapacity,
    onWaitlistCapacityChange,
    enrolled,
  },
  ref
) {
  const capacityGroupRef = React.useRef<ProgramCapacityGroupEditorHandle>(null)
  const useGroupCapacity = gradesApplyForMinAge(minAge)

  React.useImperativeHandle(ref, () => ({
    flushCapacityGroups() {
      return capacityGroupRef.current?.flushPendingDraft() ?? capacityGroups
    },
  }))

  if (!fullProgramEnabled && !sessionRegistrationEnabled) {
    return null
  }

  return (
    <div className="space-y-4">
      {fullProgramEnabled ? (
        <EditSectionCard
          title="Capacity"
          description={
            useGroupCapacity
              ? "Set capacity by grade and gender group for camp-style programs."
              : "Maximum number of participants for full program registration."
          }
        >
          <div className="space-y-4">
            {useGroupCapacity ? (
              <ProgramCapacityGroupEditor
                ref={capacityGroupRef}
                selectedGrades={gradeLevels}
                programGender={programGender}
                groups={capacityGroups}
                onChange={onCapacityGroupsChange}
                totalCapacity={capacity}
                onTotalCapacityChange={onCapacityChange}
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="program-capacity">Program capacity</Label>
                  <Input
                    id="program-capacity"
                    type="number"
                    min="0"
                    value={capacity}
                    onChange={(event) =>
                      onCapacityChange(Number(event.target.value || 0))
                    }
                    placeholder="e.g. 20"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Currently enrolled</Label>
                  <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">
                    {enrolled ?? program.enrolled ?? 0}
                    {capacity > 0 ? (
                      <span className="ml-1 text-muted-foreground">
                        / {capacity}
                      </span>
                    ) : (
                      <span className="ml-1 text-muted-foreground">
                        / Unlimited
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {enableWaitlist ? (
              <div className="space-y-1.5 border-t pt-4">
                <Label htmlFor="waitlist-capacity">Waitlist capacity</Label>
                <Input
                  id="waitlist-capacity"
                  type="number"
                  min="0"
                  value={waitlistCapacity}
                  onChange={(event) =>
                    onWaitlistCapacityChange(event.target.value)
                  }
                  placeholder="Optional"
                  className="h-9 max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Optional limit for waitlisted registrations. Leave blank for
                  no waitlist cap.
                </p>
              </div>
            ) : null}
          </div>
        </EditSectionCard>
      ) : null}

      {sessionRegistrationEnabled ? (
        <p className="text-sm text-muted-foreground">
          Session capacity is configured on the{" "}
          <strong>Sessions</strong> tab for each session.
        </p>
      ) : null}
    </div>
  )
})
