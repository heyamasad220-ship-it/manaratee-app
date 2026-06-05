"use client"

import * as React from "react"
import { Check, ChevronDown, GripVertical, Pencil, Plus, Trash2 } from "lucide-react"

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
import {
  buildCapacityGroupFromDraft,
  getCapacityGroupGradeCatalog,
  getEffectiveGroupGrades,
  getGradeLevelsLabel,
  sortGrades,
} from "@/lib/programs/program-capacity-group-utils"
import { suggestCapacityGroupName } from "@/lib/programs/grade-levels"
import { cn } from "@/lib/utils"

type DraftGroup = {
  name: string
  grade_levels: string[]
  genders: string[]
  capacity: number
}

function getTakenGradesForGenders(
  groups: ProgramCapacityGroupInput[],
  targetGenders: string[],
  excludeIndex: number | null,
  eligibleGrades: string[],
  programGender: "All" | "Male" | "Female"
) {
  const taken = new Set<string>()
  const relevantGroups = groups.filter((_, index) => index !== excludeIndex)
  const targetIsAnyGender = targetGenders.length === 0
  const targetIsMale = targetGenders.includes("Male")
  const targetIsFemale = targetGenders.includes("Female")

  for (const grade of eligibleGrades) {
    const anyGenderGroupHas = relevantGroups.some(
      (group) =>
        group.genders.length === 0 &&
        getEffectiveGroupGrades(group, eligibleGrades).includes(grade)
    )

    if (anyGenderGroupHas) {
      taken.add(grade)
      continue
    }

    const maleGroupHas = relevantGroups.some(
      (group) =>
        group.genders.includes("Male") &&
        getEffectiveGroupGrades(group, eligibleGrades).includes(grade)
    )
    const femaleGroupHas = relevantGroups.some(
      (group) =>
        group.genders.includes("Female") &&
        getEffectiveGroupGrades(group, eligibleGrades).includes(grade)
    )

    if (targetIsAnyGender) {
      if (programGender === "All") {
        if (maleGroupHas && femaleGroupHas) {
          taken.add(grade)
        }
      } else if (programGender === "Male") {
        if (maleGroupHas) {
          taken.add(grade)
        }
      } else if (femaleGroupHas) {
        taken.add(grade)
      }
      continue
    }

    if (targetIsMale && maleGroupHas) {
      taken.add(grade)
      continue
    }

    if (targetIsFemale && femaleGroupHas) {
      taken.add(grade)
    }
  }

  return taken
}

function getGradeBlockersForGenders(
  groups: ProgramCapacityGroupInput[],
  targetGenders: string[],
  excludeIndex: number | null,
  eligibleGrades: string[],
  programGender: "All" | "Male" | "Female"
) {
  const blockers = new Map<string, string[]>()
  const taken = getTakenGradesForGenders(
    groups,
    targetGenders,
    excludeIndex,
    eligibleGrades,
    programGender
  )

  groups.forEach((group, index) => {
    if (index === excludeIndex) {
      return
    }

    const label = `${group.name || "Unnamed group"} (${getGroupGenderLabel(group.genders)})`

    getEffectiveGroupGrades(group, eligibleGrades).forEach((grade) => {
      if (!taken.has(grade)) {
        return
      }

      const existing = blockers.get(grade) || []
      blockers.set(grade, [...existing, label])
    })
  })

  return blockers
}

function isDraftCommittable(draft: DraftGroup) {
  return draft.name.trim().length > 0 && Number(draft.capacity) > 0
}

function applyDraftToGroups(
  groups: ProgramCapacityGroupInput[],
  draft: DraftGroup,
  editingIndex: number | null,
  eligibleGrades: string[]
) {
  const nextGroup = buildCapacityGroupFromDraft(draft, eligibleGrades)

  if (editingIndex !== null) {
    return groups.map((group, index) =>
      index === editingIndex
        ? {
            ...group,
            ...nextGroup,
          }
        : group
    )
  }

  return [...groups, nextGroup]
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
  emptyMessage,
  emptyLabel = "Select grades",
}: {
  options: string[]
  selectedGrades: string[]
  onChange: (grades: string[]) => void
  emptyMessage?: string
  emptyLabel?: string
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
          <span className="truncate">
            {getGradeLevelsLabel(selectedGrades, emptyLabel)}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-2"
        align="start"
      >
        {options.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            {emptyMessage ||
              "No grades available for this group. Try a different gender or edit an existing group."}
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

            <div className="border-t px-2 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-full text-xs"
                onClick={() => setOpen(false)}
              >
                Ok
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

export type ProgramCapacityGroupEditorHandle = {
  flushPendingDraft: () => ProgramCapacityGroupInput[]
}

export const ProgramCapacityGroupEditor = React.forwardRef<
  ProgramCapacityGroupEditorHandle,
  {
    selectedGrades: string[]
    programGender: "All" | "Male" | "Female"
    groups: ProgramCapacityGroupInput[]
    onChange: (groups: ProgramCapacityGroupInput[]) => void
    totalCapacity: number
    onTotalCapacityChange: (capacity: number) => void
  }
>(function ProgramCapacityGroupEditor(
  {
    selectedGrades,
    programGender,
    groups,
    onChange,
    totalCapacity,
    onTotalCapacityChange,
  },
  ref
) {
  const [draft, setDraft] = React.useState<DraftGroup>(() => ({
    name: "",
    grade_levels: [],
    genders: [],
    capacity: 0,
  }))
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null)
  const [draggedGroupIndex, setDraggedGroupIndex] = React.useState<number | null>(
    null
  )
  const [dropTargetIndex, setDropTargetIndex] = React.useState<number | null>(
    null
  )

  const gradeCatalog = getCapacityGroupGradeCatalog(
    sortGrades(selectedGrades),
    draft.grade_levels
  )

  const usingGroupCapacity = groups.length > 0
  const takenGradesForDraft = getTakenGradesForGenders(
    groups,
    draft.genders,
    editingIndex,
    gradeCatalog,
    programGender
  )
  const availableGradesForDraft = sortGrades(
    gradeCatalog.filter((grade) => !takenGradesForDraft.has(grade))
  )

  const genderOnlyGroups = groups.filter(
    (group, index) =>
      index !== editingIndex &&
      getEffectiveGroupGrades(group, gradeCatalog).length === 0 &&
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

    return {
      name: "",
      grade_levels: [],
      genders,
      capacity: 0,
    }
  }

  function syncGroups(nextGroups: ProgramCapacityGroupInput[]) {
    onChange(nextGroups)
    onTotalCapacityChange(getTotalCapacityFromGroups(nextGroups))

    if (nextGroups.length === 0) {
      resetDraft()
    }
  }

  React.useImperativeHandle(
    ref,
    () => ({
      flushPendingDraft() {
        return groups
      },
    }),
    [draft, editingIndex, groups, gradeCatalog]
  )

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
      grade_levels: getEffectiveGroupGrades(group, gradeCatalog),
      genders: [...group.genders],
      capacity: group.capacity,
    })
  }

  function updateDraft(updates: Partial<DraftGroup>) {
    setDraft((current) => ({ ...current, ...updates }))
  }

  function commitDraft() {
    if (!isDraftCommittable(draft)) {
      return
    }

    syncGroups(
      applyDraftToGroups(groups, draft, editingIndex, gradeCatalog)
    )
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

  function moveGroup(fromIndex: number, toIndex: number) {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= groups.length ||
      toIndex >= groups.length
    ) {
      return
    }

    const nextGroups = [...groups]
    const [moved] = nextGroups.splice(fromIndex, 1)
    nextGroups.splice(toIndex, 0, moved)

    if (editingIndex !== null) {
      if (editingIndex === fromIndex) {
        setEditingIndex(toIndex)
      } else if (fromIndex < editingIndex && toIndex >= editingIndex) {
        setEditingIndex(editingIndex - 1)
      } else if (fromIndex > editingIndex && toIndex <= editingIndex) {
        setEditingIndex(editingIndex + 1)
      }
    }

    onChange(nextGroups)
  }

  function getGradePickerEmptyMessage() {
    if (availableGradesForDraft.length > 0) {
      return undefined
    }

    const blockers = getGradeBlockersForGenders(
      groups,
      draft.genders,
      editingIndex,
      gradeCatalog,
      programGender
    )
    const genderLabel = getGroupGenderLabel(draft.genders)
    const blockedGrades = sortGrades(
      gradeCatalog.filter((grade) => !availableGradesForDraft.includes(grade))
    )

    if (blockedGrades.length === 0) {
      return `No eligible grades are configured for this program. Update grade levels in Eligibility first.`
    }

    const examples = blockedGrades.slice(0, 3).map((grade) => {
      const sources = blockers.get(grade) || []
      return sources.length > 0
        ? `${grade} → ${sources.join(", ")}`
        : grade
    })

    return `No grades left for ${genderLabel}. ${examples.join(" · ")}`
  }

  function getGradeOptionsForDraft() {
    const editingGroupGrades =
      editingIndex !== null && groups[editingIndex]
        ? getEffectiveGroupGrades(groups[editingIndex], gradeCatalog)
        : []

    return sortGrades(
      Array.from(
        new Set([
          ...availableGradesForDraft,
          ...draft.grade_levels,
          ...editingGroupGrades,
        ])
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

    const genderOptions = GENDER_CAPACITY_VALUES.filter((gender) => {
      if (gender === currentValue) return true
      return !draftGenderOnlyTaken.has(gender)
    }).map((gender) => ({
      value: gender,
      label: gender,
    }))

    if (draft.genders.length === 0) {
      return [{ value: "", label: "Any gender" }, ...genderOptions]
    }

    return genderOptions
  }

  const canCommitDraft = isDraftCommittable(draft)

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
          Enter a group name, grades or gender, and capacity in the row below,
          then click + to add it. Drag saved groups to reorder them.
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" aria-label="Reorder" />
                <TableHead>Group Name</TableHead>
                <TableHead>Grades</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead className="w-28 text-right">Capacity</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              <TableRow className="bg-muted/20">
                    <TableCell className="w-10" />
                    <TableCell className="min-w-[140px] align-top">
                      <Input
                        id="capacity-group-draft-name"
                        aria-label="Group name"
                        value={draft.name}
                        onChange={(event) =>
                          updateDraft({ name: event.target.value })
                        }
                        onKeyDown={preventFormSubmitOnEnter}
                        placeholder="Enter group name"
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
                          emptyMessage={getGradePickerEmptyMessage()}
                          emptyLabel="Select grades"
                          onChange={(grade_levels) => {
                            const sorted = sortGrades(grade_levels)
                            updateDraft({
                              grade_levels: sorted,
                              name:
                                draft.name.trim() ||
                                suggestCapacityGroupName(sorted),
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
                                  editingIndex,
                                  gradeCatalog,
                                  programGender
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
                      editingIndex === index && "bg-muted/40 opacity-60",
                      draggedGroupIndex === index && "opacity-50",
                      dropTargetIndex === index &&
                        draggedGroupIndex !== index &&
                        "bg-primary/5 ring-1 ring-inset ring-primary/20"
                    )}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = "move"
                      setDropTargetIndex(index)
                    }}
                    onDragLeave={() => {
                      setDropTargetIndex((current) =>
                        current === index ? null : current
                      )
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      if (draggedGroupIndex !== null) {
                        moveGroup(draggedGroupIndex, index)
                      }
                      setDraggedGroupIndex(null)
                      setDropTargetIndex(null)
                    }}
                  >
                    <TableCell className="w-10 align-middle">
                      <button
                        type="button"
                        draggable
                        aria-label={`Reorder ${group.name || "capacity group"}`}
                        title="Drag to reorder"
                        className="flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move"
                          event.dataTransfer.setData(
                            "text/plain",
                            String(index)
                          )
                          setDraggedGroupIndex(index)
                        }}
                        onDragEnd={() => {
                          setDraggedGroupIndex(null)
                          setDropTargetIndex(null)
                        }}
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-normal font-medium">
                      {group.name}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {getGradeLevelsLabel(
                        getEffectiveGroupGrades(group, gradeCatalog)
                      )}
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
                    <TableCell colSpan={4} className="font-medium">
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
})

/** @deprecated Use ProgramCapacityGroupEditor */
export const ProgramGradeCapacityEditor = ProgramCapacityGroupEditor
