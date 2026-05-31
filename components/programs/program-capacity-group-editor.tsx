"use client"

import * as React from "react"
import { Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  GENDER_CAPACITY_VALUES,
  getGroupGenderLabel,
  getTotalCapacityFromGroups,
  type ProgramCapacityGroupInput,
} from "@/lib/programs/program-capacity-group-types"
import { GRADE_LEVELS } from "@/components/programs/grade-levels-multi-select"
import { cn } from "@/lib/utils"

type DraftGroup = {
  name: string
  grade_levels: string[]
  genders: string[]
  capacity: number
}

function sortGrades(grades: string[]) {
  return [...grades].sort(
    (a, b) => GRADE_LEVELS.indexOf(a as (typeof GRADE_LEVELS)[number]) -
      GRADE_LEVELS.indexOf(b as (typeof GRADE_LEVELS)[number])
  )
}

function suggestGradeGroupName(grades: string[]) {
  if (grades.length === 0) {
    return ""
  }

  const abbreviations: Record<string, string> = {
    "Pre-K": "PK",
    Kindergarten: "KG",
  }

  return grades.map((grade) => abbreviations[grade] || grade).join("/")
}

function suggestGenderGroupName(gender: string) {
  if (gender === "Male") return "Boys"
  if (gender === "Female") return "Girls"
  return gender
}

function gendersOverlap(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) {
    return true
  }

  return a.some((gender) => b.includes(gender))
}

function getTakenGradesForGenders(
  groups: ProgramCapacityGroupInput[],
  targetGenders: string[],
  excludeIndex: number | null
) {
  const taken = new Set<string>()

  groups.forEach((group, index) => {
    if (index === excludeIndex) {
      return
    }

    if (!gendersOverlap(group.genders, targetGenders)) {
      return
    }

    group.grade_levels.forEach((grade) => taken.add(grade))
  })

  return taken
}

function getGradeLevelsLabel(grades: string[]) {
  if (grades.length === 0) {
    return "All grades"
  }

  if (grades.length <= 3) {
    return grades.join(", ")
  }

  return `${grades.length} grades selected`
}

function preventFormSubmitOnEnter(event: React.KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault()
  }
}

function GroupGradePicker({
  options,
  selectedGrades,
  onChange,
}: {
  options: string[]
  selectedGrades: string[]
  onChange: (grades: string[]) => void
}) {
  const [open, setOpen] = React.useState(false)

  function toggleGrade(grade: string) {
    onChange(
      selectedGrades.includes(grade)
        ? selectedGrades.filter((item) => item !== grade)
        : [...selectedGrades, grade]
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-10 w-full justify-between font-normal",
            selectedGrades.length === 0 && "text-muted-foreground"
          )}
        >
          <span className="truncate">{getGradeLevelsLabel(selectedGrades)}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-2"
        align="start"
      >
        {options.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            No grades available for this group.
          </p>
        ) : (
          <>
            {options.map((grade) => (
              <label
                key={grade}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
              >
                <Checkbox
                  checked={selectedGrades.includes(grade)}
                  onCheckedChange={() => toggleGrade(grade)}
                />
                <span className="text-sm">{grade}</span>
              </label>
            ))}

            {selectedGrades.length > 0 && (
              <div className="border-t px-2 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full text-xs"
                  onClick={() => onChange([])}
                >
                  Clear grades
                </Button>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function ProgramCapacityGroupEditor({
  selectedGrades,
  programGender,
  groups,
  onChange,
  totalCapacity,
  onTotalCapacityChange,
}: {
  selectedGrades: string[]
  programGender: "All" | "Male" | "Female"
  groups: ProgramCapacityGroupInput[]
  onChange: (groups: ProgramCapacityGroupInput[]) => void
  totalCapacity: number
  onTotalCapacityChange: (capacity: number) => void
}) {
  const [draft, setDraft] = React.useState<DraftGroup>(() => ({
    name: "",
    grade_levels: [],
    genders: [],
    capacity: 0,
  }))
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null)

  const usingGroupCapacity = groups.length > 0
  const takenGradesForDraft = getTakenGradesForGenders(
    groups,
    draft.genders,
    editingIndex
  )
  const availableGradesForDraft = sortGrades(
    selectedGrades.filter((grade) => !takenGradesForDraft.has(grade))
  )
  const gradesInAnyGroup = new Set(groups.flatMap((group) => group.grade_levels))
  const unassignedGrades = sortGrades(
    selectedGrades.filter((grade) => !gradesInAnyGroup.has(grade))
  )

  const genderOnlyGroups = groups.filter(
    (group, index) =>
      index !== editingIndex &&
      group.grade_levels.length === 0 &&
      group.genders.length > 0
  )
  const assignedGenderOnly = new Set(
    genderOnlyGroups.flatMap((group) => group.genders)
  )

  const draftGenderOnlyTaken = new Set(
    draft.grade_levels.length === 0 && draft.genders[0]
      ? assignedGenderOnly
      : []
  )

  const groupsTotalCapacity = getTotalCapacityFromGroups(groups)

  function buildDefaultDraft(): DraftGroup {
    const genders =
      programGender === "Male"
        ? ["Male"]
        : programGender === "Female"
          ? ["Female"]
          : []

    const grades = sortGrades(
      selectedGrades.filter(
        (grade) =>
          !getTakenGradesForGenders(groups, genders, editingIndex).has(grade)
      )
    )

    let name = ""
    if (grades.length > 0) {
      name = suggestGradeGroupName(grades)
    } else if (genders[0]) {
      name = suggestGenderGroupName(genders[0])
    }

    return {
      name,
      grade_levels: grades,
      genders,
      capacity: 0,
    }
  }

  React.useEffect(() => {
    if (selectedGrades.length === 0) {
      return
    }

    const allowed = new Set(selectedGrades)
    let hasChanges = false

    const nextGroups = groups.map((group) => {
      const grade_levels = sortGrades(
        group.grade_levels.filter((grade) => allowed.has(grade))
      )
      const previousGrades = sortGrades(group.grade_levels)

      if (
        grade_levels.length !== previousGrades.length ||
        grade_levels.some((grade, index) => grade !== previousGrades[index])
      ) {
        hasChanges = true
      }

      return {
        ...group,
        grade_levels,
      }
    })

    if (hasChanges) {
      syncGroups(nextGroups)
    }
    // Only re-sync when program eligibility grades change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGrades])

  React.useEffect(() => {
    if (editingIndex === null) {
      setDraft(buildDefaultDraft())
    }
    // Pre-fill the add row from eligibility when not editing a saved group.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGrades, programGender, groups.length, editingIndex])

  function syncGroups(nextGroups: ProgramCapacityGroupInput[]) {
    onChange(nextGroups)

    if (nextGroups.length > 0) {
      onTotalCapacityChange(getTotalCapacityFromGroups(nextGroups))
    }
  }

  function resetDraft() {
    setEditingIndex(null)
    setDraft(buildDefaultDraft())
  }

  function startEditGroup(index: number) {
    const group = groups[index]
    if (!group) return

    setEditingIndex(index)
    setDraft({
      name: group.name,
      grade_levels: [...group.grade_levels],
      genders: [...group.genders],
      capacity: group.capacity,
    })
  }

  function updateDraft(updates: Partial<DraftGroup>) {
    setDraft((current) => ({ ...current, ...updates }))
  }

  function commitDraft() {
    if (draft.grade_levels.length === 0 && draft.genders.length === 0) {
      return
    }

    const nextGroup: ProgramCapacityGroupInput = {
      name:
        draft.name.trim() ||
        suggestGradeGroupName(draft.grade_levels) ||
        suggestGenderGroupName(draft.genders[0] || "") ||
        `Group ${groups.length + 1}`,
      grade_levels: sortGrades(draft.grade_levels),
      genders: draft.genders,
      capacity: Number(draft.capacity || 0),
    }

    if (editingIndex !== null) {
      syncGroups(
        groups.map((group, index) =>
          index === editingIndex
            ? {
                ...group,
                ...nextGroup,
              }
            : group
        )
      )
    } else {
      syncGroups([...groups, nextGroup])
    }

    resetDraft()
  }

  function removeGroup(index: number) {
    if (editingIndex === index) {
      resetDraft()
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1)
    }

    syncGroups(groups.filter((_, groupIndex) => groupIndex !== index))
  }

  function getGradeOptionsForDraft() {
    return sortGrades(
      Array.from(
        new Set([...availableGradesForDraft, ...draft.grade_levels])
      )
    )
  }

  function getGenderSelectValue(group: Pick<DraftGroup, "genders">) {
    return group.genders[0] || ""
  }

  function getGenderOptionsForDraft() {
    const currentValue = getGenderSelectValue(draft)

    if (programGender === "Male") {
      return [{ value: "Male", label: "Male" }]
    }

    if (programGender === "Female") {
      return [{ value: "Female", label: "Female" }]
    }

    if (draft.grade_levels.length > 0) {
      return [
        { value: "", label: "Any gender" },
        { value: "Male", label: "Male" },
        { value: "Female", label: "Female" },
      ]
    }

    return GENDER_CAPACITY_VALUES.filter((gender) => {
      if (gender === currentValue) return true
      return !draftGenderOnlyTaken.has(gender)
    }).map((gender) => ({
      value: gender,
      label: gender,
    }))
  }

  const canCommitDraft =
    draft.grade_levels.length > 0 || draft.genders.length > 0

  return (
    <div
      className="space-y-4 rounded-lg border p-4"
      onKeyDown={preventFormSubmitOnEnter}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Label>Capacity Groups</Label>
          {groups.length > 0 ? (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {groups.length} group{groups.length === 1 ? "" : "s"} · Total
              capacity: {groupsTotalCapacity}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the row below to add a group based on your eligibility settings.
          Click + when ready. Saved groups appear in the list below.
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group Name</TableHead>
                <TableHead>Grades</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead className="w-28 text-right">Capacity</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              <TableRow className="bg-muted/20">
                    <TableCell className="min-w-[140px] align-top">
                      <Input
                        id="capacity-group-draft-name"
                        aria-label="Group name"
                        value={draft.name}
                        onChange={(event) =>
                          updateDraft({ name: event.target.value })
                        }
                        onKeyDown={preventFormSubmitOnEnter}
                        placeholder="PK/KG or Boys"
                      />
                    </TableCell>

                    <TableCell className="min-w-[160px] align-top">
                      {selectedGrades.length === 0 ? (
                        <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                          All grades
                        </div>
                      ) : (
                        <GroupGradePicker
                          options={getGradeOptionsForDraft()}
                          selectedGrades={sortGrades(draft.grade_levels)}
                          onChange={(grade_levels) => {
                            updateDraft({
                              grade_levels: sortGrades(grade_levels),
                            })
                          }}
                        />
                      )}
                    </TableCell>

                    <TableCell className="min-w-[120px] align-top">
                      <select
                        id="capacity-group-draft-gender"
                        aria-label="Gender"
                        value={getGenderSelectValue(draft)}
                        onChange={(event) => {
                          const value = event.target.value
                          const genders = value ? [value] : []
                          const allowedGrades = sortGrades(
                            selectedGrades.filter(
                              (grade) =>
                                !getTakenGradesForGenders(
                                  groups,
                                  genders,
                                  editingIndex
                                ).has(grade)
                            )
                          )
                          const grade_levels = sortGrades(
                            draft.grade_levels.filter((grade) =>
                              allowedGrades.includes(grade)
                            )
                          )

                          updateDraft({
                            genders,
                            grade_levels,
                          })
                        }}
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        {getGenderOptionsForDraft().map((option) => (
                          <option
                            key={option.value || "any"}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </TableCell>

                    <TableCell className="w-28 align-top">
                      <Input
                        id="capacity-group-draft-capacity"
                        aria-label="Capacity"
                        type="number"
                        min="0"
                        value={draft.capacity}
                        onChange={(event) =>
                          updateDraft({
                            capacity: Number(event.target.value || 0),
                          })
                        }
                        onKeyDown={preventFormSubmitOnEnter}
                        placeholder="50"
                        className="text-right"
                      />
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="icon"
                          onClick={commitDraft}
                          disabled={!canCommitDraft}
                          aria-label={
                            editingIndex !== null ? "Update group" : "Add group"
                          }
                          title={
                            editingIndex !== null ? "Update group" : "Add group"
                          }
                        >
                          {editingIndex !== null ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                        {editingIndex !== null ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 px-2 text-xs"
                            onClick={resetDraft}
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>

                {groups.map((group, index) => (
                  <TableRow
                    key={`${group.id || "new"}-${index}`}
                    className={cn(
                      editingIndex === index && "bg-muted/40 opacity-60"
                    )}
                  >
                    <TableCell className="whitespace-normal font-medium">
                      {group.name}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {group.grade_levels.length > 0
                        ? group.grade_levels.join(", ")
                        : "All grades"}
                    </TableCell>
                    <TableCell>{getGroupGenderLabel(group.genders)}</TableCell>
                    <TableCell className="text-right">{group.capacity}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditGroup(index)}
                          aria-label={`Edit ${group.name || "capacity group"}`}
                          title="Edit group"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeGroup(index)}
                          disabled={editingIndex === index}
                          aria-label={`Remove ${group.name || "capacity group"}`}
                          title="Remove group"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>

              {groups.length > 0 ? (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-medium">
                      Total capacity ({groups.length}{" "}
                      {groups.length === 1 ? "group" : "groups"})
                    </TableCell>
                    <TableCell className="text-right text-base font-semibold">
                      {groupsTotalCapacity}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
          </div>

          {unassignedGrades.length > 0 ? (
            <p className="text-xs text-amber-600">
              Grades not in any capacity group: {unassignedGrades.join(", ")}
            </p>
          ) : null}
        </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="total-capacity">
            {usingGroupCapacity ? "Total Capacity" : "Program Capacity"}
          </Label>
          <Input
            id="total-capacity"
            type="number"
            min="0"
            value={totalCapacity}
            readOnly={usingGroupCapacity}
            onChange={(event) => {
              if (!usingGroupCapacity) {
                onTotalCapacityChange(Number(event.target.value || 0))
              }
            }}
            onKeyDown={preventFormSubmitOnEnter}
            placeholder="50"
            className={usingGroupCapacity ? "bg-muted" : undefined}
          />
          {usingGroupCapacity ? (
            <p className="text-xs text-muted-foreground">
              Total is calculated automatically from capacity groups.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** @deprecated Use ProgramCapacityGroupEditor */
export const ProgramGradeCapacityEditor = ProgramCapacityGroupEditor
