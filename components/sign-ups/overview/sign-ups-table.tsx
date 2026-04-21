"use client"

import { useState } from "react"
import { Search, ChevronDown, ChevronLeft, ChevronRight, Edit, MoreHorizontal } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
import { signUps, type SignUpSchedule } from "@/lib/mock-data"
import { StatusBadge } from "@/lib/status-badges"

const scheduleStyles: Record<SignUpSchedule, string> = {
  Upcoming: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  Past: "bg-muted text-muted-foreground hover:bg-muted",
}

export function SignUpsTable() {
  const [search, setSearch] = useState("")
  const [sortField] = useState("startDate")
  const [sortOrder] = useState("newest")

  const filtered = signUps.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.groupName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Search + Sort + New Sign-Up */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Sign-up Title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Sort By</span>
          <Select defaultValue={sortField}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="startDate">Date</SelectItem>
              <SelectItem value="title">Title</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue={sortOrder}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest to Oldest</SelectItem>
              <SelectItem value="oldest">Oldest to Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="ml-auto gap-1.5">
          + New Sign-Up
        </Button>
      </div>

      {/* Table heading */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">All Sign-Ups</h3>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{filtered.length} Sign-ups</span>
          <span>103 sign-ups</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Schedule</TableHead>
              <TableHead className="w-[140px]">Date</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Group Name</TableHead>
              <TableHead className="w-[120px]">
                <span className="flex items-center gap-1">
                  Status
                  <ChevronDown className="h-3 w-3" />
                </span>
              </TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((signUp) => (
              <TableRow key={signUp.id}>
                <TableCell>
                  <Badge variant="secondary" className={scheduleStyles[signUp.schedule]}>
                    {signUp.schedule}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{signUp.startDate}</TableCell>
                <TableCell>
                  <span className="font-medium text-primary hover:underline cursor-pointer">
                    {signUp.title}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{signUp.groupName}</TableCell>
                <TableCell>
                  <StatusBadge status={signUp.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-3 text-sm text-muted-foreground">
        <span>103 Sign-ups</span>
        <div className="flex items-center gap-1">
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
