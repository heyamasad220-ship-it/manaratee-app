"use client"

import { useState } from "react"
import { Search, Plus, Pencil, ChevronDown } from "lucide-react"
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
import { bookingSpaces } from "@/lib/mock-data"
import { AddSpaceModal } from "@/components/bookings/settings/add-space-modal"
import { cn } from "@/lib/utils"

export function BookingsSettings() {
  const [searchQuery, setSearchQuery] = useState("")
  const [addSpaceOpen, setAddSpaceOpen] = useState(false)

  const filteredSpaces = bookingSpaces.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
          {/* Search + Add */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-[320px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Group Name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button className="gap-1.5" onClick={() => setAddSpaceOpen(true)}>
              <Plus className="h-4 w-4" />
              Add New Space
            </Button>
          </div>

          {/* Spaces Table */}
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead>Space Name</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Peak (F-S)</TableHead>
                  <TableHead>Non-Peak (M-Th)</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSpaces.map((space, index) => (
                  <TableRow key={space.id}>
                    <TableCell className="text-sm text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-primary">{space.name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">{space.capacity}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">{space.hours}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">{space.peakPrice}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">{space.nonPeakPrice}</span>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                        space.tag === "Internal"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {space.tag}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                        <Select>
                          <SelectTrigger className="h-8 w-8 p-0 [&>svg]:hidden">
                            <ChevronDown className="h-3.5 w-3.5" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="edit">Edit</SelectItem>
                            <SelectItem value="delete">Delete</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

      <AddSpaceModal open={addSpaceOpen} onOpenChange={setAddSpaceOpen} />
    </div>
  )
}
