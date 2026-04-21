"use client"

import { useState } from "react"
import { Search, ChevronLeft, ChevronRight, Edit, MoreHorizontal } from "lucide-react"
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
import { signUps } from "@/lib/mock-data"
import { StatusBadge } from "@/lib/status-badges"

const pastSignUps = signUps.filter(
  (s) => new Date(s.startDate) < new Date("2024-04-12")
)

export function PreviousSignUpsTable() {
  const [search, setSearch] = useState("")

  const filtered = pastSignUps.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.groupName.toLowerCase().includes(search.toLowerCase()) ||
      s.schedule.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Past Sign-Ups</h2>
        <p className="text-sm text-muted-foreground">
          {filtered.length} sign-up{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search past sign-ups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[140px]">Date</TableHead>
              <TableHead>Sign-up Title</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Group Name</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No past sign-ups found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((signUp) => (
                <TableRow key={signUp.id}>
                  <TableCell className="text-muted-foreground">{signUp.startDate}</TableCell>
                  <TableCell>
                    <span className="font-medium text-primary underline-offset-4 hover:underline cursor-pointer">
                      {signUp.title}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{signUp.schedule}</TableCell>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-3 text-sm text-muted-foreground">
        <span>{filtered.length} Sign-ups</span>
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
