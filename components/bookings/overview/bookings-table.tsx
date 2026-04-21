"use client"

import { useState } from "react"
import { Search, Plus, MoreHorizontal, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { Badge } from "@/components/ui/badge"
import { bookings, type Booking, type BookingStatus } from "@/lib/mock-data"

const statusStyles: Record<BookingStatus, string> = {
  Approved: "bg-blue-100 text-blue-700 border-blue-200",
  Confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Cancelled: "bg-muted text-muted-foreground border-border",
  Rejected: "bg-red-100 text-red-700 border-red-200",
}

export function BookingsTable() {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredBookings = bookings.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.booker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.space.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Filters Row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select defaultValue="all">
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="main">Main Conference Room</SelectItem>
              <SelectItem value="space-one">Space One</SelectItem>
              <SelectItem value="training">Training Room</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2 text-sm">
            <span>April 19, 2024 - April 25, 2024</span>
          </Button>
        </div>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Booking
          <ChevronDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Search + Count */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">All Bookings</h2>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search Title, Booker, or other details"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[320px]"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Filters/Orders:</span>
          <Select defaultValue="sales">
            <SelectTrigger className="h-8 w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="date">Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Start Date & Time</TableHead>
              <TableHead>End Date & Time</TableHead>
              <TableHead>Space</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Booker</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell>
                  <div className="text-sm font-medium text-foreground">{booking.startDate}, {booking.startTime}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-foreground">{booking.endDate} {booking.endTime}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-foreground">{booking.space}</div>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium text-primary">{booking.title}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusStyles[booking.status]}>
                    {booking.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                        {booking.booker.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-foreground">{booking.booker}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{filteredBookings.length} Bookings</span>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-sm text-muted-foreground">+ Action</span>
          <Button variant="outline" size="icon-sm" disabled>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon-sm">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
