"use client"

import { GradeLevelsMultiSelect } from "@/components/programs/grade-levels-multi-select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { OfferingAudienceType } from "@/lib/programs/program-offering-attributes"
import { cn } from "@/lib/utils"

import { EditSectionCard } from "./edit-section-card"
import type { ProgramGender } from "./types"
import {
  ADULT_MIN_AGE,
  AGE_OPTIONS,
  ageSelectValue,
  getGradeLevelsDisplayLabel,
  gradesApplyForMinAge,
} from "./utils"

export function OfferingEligibilityCard({
  audienceType,
  onAudienceTypeChange,
  minAge,
  maxAge,
  onMinAgeChange,
  onMaxAgeChange,
  gradeLevels,
  onGradeLevelsChange,
  programGender,
  onProgramGenderChange,
  inheritEligibility,
  onInheritEligibilityChange,
}: {
  audienceType: OfferingAudienceType
  onAudienceTypeChange: (audience: OfferingAudienceType) => void
  minAge: number | null
  maxAge: number | null
  onMinAgeChange: (age: number | null) => void
  onMaxAgeChange: (age: number | null) => void
  gradeLevels: string[]
  onGradeLevelsChange: (grades: string[]) => void
  programGender: ProgramGender
  onProgramGenderChange: (gender: ProgramGender) => void
  inheritEligibility?: boolean
  onInheritEligibilityChange?: (inherit: boolean) => void
}) {
  const showGradeFields = gradesApplyForMinAge(minAge)
  const locked = Boolean(inheritEligibility)

  return (
    <EditSectionCard
      title="Eligibility"
      description="Define who can register for this offering."
    >
      {onInheritEligibilityChange ? (
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={locked}
              onCheckedChange={onInheritEligibilityChange}
            />
            <span className="text-muted-foreground">
              Use program eligibility
            </span>
          </label>
        </div>
      ) : null}

      <div
        className={cn(
          "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
          locked && "opacity-60"
        )}
      >
        <div className="space-y-1.5">
          <Label htmlFor="offering-audience">Audience</Label>
          <select
            id="offering-audience"
            value={audienceType}
            disabled={locked}
            onChange={(event) => {
              onInheritEligibilityChange?.(false)
              const next = event.target.value as OfferingAudienceType
              onAudienceTypeChange(next)
              if (next === "adult") {
                onMinAgeChange(
                  minAge != null && minAge >= ADULT_MIN_AGE
                    ? minAge
                    : ADULT_MIN_AGE
                )
                onGradeLevelsChange([])
              } else if (minAge != null && minAge >= ADULT_MIN_AGE) {
                onMinAgeChange(null)
              }
            }}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="adult">Adults</option>
            <option value="youth">Youth</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="min_age">Minimum Age</Label>
          <select
            id="min_age"
            value={ageSelectValue(minAge)}
            disabled={locked}
            onChange={(event) => {
              onInheritEligibilityChange?.(false)
              onMinAgeChange(
                event.target.value ? Number(event.target.value) : null
              )
            }}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">No minimum</option>
            {AGE_OPTIONS.map((age) => (
              <option key={age} value={age}>
                {age}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="max_age">Maximum Age</Label>
          <select
            id="max_age"
            value={ageSelectValue(maxAge)}
            disabled={locked}
            onChange={(event) => {
              onInheritEligibilityChange?.(false)
              onMaxAgeChange(
                event.target.value ? Number(event.target.value) : null
              )
            }}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">No maximum</option>
            {AGE_OPTIONS.map((age) => (
              <option key={age} value={age}>
                {age}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gender">Gender Restriction</Label>
          <select
            id="gender"
            value={programGender}
            disabled={locked}
            onChange={(event) => {
              onInheritEligibilityChange?.(false)
              onProgramGenderChange(event.target.value as ProgramGender)
            }}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="All">None</option>
            <option value="Male">Male only</option>
            <option value="Female">Female only</option>
          </select>
        </div>
      </div>

      {showGradeFields ? (
        <div className={cn("mt-4 space-y-1.5", locked && "opacity-60")}>
          <Label>Grade Levels</Label>
          <GradeLevelsMultiSelect
            selectedGrades={gradeLevels}
            onChange={(grades) => {
              onInheritEligibilityChange?.(false)
              onGradeLevelsChange(grades)
            }}
          />
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Grade levels: {getGradeLevelsDisplayLabel(minAge)}
        </p>
      )}
    </EditSectionCard>
  )
}
