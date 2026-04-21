"use client"

import { useState, useMemo } from "react"
import { MoreHorizontal, Search, CalendarIcon, X } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface VenueRental {
  id: string
  date: string
  customer: string
  eventType: string
  space: string
  cost: number
  deposit: number
  remaining: number
}

const venueRentals: VenueRental[] = [
  { id: "vr-1", date: "Mar 5, 2026", customer: "Hassan Family", eventType: "Wedding", space: "Banquet Hall", cost: 4500, deposit: 2000, remaining: 2500 },
  { id: "vr-2", date: "Mar 12, 2026", customer: "TechCo Inc.", eventType: "Corporate Event", space: "Main Conference Room", cost: 1200, deposit: 600, remaining: 600 },
  { id: "vr-3", date: "Mar 18, 2026", customer: "Mahmoud Ali", eventType: "Birthday Party", space: "Space Two", cost: 800, deposit: 400, remaining: 400 },
  { id: "vr-4", date: "Mar 25, 2026", customer: "Community Board", eventType: "Dinner Banquet", space: "Banquet Hall", cost: 3200, deposit: 1600, remaining: 1600 },
  { id: "vr-5", date: "Apr 2, 2026", customer: "Youth Council", eventType: "Graduation", space: "Training Room", cost: 650, deposit: 325, remaining: 325 },
  { id: "vr-6", date: "Apr 10, 2026", customer: "Al-Noor Foundation", eventType: "Engagement", space: "Banquet Hall", cost: 5500, deposit: 3000, remaining: 2500 },
  { id: "vr-7", date: "Apr 15, 2026", customer: "Sarah Khan", eventType: "Baby Shower", space: "Space One", cost: 1800, deposit: 900, remaining: 900 },
  { id: "vr-8", date: "Feb 14, 2026", customer: "Reading Club", eventType: "Meeting", space: "Youth Lounge", cost: 350, deposit: 350, remaining: 0 },
  { id: "vr-9", date: "Feb 8, 2026", customer: "Khan Family", eventType: "Engagement", space: "Banquet Hall", cost: 3800, deposit: 3800, remaining: 0 },
  { id: "vr-10", date: "Jan 20, 2026", customer: "Salam Group", eventType: "Corporate Event", space: "Main Conference Room", cost: 900, deposit: 900, remaining: 0 },
]

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function VenueRentals() {
  const [search, setSearch] = useState("")
  const [spaceFilter, setSpaceFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)

  const totalRentals = venueRentals.length
  const nextRental = venueRentals
    .filter((r) => new Date(r.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]

  const daysUntilNext = nextRental
    ? Math.ceil((new Date(nextRental.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const spaces = [...new Set(venueRentals.map((r) => r.space))].sort()

  const filtered = useMemo(() => {
    let result = venueRentals

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.customer.toLowerCase().includes(q) ||
          r.eventType.toLowerCase().includes(q) ||
          r.space.toLowerCase().includes(q)
      )
    }

    if (spaceFilter !== "all") {
      result = result.filter((r) => r.space === spaceFilter)
    }

    if (dateFrom) {
      result = result.filter((r) => new Date(r.date) >= dateFrom)
    }

    if (dateTo) {
      result = result.filter((r) => new Date(r.date) <= dateTo)
    }

    return result
  }, [search, spaceFilter, dateFrom, dateTo])

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border border-border shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-medium text-muted-foreground">Next Venue Rental In</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {daysUntilNext} days
            </p>
            {nextRental && (
              <p className="mt-1 text-sm text-muted-foreground">
                {nextRental.customer} ({nextRental.eventType}) &middot; {nextRental.date}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-medium text-muted-foreground">Total Rentals</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {totalRentals}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">All Rentals</h2>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search rentals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 w-[150px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                {dateFrom ? format(dateFrom, "MMM d, yyyy") : <span className="text-muted-foreground">From</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 w-[150px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                {dateTo ? format(dateTo, "MMM d, yyyy") : <span className="text-muted-foreground">To</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                setDateFrom(undefined)
                setDateTo(undefined)
              }}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear date range</span>
            </Button>
          )}
          <Select value={spaceFilter} onValueChange={setSpaceFilter}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="All Spaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Spaces</SelectItem>
              {spaces.map((space) => (
                <SelectItem key={space} value={space}>
                  {space}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium text-muted-foreground">Date</TableHead>
                <TableHead className="font-medium text-muted-foreground">Customer</TableHead>
                <TableHead className="font-medium text-muted-foreground">Event Type</TableHead>
                <TableHead className="font-medium text-muted-foreground">Space</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground">Cost</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground">Deposit</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground">Remaining</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No rentals found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((rental) => (
                  <TableRow key={rental.id} className="group">
                    <TableCell className="text-muted-foreground">{rental.date}</TableCell>
                    <TableCell className="font-medium text-foreground">{rental.customer}</TableCell>
                    <TableCell className="text-muted-foreground">{rental.eventType}</TableCell>
                    <TableCell className="text-muted-foreground">{rental.space}</TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {formatCurrency(rental.cost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {formatCurrency(rental.deposit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-foreground">
                      {rental.remaining === 0 ? (
                        <span className="text-emerald-600">Paid</span>
                      ) : (
                        formatCurrency(rental.remaining)
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        suppressHydrationWarning
                        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">
              {filtered.length} rentals
            </span>
            <span className="text-sm font-medium text-foreground">
              Total Cost: {formatCurrency(filtered.reduce((sum, r) => sum + r.cost, 0))}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
