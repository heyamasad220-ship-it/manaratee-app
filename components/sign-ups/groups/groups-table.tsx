"use client"

import { useState } from "react"
import { Search, ChevronLeft, ChevronRight, Edit, MoreHorizontal, Info } from "lucide-react"
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
import { signUpGroups } from "@/lib/mock-data"
import { StatusBadge } from "@/lib/status-badges"

export function GroupsTable() {
  const [search, setSearch] = useState("")

  const filtered = signUpGroups.filter(
    (g) => g.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Search + Sort + New Group */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Group Name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Sort By</span>
          <Select defaultValue="sentDate">
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sentDate">Sent Date</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="members">Members</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="newest">
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
          + New Group
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Group Name</TableHead>
              <TableHead className="w-[120px]">Members</TableHead>
              <TableHead className="w-[130px]">
                <span className="flex items-center gap-1">
                  {'# of Sign-ups'}
                  <ChevronLeft className="h-3 w-3 rotate-90" />
                </span>
              </TableHead>
              <TableHead className="w-[120px]">
                <span className="flex items-center gap-1">
                  Status
                  <Info className="h-3 w-3 text-muted-foreground" />
                </span>
              </TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((group) => (
              <TableRow key={group.id}>
                <TableCell>
                  <span className="font-medium text-primary hover:underline cursor-pointer">
                    {group.name}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{group.members}</TableCell>
                <TableCell className="text-muted-foreground">{group.signUps}</TableCell>
                <TableCell>
                  <StatusBadge status={group.status} />
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
