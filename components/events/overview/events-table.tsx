"use client"

import { useState } from "react"
import Link from "next/link"
import { MoreHorizontal, Plus, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { allEvents, upcomingEvents, pastEvents, type EventStatus } from "@/lib/mock-data"

const filterTabs = ["Upcoming", "Past"] as const

const locationStyles: Record<string, string> = {
  Internal: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  "External Venue": "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Online: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
}

function getStatusBadge(status: EventStatus) {
  const styles: Record<EventStatus, string> = {
    Published: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Draft: "bg-amber-100 text-amber-700 border-amber-200",
    "Sales Closed": "bg-gray-100 text-gray-600 border-gray-200",
  }
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", styles[status])}>
      {status}
    </Badge>
  )
}

export function OverviewEventsTable() {
  const [activeFilter, setActiveFilter] = useState<string>("Upcoming")

  const filtered = activeFilter === "Upcoming"
    ? upcomingEvents
    : pastEvents

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0 rounded-lg border border-border bg-card p-0.5">
            {filterTabs.map((tab) => (
              <button
                key={tab}
                suppressHydrationWarning
                onClick={() => setActiveFilter(tab)}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                  activeFilter === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-medium text-muted-foreground">Event Name</TableHead>
              <TableHead className="font-medium text-muted-foreground">Status</TableHead>
              <TableHead className="font-medium text-muted-foreground">Date</TableHead>
              <TableHead className="font-medium text-muted-foreground">Location</TableHead>
              <TableHead className="text-right font-medium text-muted-foreground">Tickets Issued</TableHead>
              <TableHead className="text-right font-medium text-muted-foreground">Revenue</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((event) => (
              <TableRow key={event.id} className="group">
                <TableCell className="font-medium text-primary">
                  {event.name}
                </TableCell>
                <TableCell>{getStatusBadge(event.status)}</TableCell>
                <TableCell className="text-foreground">{event.date}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={locationStyles[event.venue] || ""}>
                    {event.venue}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-foreground">{event.ticketsIssued}</TableCell>
                <TableCell className="text-right text-foreground">
                  ${event.revenue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </TableCell>
                <TableCell>
                  <button suppressHydrationWarning className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
