"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import { InternalEventDbStatusBadge } from "@/components/events/internal-event-db-status-badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatEventDate,
  formatEventTimeRange,
} from "@/lib/events/internal-event-format"
import type { InternalEventStatus } from "@/lib/events/internal-event-status"
import {
  formatVolunteerCoverage,
  signUpOverviewSourceLabel,
  signUpOverviewWhenMatches,
  type SignUpOverviewEvent,
  type SignUpOverviewSource,
  type SignUpOverviewWhen,
} from "@/lib/sign-ups/sign-up-overview"

const sourceFilters: Array<{ value: "all" | SignUpOverviewSource; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "event-management", label: "Event Management" },
  { value: "vendor-hub", label: "Vendor Hub" },
]

const whenFilters: Array<{ value: SignUpOverviewWhen; label: string }> = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All dates" },
]

export function SignUpsOverviewClient({
  events,
}: {
  events: SignUpOverviewEvent[]
}) {
  const [search, setSearch] = useState("")
  const [source, setSource] = useState<"all" | SignUpOverviewSource>("all")
  const [when, setWhen] = useState<SignUpOverviewWhen>("upcoming")

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const rows = events.filter((event) => {
      if (source !== "all" && event.source !== source) return false
      if (!signUpOverviewWhenMatches(event, when)) return false
      if (!query) return true
      return (
        event.name.toLowerCase().includes(query) ||
        (event.location || "").toLowerCase().includes(query) ||
        signUpOverviewSourceLabel(event.source).toLowerCase().includes(query)
      )
    })

    if (when === "past") {
      return [...rows].sort((left, right) => {
        const leftTime = left.startAt ? new Date(left.startAt).getTime() : 0
        const rightTime = right.startAt ? new Date(right.startAt).getTime() : 0
        return rightTime - leftTime
      })
    }

    return rows
  }, [events, search, source, when])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search events"
            className="pl-9"
            aria-label="Search events"
          />
        </div>
        <Select
          value={source}
          onValueChange={(value) =>
            setSource(value as "all" | SignUpOverviewSource)
          }
        >
          <SelectTrigger className="w-full sm:w-[200px]" aria-label="Source">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sourceFilters.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={when}
          onValueChange={(value) => setWhen(value as SignUpOverviewWhen)}
        >
          <SelectTrigger className="w-full sm:w-[160px]" aria-label="When">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {whenFilters.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} event{filtered.length === 1 ? "" : "s"}
      </p>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Volunteers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {events.length === 0
                    ? "No events need volunteers yet. Turn on volunteers in an event’s Service Needs. Bazaars show up here once that same need is on."
                    : "No events match these filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <Link
                      href={event.href}
                      className="font-medium text-primary hover:underline"
                    >
                      {event.name}
                    </Link>
                  </TableCell>
                  <TableCell>{signUpOverviewSourceLabel(event.source)}</TableCell>
                  <TableCell>{formatEventDate(event.startAt)}</TableCell>
                  <TableCell>
                    {formatEventTimeRange(event.startAt, event.endAt)}
                  </TableCell>
                  <TableCell>{event.location || "—"}</TableCell>
                  <TableCell>
                    <InternalEventDbStatusBadge
                      status={event.status as InternalEventStatus}
                      startAt={event.startAt}
                      endAt={event.endAt}
                    />
                  </TableCell>
                  <TableCell>
                    {formatVolunteerCoverage(
                      event.volunteersFilled,
                      event.volunteersNeeded
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
