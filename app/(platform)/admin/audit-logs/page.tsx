"use client"

import { useState, useMemo } from "react"
import { PlatformHeader } from "@/components/platform/platform-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Search, CalendarIcon, X } from "lucide-react"
import { format } from "date-fns"

const actionTypes = ["All Actions", "org.created", "org.updated", "org.suspended", "user.login", "user.invited", "plan.changed", "payment.received", "payment.failed", "settings.updated"] as const

const actionLabels: Record<string, string> = {
  "org.created": "Org Created",
  "org.updated": "Org Updated",
  "org.suspended": "Org Suspended",
  "user.login": "User Login",
  "user.invited": "User Invited",
  "plan.changed": "Plan Changed",
  "payment.received": "Payment Received",
  "payment.failed": "Payment Failed",
  "settings.updated": "Settings Updated",
}

const actionStyles: Record<string, string> = {
  "org.created": "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  "org.updated": "bg-blue-100 text-blue-700 hover:bg-blue-100",
  "org.suspended": "bg-red-100 text-red-700 hover:bg-red-100",
  "user.login": "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
  "user.invited": "bg-blue-100 text-blue-700 hover:bg-blue-100",
  "plan.changed": "bg-amber-100 text-amber-700 hover:bg-amber-100",
  "payment.received": "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  "payment.failed": "bg-red-100 text-red-700 hover:bg-red-100",
  "settings.updated": "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
}

interface AuditLog {
  id: string
  timestamp: string
  user: string
  action: string
  target: string
  ip: string
}

const auditLogs: AuditLog[] = [
  { id: "al-1", timestamp: "Feb 23, 2026 9:15 AM", user: "Ahmed Hassan", action: "user.login", target: "Platform Admin", ip: "192.168.1.100" },
  { id: "al-2", timestamp: "Feb 23, 2026 9:10 AM", user: "Ahmed Hassan", action: "org.updated", target: "Al-Noor Community Center", ip: "192.168.1.100" },
  { id: "al-3", timestamp: "Feb 22, 2026 4:45 PM", user: "Omar Khalil", action: "plan.changed", target: "Al-Noor Community Center", ip: "10.0.0.55" },
  { id: "al-4", timestamp: "Feb 22, 2026 2:00 PM", user: "Fatima Ali", action: "payment.received", target: "Salam Foundation - $900", ip: "10.0.0.88" },
  { id: "al-5", timestamp: "Feb 22, 2026 11:30 AM", user: "Sarah Martinez", action: "org.created", target: "Islamic Center of Austin", ip: "172.16.0.12" },
  { id: "al-6", timestamp: "Feb 21, 2026 3:20 PM", user: "Ahmed Hassan", action: "org.suspended", target: "Barakah Mosque", ip: "192.168.1.100" },
  { id: "al-7", timestamp: "Feb 21, 2026 1:00 PM", user: "Omar Khalil", action: "user.invited", target: "david@manaratee.com", ip: "10.0.0.55" },
  { id: "al-8", timestamp: "Feb 20, 2026 10:15 AM", user: "Sarah Martinez", action: "settings.updated", target: "Email Templates", ip: "172.16.0.12" },
  { id: "al-9", timestamp: "Feb 20, 2026 9:00 AM", user: "Fatima Ali", action: "payment.failed", target: "Crescent Community Hub - $100", ip: "10.0.0.88" },
  { id: "al-10", timestamp: "Feb 19, 2026 4:30 PM", user: "Ahmed Hassan", action: "org.created", target: "Taqwa Center", ip: "192.168.1.100" },
  { id: "al-11", timestamp: "Feb 19, 2026 2:15 PM", user: "Omar Khalil", action: "plan.changed", target: "Unity Islamic School", ip: "10.0.0.55" },
  { id: "al-12", timestamp: "Feb 18, 2026 11:00 AM", user: "Sarah Martinez", action: "user.login", target: "Platform Admin", ip: "172.16.0.12" },
]

export default function AuditLogsPage() {
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("All Actions")
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)

  const filtered = useMemo(() => {
    let result = auditLogs
    if (actionFilter !== "All Actions") {
      result = result.filter((l) => l.action === actionFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          l.user.toLowerCase().includes(q) ||
          l.target.toLowerCase().includes(q)
      )
    }
    if (dateFrom) {
      result = result.filter((l) => new Date(l.timestamp) >= dateFrom)
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo)
      endOfDay.setHours(23, 59, 59, 999)
      result = result.filter((l) => new Date(l.timestamp) <= endOfDay)
    }
    return result
  }, [search, actionFilter, dateFrom, dateTo])

  return (
    <>
      <PlatformHeader title="Audit Logs" />
      <div className="flex flex-col gap-5 p-6">
        <Card className="border border-border shadow-sm">
          <CardContent className="p-0">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border">
              <div className="relative w-[260px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search user or target..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {actionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === "All Actions" ? type : actionLabels[type] || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <span className="sr-only">Clear dates</span>
                </Button>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {filtered.length} entries
              </span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium text-muted-foreground">Timestamp</TableHead>
                  <TableHead className="font-medium text-muted-foreground">User</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Action</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Target</TableHead>
                  <TableHead className="font-medium text-muted-foreground">IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No audit logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{log.timestamp}</TableCell>
                      <TableCell className="font-medium text-foreground">{log.user}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={actionStyles[log.action] || ""}>
                          {actionLabels[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[250px] truncate">{log.target}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{log.ip}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
