"use client"

import { GradeLevelsMultiSelect } from "@/components/programs/grade-levels-multi-select"
import { Label } from "@/components/ui/label"

import { EditSectionCard } from "./edit-section-card"
import { AGE_OPTIONS, ageSelectValue, getGradeLevelsDisplayLabel, gradesApplyForMinAge } from "./utils"
import type { ProgramGender } from "./types"

export function EligibilitySection({
  minAge,
  maxAge,
  onMinAgeChange,
  onMaxAgeChange,
  gradeLevels,
  onGradeLevelsChange,
  programGender,
  onProgramGenderChange,
}: {
  minAge: number | null
  maxAge: number | null
  onMinAgeChange: (age: number | null) => void
  onMaxAgeChange: (age: number | null) => void
  gradeLevels: string[]
  onGradeLevelsChange: (grades: string[]) => void
  programGender: ProgramGender
  onProgramGenderChange: (gender: ProgramGender) => void
}) {
  const showGradeFields = gradesApplyForMinAge(minAge)

  return (
    <EditSectionCard
      title="Eligibility"
      description="Control who can register and what information is required."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="min_age">Minimum Age</Label>
          <select
            id="min_age"
            value={ageSelectValue(minAge)}
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

        <div className="space-y-1.5">
          <Label>Grade Levels</Label>
          {showGradeFields ? (
            <GradeLevelsMultiSelect
              selectedGrades={gradeLevels}
              onChange={onGradeLevelsChange}
            />
          ) : (
            <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
              {getGradeLevelsDisplayLabel(minAge)}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gender">Gender</Label>
          <select
            id="gender"
            name="gender"
            value={programGender}
            onChange={(event) =>
              onProgramGenderChange(event.target.value as ProgramGender)
            }
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="All">All genders</option>
            <option value="Male">Male only</option>
            <option value="Female">Female only</option>
          </select>
        </div>
      </div>
    </EditSectionCard>
  )
}
