"use client"

import { useState } from "react"
import { Search, ChevronDown, Info } from "lucide-react"
import { Input } from "@/components/ui/input"
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
import { signUpMessages } from "@/lib/mock-data"

export function MessagesTable() {
  const [search, setSearch] = useState("")

  const filtered = signUpMessages.filter(
    (m) => m.subject.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Search + Sort */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Subject"
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
              <SelectItem value="subject">Subject</SelectItem>
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
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[140px]">Sent Date</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="w-[120px]">
                <span className="flex items-center gap-1">
                  Type
                  <Info className="h-3 w-3 text-muted-foreground" />
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((message) => (
              <TableRow key={message.id}>
                <TableCell className="text-muted-foreground">{message.sentDate}</TableCell>
                <TableCell>
                  <span className="font-medium text-primary hover:underline cursor-pointer">
                    {message.subject}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{message.type}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
