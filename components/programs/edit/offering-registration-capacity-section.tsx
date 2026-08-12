"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { EditSectionCard } from "@/components/programs/edit/edit-section-card"
import { gradesApplyForMinAge } from "@/components/programs/edit/utils"
import type { ProgramGender } from "@/components/programs/edit/types"
import {
  ProgramCapacityGroupEditor,
  type ProgramCapacityGroupEditorHandle,
} from "@/components/programs/program-capacity-group-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getTotalCapacityFromGroups,
  type ProgramCapacityGroupInput,
} from "@/lib/programs/program-capacity-group-types"
import type { Program } from "@/lib/programs/program-types"
import { cn } from "@/lib/utils"

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
    disabled?: boolean
    plain?: boolean
    /** Hide program capacity when it lives on the parent edit form. */
    hideSimpleCapacity?: boolean
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
    disabled = false,
    plain = false,
    hideSimpleCapacity = false,
  },
  ref
) {
  const capacityGroupRef = React.useRef<ProgramCapacityGroupEditorHandle>(null)
  const useGroupCapacity = gradesApplyForMinAge(minAge)
  const [showCapacityGroups, setShowCapacityGroups] = React.useState(
    () => capacityGroups.length > 0
  )

  React.useEffect(() => {
    if (capacityGroups.length > 0) {
      setShowCapacityGroups(true)
    }
  }, [capacityGroups.length])

  React.useImperativeHandle(ref, () => ({
    flushCapacityGroups() {
      return capacityGroupRef.current?.flushPendingDraft() ?? capacityGroups
    },
  }))

  if (!fullProgramEnabled && !sessionRegistrationEnabled) {
    return null
  }

  const groupsEditorOpen = useGroupCapacity && showCapacityGroups
  const hasCapacityGroups = useGroupCapacity && capacityGroups.length > 0
  const groupsTotal = hasCapacityGroups
    ? getTotalCapacityFromGroups(capacityGroups)
    : capacity
  const programCapacityValue = hasCapacityGroups ? groupsTotal : capacity
  const programCapacityReadOnly = hasCapacityGroups

  return (
    <div className="space-y-4">
      {fullProgramEnabled ? (
        <EditSectionCard title={plain ? undefined : "Capacity"} plain={plain}>
          <div
            className={cn("space-y-4", disabled && "pointer-events-none opacity-60")}
          >
            <div className="flex flex-wrap items-end gap-3">
              {!hideSimpleCapacity ? (
                <div className="space-y-1.5">
                  <Label htmlFor="program-capacity">Program Capacity</Label>
                  <Input
                    id="program-capacity"
                    type="number"
                    min="0"
                    value={programCapacityValue}
                    readOnly={programCapacityReadOnly}
                    disabled={disabled}
                    onChange={(event) =>
                      onCapacityChange(Number(event.target.value || 0))
                    }
                    placeholder="e.g. 20"
                    className={cn(
                      "h-9 w-[140px]",
                      programCapacityReadOnly && "bg-muted"
                    )}
                  />
                </div>
              ) : null}

              {!plain ? (
                <div className="space-y-1.5">
                  <Label>Currently enrolled</Label>
                  <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">
                    {enrolled ?? program.enrolled ?? 0}
                    {programCapacityValue > 0 ? (
                      <span className="ml-1 text-muted-foreground">
                        / {programCapacityValue}
                      </span>
                    ) : (
                      <span className="ml-1 text-muted-foreground">
                        / Unlimited
                      </span>
                    )}
                  </div>
                </div>
              ) : null}

              {useGroupCapacity ? (
                showCapacityGroups ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    disabled={disabled}
                    onClick={() => setShowCapacityGroups(false)}
                  >
                    Hide capacity groups
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 bg-blue-600 hover:bg-blue-700"
                    disabled={disabled}
                    onClick={() => setShowCapacityGroups(true)}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add capacity groups
                  </Button>
                )
              ) : null}
            </div>

            {programCapacityReadOnly ? (
              <p className="text-xs text-muted-foreground">
                Total is calculated from capacity groups.
              </p>
            ) : null}

            {groupsEditorOpen ? (
              <ProgramCapacityGroupEditor
                ref={capacityGroupRef}
                selectedGrades={gradeLevels}
                programGender={programGender}
                groups={capacityGroups}
                onChange={onCapacityGroupsChange}
                totalCapacity={capacity}
                onTotalCapacityChange={onCapacityChange}
                hideTotalField
              />
            ) : null}

            {enableWaitlist ? (
              <div className="space-y-1.5 border-t pt-4">
                <Label htmlFor="waitlist-capacity">Waitlist capacity</Label>
                <Input
                  id="waitlist-capacity"
                  type="number"
                  min="0"
                  value={waitlistCapacity}
                  disabled={disabled}
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
