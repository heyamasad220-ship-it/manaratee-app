"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  GRADE_LEVELS,
  getGradeRange,
  getMinMaxGradeFromLevels,
} from "@/lib/programs/grade-levels"

export { GRADE_LEVELS, getGradeRange, getMinMaxGradeFromLevels }

function getGradeLevelsLabel(selectedGrades: string[]) {
  if (selectedGrades.length === 0) {
    return "All grades"
  }

  if (selectedGrades.length === 1) {
    return selectedGrades[0]
  }

  if (selectedGrades.length <= 3) {
    return selectedGrades.join(", ")
  }

  return `${selectedGrades.length} grades selected`
}

export function GradeLevelsMultiSelect({
  selectedGrades,
  onChange,
  disabled = false,
}: {
  selectedGrades: string[]
  onChange: (grades: string[]) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)

  function toggleGradeLevel(value: string) {
    onChange(
      selectedGrades.includes(value)
        ? selectedGrades.filter((grade) => grade !== value)
        : [...selectedGrades, value]
    )
  }

  function toggleAllGrades() {
    onChange(
      selectedGrades.length === GRADE_LEVELS.length
        ? []
        : [...GRADE_LEVELS]
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
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
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Grade Levels</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={toggleAllGrades}
          >
            {selectedGrades.length === GRADE_LEVELS.length
              ? "Clear all"
              : "Select all"}
          </Button>
        </div>

        <div className="max-h-64 overflow-y-auto p-2">
          {GRADE_LEVELS.map((grade) => {
            const isSelected = selectedGrades.includes(grade)

            return (
              <label
                key={grade}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleGradeLevel(grade)}
                />
                <span className="text-sm">{grade}</span>
              </label>
            )
          })}
        </div>

        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          {selectedGrades.length === 0
            ? "Leave empty to allow all grades."
            : `${selectedGrades.length} grade${selectedGrades.length === 1 ? "" : "s"} selected.`}
        </div>
      </PopoverContent>
    </Popover>
  )
}
