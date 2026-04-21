"use client"

import { useState } from "react"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EventStatusBadge } from "@/lib/status-badges"
import { upcomingEvents } from "@/lib/mock-data"

export function UpcomingEventsTable() {
  const [nameFilter, setNameFilter] = useState("")
  const [venueFilter, setVenueFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filtered = upcomingEvents.filter((event) => {
    if (nameFilter && !event.name.toLowerCase().includes(nameFilter.toLowerCase())) return false
    if (venueFilter && !event.venue.toLowerCase().includes(venueFilter.toLowerCase())) return false
    if (statusFilter !== "all" && event.status !== statusFilter) return false
    return true
  })

  const clearFilters = () => {
    setNameFilter("")
    setVenueFilter("")
    setStatusFilter("all")
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filter Bar */}
      <div className="grid grid-cols-3 gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Name</label>
          <Input
            placeholder="Name"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="bg-card"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Venue</label>
          <Input
            placeholder="Venue"
            value={venueFilter}
            onChange={(e) => setVenueFilter(e.target.value)}
            className="bg-card"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Status <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground" />
            </label>
            <button
              suppressHydrationWarning
              onClick={clearFilters}
              className="text-sm text-primary hover:underline"
            >
              Clear
            </button>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Published">Published</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Section Title */}
      <h3 className="text-lg font-semibold text-foreground">Upcoming Events</h3>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-medium text-muted-foreground">Event Name</TableHead>
              <TableHead className="font-medium text-muted-foreground">
                Date &amp; Time <ArrowUpDown className="ml-1 inline h-3 w-3" />
              </TableHead>
              <TableHead className="font-medium text-muted-foreground">Venue</TableHead>
              <TableHead className="font-medium text-muted-foreground">Status</TableHead>
              <TableHead className="text-right font-medium text-muted-foreground">Tickets Issued</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((event) => (
              <TableRow key={event.id} className="group">
                <TableCell className="font-medium text-primary">{event.name}</TableCell>
                <TableCell className="text-foreground">
                  <div>{event.date}</div>
                  {event.time && (
                    <div className="text-xs text-muted-foreground">{event.time}</div>
                  )}
                </TableCell>
                <TableCell className="text-foreground">{event.venue}</TableCell>
                <TableCell><EventStatusBadge status={event.status} /></TableCell>
                <TableCell className="text-right text-foreground">{event.ticketsIssued}</TableCell>
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
