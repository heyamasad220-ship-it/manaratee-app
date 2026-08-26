"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type ScheduleBoardView = "board" | "list"

export function ScheduleViewToggle({
  value,
  onChange,
}: {
  value: ScheduleBoardView
  onChange: (view: ScheduleBoardView) => void
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next === "board" || next === "list") onChange(next)
      }}
      variant="outline"
      size="sm"
      aria-label="Class times view"
      className="bg-muted/40"
    >
      <ToggleGroupItem
        value="board"
        aria-label="Week Board"
        className="px-3 data-[state=on]:bg-background data-[state=on]:shadow-sm"
      >
        Week Board
      </ToggleGroupItem>
      <ToggleGroupItem
        value="list"
        aria-label="List"
        className="px-3 data-[state=on]:bg-background data-[state=on]:shadow-sm"
      >
        List
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
