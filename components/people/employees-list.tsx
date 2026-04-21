"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { Search, ChevronUp, ChevronDown, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

type EmployeeStatus = "Active" | "Inactive" | "On Leave"
type EmployeeType = "Full-Time" | "Part-Time" | "Contract" | "Intern"

interface Employee {
  id: string
  name: string
  title: string
  department: string
  type: EmployeeType
  status: EmployeeStatus
}

const mockEmployees: Employee[] = [
  {
    id: "emp-001",
    name: "Sarah Mitchell",
    title: "Program Director",
    department: "Administration",
    type: "Full-Time",
    status: "Active",
  },
  {
    id: "emp-002",
    name: "James Okafor",
    title: "Lead Instructor",
    department: "Education",
    type: "Full-Time",
    status: "Active",
  },
  {
    id: "emp-003",
    name: "Maria Gonzalez",
    title: "Office Manager",
    department: "Operations",
    type: "Full-Time",
    status: "Active",
  },
  {
    id: "emp-004",
    name: "Kevin Park",
    title: "IT Support Specialist",
    department: "Technology",
    type: "Contract",
    status: "Active",
  },
  {
    id: "emp-005",
    name: "Aisha Rahman",
    title: "Event Coordinator",
    department: "Events",
    type: "Part-Time",
    status: "Active",
  },
  {
    id: "emp-006",
    name: "David Chen",
    title: "Facilities Manager",
    department: "Operations",
    type: "Full-Time",
    status: "On Leave",
  },
  {
    id: "emp-007",
    name: "Jessica Taylor",
    title: "Marketing Associate",
    department: "Marketing",
    type: "Intern",
    status: "Active",
  },
  {
    id: "emp-008",
    name: "Robert Kim",
    title: "Finance Officer",
    department: "Finance",
    type: "Full-Time",
    status: "Inactive",
  },
]

type SortField = "name" | "title" | "department" | "type" | "status"
type SortDirection = "asc" | "desc"

function SortIcon({
  field,
  currentField,
  direction,
}: {
  field: SortField
  currentField: SortField
  direction: SortDirection
}) {
  if (field !== currentField) {
    return <ChevronUp className="ml-1 inline size-3.5 text-muted-foreground/40" />
  }
  return direction === "asc" ? (
    <ChevronUp className="ml-1 inline size-3.5" />
  ) : (
    <ChevronDown className="ml-1 inline size-3.5" />
  )
}

const statusStyles: Record<EmployeeStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Inactive: "bg-muted text-muted-foreground hover:bg-muted",
  "On Leave": "bg-amber-100 text-amber-700 hover:bg-amber-100",
}

const typeStyles: Record<EmployeeType, string> = {
  "Full-Time": "bg-blue-100 text-blue-700 hover:bg-blue-100",
  "Part-Time": "bg-violet-100 text-violet-700 hover:bg-violet-100",
  Contract: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  Intern: "bg-teal-100 text-teal-700 hover:bg-teal-100",
}

export function EmployeesList() {
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [showAddDialog, setShowAddDialog] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const filtered = useMemo(() => {
    let result = [...mockEmployees]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.title.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== "all") {
      result = result.filter((e) => e.status === statusFilter)
    }

    if (typeFilter !== "all") {
      result = result.filter((e) => e.type === typeFilter)
    }

    result.sort((a, b) => {
      let aVal: string
      let bVal: string
      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case "title":
          aVal = a.title.toLowerCase()
          bVal = b.title.toLowerCase()
          break
        case "department":
          aVal = a.department.toLowerCase()
          bVal = b.department.toLowerCase()
          break
        case "type":
          aVal = a.type
          bVal = b.type
          break
        case "status":
          aVal = a.status
          bVal = b.status
          break
        default:
          aVal = ""
          bVal = ""
      }
      const cmp = aVal.localeCompare(bVal)
      return sortDirection === "asc" ? cmp : -cmp
    })

    return result
  }, [search, statusFilter, typeFilter, sortField, sortDirection])

  if (!mounted) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="h-10 w-48 animate-pulse rounded bg-muted" />
        <div className="h-9 w-full max-w-sm animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Summary row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Employees</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {mockEmployees.length}{" "}
            {mockEmployees.length !== 1 ? "employees" : "employee"}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-1.5 size-4" />
          Add Employee
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, title, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Full-Time">Full-Time</SelectItem>
            <SelectItem value="Part-Time">Part-Time</SelectItem>
            <SelectItem value="Contract">Contract</SelectItem>
            <SelectItem value="Intern">Intern</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
            <SelectItem value="On Leave">On Leave</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("name")}
                  >
                    Name
                    <SortIcon field="name" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("title")}
                  >
                    Title
                    <SortIcon field="title" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("department")}
                  >
                    Department
                    <SortIcon field="department" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("type")}
                  >
                    Type
                    <SortIcon field="type" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("status")}
                  >
                    Status
                    <SortIcon field="status" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No employees found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <Link
                        href={`/hr/employees/${emp.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {emp.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{emp.title}</TableCell>
                    <TableCell className="text-muted-foreground">{emp.department}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={typeStyles[emp.type]}>
                        {emp.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusStyles[emp.status]}>
                        {emp.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Employee Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
            <DialogDescription>
              Add a new employee to your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="emp-name">Full Name</Label>
              <Input id="emp-name" placeholder="Enter full name" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="emp-email">Email</Label>
                <Input id="emp-email" type="email" placeholder="email@organization.org" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="emp-phone">Phone Number</Label>
                <Input id="emp-phone" placeholder="+1 (555) 000-0000" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="emp-title">Job Title</Label>
                <Input id="emp-title" placeholder="Enter job title" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="emp-department">Department</Label>
                <Select>
                  <SelectTrigger id="emp-department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Administration">Administration</SelectItem>
                    <SelectItem value="Education">Education</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Events">Events</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="emp-type">Employment Type</Label>
                <Select>
                  <SelectTrigger id="emp-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-Time">Full-Time</SelectItem>
                    <SelectItem value="Part-Time">Part-Time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="emp-start">Start Date</Label>
                <Input id="emp-start" type="date" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDialog(false)}>
              Add Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
