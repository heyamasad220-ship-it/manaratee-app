"use client"

import { GradeLevelsMultiSelect } from "@/components/programs/grade-levels-multi-select"
import { Label } from "@/components/ui/label"
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
  disabled = false,
  plain = false,
  hideAudience = false,
  /** Hide gender/ages when those live on the parent edit form (grades remain). */
  hideGenderAndAges = false,
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
  disabled?: boolean
  plain?: boolean
  /** Settings layout: audience is inferred from min age; hide the control. */
  hideAudience?: boolean
  hideGenderAndAges?: boolean
}) {
  const showGradeFields = gradesApplyForMinAge(minAge)
  const showAudience = !hideAudience && !plain

  if (plain) {
    return (
      <EditSectionCard plain>
        <div className={cn("space-y-3", disabled && "opacity-60")}>
          {!hideGenderAndAges ? (
            <>
              <p className="text-xs font-medium text-muted-foreground">
                Select participants
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  value={programGender}
                  disabled={disabled}
                  onChange={(event) =>
                    onProgramGenderChange(event.target.value as ProgramGender)
                  }
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="All">Both</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="min_age">Minimum Age</Label>
                <select
                  id="min_age"
                  value={ageSelectValue(minAge)}
                  disabled={disabled}
                  onChange={(event) =>
                    onMinAgeChange(
                      event.target.value ? Number(event.target.value) : null
                    )
                  }
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
                  disabled={disabled}
                  onChange={(event) =>
                    onMaxAgeChange(
                      event.target.value ? Number(event.target.value) : null
                    )
                  }
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
            </>
          ) : null}

          {showGradeFields ? (
            <div className="space-y-1.5">
              <Label>Grade Levels</Label>
              <GradeLevelsMultiSelect
                selectedGrades={gradeLevels}
                onChange={onGradeLevelsChange}
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Grade levels: {getGradeLevelsDisplayLabel(minAge)}
            </p>
          )}
        </div>
      </EditSectionCard>
    )
  }

  return (
    <EditSectionCard
      title="Eligibility"
      description="Define who can register for this program."
    >
      <div
        className={cn(
          "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
          disabled && "opacity-60"
        )}
      >
        {showAudience ? (
          <div className="space-y-1.5">
            <Label htmlFor="offering-audience">Audience</Label>
            <select
              id="offering-audience"
              value={audienceType}
              disabled={disabled}
              onChange={(event) => {
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
        ) : null}

        {!hideGenderAndAges ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                value={programGender}
                disabled={disabled}
                onChange={(event) =>
                  onProgramGenderChange(event.target.value as ProgramGender)
                }
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="All">Both</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="min_age">Minimum Age</Label>
              <select
                id="min_age"
                value={ageSelectValue(minAge)}
                disabled={disabled}
                onChange={(event) =>
                  onMinAgeChange(
                    event.target.value ? Number(event.target.value) : null
                  )
                }
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
                disabled={disabled}
                onChange={(event) =>
                  onMaxAgeChange(
                    event.target.value ? Number(event.target.value) : null
                  )
                }
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
          </>
        ) : null}
      </div>

      {showGradeFields ? (
        <div className={cn("mt-4 space-y-1.5", disabled && "opacity-60")}>
          <Label>Grade Levels</Label>
          <GradeLevelsMultiSelect
            selectedGrades={gradeLevels}
            onChange={onGradeLevelsChange}
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
