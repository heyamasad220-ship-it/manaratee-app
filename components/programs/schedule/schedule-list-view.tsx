"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatScheduleDay,
  formatScheduleTimeRange,
  type VisualScheduleItem,
} from "@/lib/programs/weekly-schedule-board"

export function ScheduleListView({
  items,
}: {
  items: VisualScheduleItem[]
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Day</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Offering</TableHead>
            <TableHead>Instructor</TableHead>
            <TableHead>Space</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                {formatScheduleDay(row.dayOfWeek)}
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {formatScheduleTimeRange(row.startTime, row.endTime) || "—"}
              </TableCell>
              <TableCell>{row.offeringName}</TableCell>
              <TableCell className="text-muted-foreground">
                {row.instructorName || "Teacher not assigned"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.spaceName || "Room not assigned"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
