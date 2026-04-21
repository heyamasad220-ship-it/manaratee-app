"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { Search, ChevronUp, ChevronDown, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

type Role =
  | "Donor"
  | "Volunteer"
  | "Vendor"
  | "Staff"
  | "Student"
  | "Parent"
  | "Babysitter"

type Status = "Active" | "Inactive"

interface Customer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  role: Role
  status: Status
  createdAt: string
}

const roleColors: Record<Role, string> = {
  Donor: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Volunteer: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Vendor: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Staff: "bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
  Student: "bg-violet-100 text-violet-700 hover:bg-violet-100",
  Parent: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Babysitter: "bg-teal-100 text-teal-700 hover:bg-teal-100",
}

const mockCustomers: Customer[] = [
  {
    id: "cust-001",
    firstName: "Sarah",
    lastName: "Johnson",
    email: "sarah.johnson@email.com",
    phone: "+1 (555) 234-5678",
    role: "Parent",
    status: "Active",
    createdAt: "2024-01-15",
  },
  {
    id: "cust-002",
    firstName: "Michael",
    lastName: "Chen",
    email: "michael.chen@email.com",
    phone: "+1 (555) 345-6789",
    role: "Donor",
    status: "Active",
    createdAt: "2024-02-20",
  },
  {
    id: "cust-003",
    firstName: "Emily",
    lastName: "Rodriguez",
    email: "emily.rodriguez@email.com",
    phone: "+1 (555) 456-7890",
    role: "Volunteer",
    status: "Active",
    createdAt: "2024-03-10",
  },
  {
    id: "cust-004",
    firstName: "James",
    lastName: "Williams",
    email: "james.williams@email.com",
    phone: "+1 (555) 567-8901",
    role: "Staff",
    status: "Active",
    createdAt: "2024-04-05",
  },
  {
    id: "cust-005",
    firstName: "Olivia",
    lastName: "Brown",
    email: "olivia.brown@email.com",
    phone: "+1 (555) 678-9012",
    role: "Student",
    status: "Inactive",
    createdAt: "2024-05-12",
  },
  {
    id: "cust-006",
    firstName: "Daniel",
    lastName: "Martinez",
    email: "daniel.martinez@email.com",
    phone: "+1 (555) 789-0123",
    role: "Vendor",
    status: "Active",
    createdAt: "2024-06-18",
  },
  {
    id: "cust-007",
    firstName: "Sophia",
    lastName: "Davis",
    email: "sophia.davis@email.com",
    phone: "+1 (555) 890-1234",
    role: "Babysitter",
    status: "Active",
    createdAt: "2024-07-22",
  },
  {
    id: "cust-008",
    firstName: "William",
    lastName: "Garcia",
    email: "william.garcia@email.com",
    phone: "+1 (555) 901-2345",
    role: "Donor",
    status: "Inactive",
    createdAt: "2024-08-30",
  },
  {
    id: "cust-009",
    firstName: "Ava",
    lastName: "Lee",
    email: "ava.lee@email.com",
    phone: "+1 (555) 012-3456",
    role: "Parent",
    status: "Active",
    createdAt: "2024-09-14",
  },
  {
    id: "cust-010",
    firstName: "Benjamin",
    lastName: "Taylor",
    email: "benjamin.taylor@email.com",
    phone: "+1 (555) 123-4567",
    role: "Volunteer",
    status: "Active",
    createdAt: "2024-10-01",
  },
]

type SortField = "name" | "email" | "phone" | "role" | "status" | "createdAt"
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

export function CustomerList() {
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

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
    let result = [...mockCustomers]

    // Search filter
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.includes(q)
      )
    }

    // Role filter
    if (roleFilter !== "all") {
      result = result.filter((c) => c.role === roleFilter)
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter)
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string
      let bVal: string
      switch (sortField) {
        case "name":
          aVal = `${a.lastName} ${a.firstName}`.toLowerCase()
          bVal = `${b.lastName} ${b.firstName}`.toLowerCase()
          break
        case "email":
          aVal = a.email.toLowerCase()
          bVal = b.email.toLowerCase()
          break
        case "phone":
          aVal = a.phone
          bVal = b.phone
          break
        case "role":
          aVal = a.role
          bVal = b.role
          break
        case "status":
          aVal = a.status
          bVal = b.status
          break
        case "createdAt":
          aVal = a.createdAt
          bVal = b.createdAt
          break
        default:
          aVal = ""
          bVal = ""
      }
      const cmp = aVal.localeCompare(bVal)
      return sortDirection === "asc" ? cmp : -cmp
    })

    return result
  }, [search, roleFilter, statusFilter, sortField, sortDirection])

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
          <h2 className="text-lg font-semibold text-foreground">
            All People
          </h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {mockCustomers.length} {mockCustomers.length !== 1 ? "people" : "person"}
          </p>
        </div>
        <Button size="sm">
          <Plus className="mr-1.5 size-4" />
          Add Person
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="Donor">Donor</SelectItem>
            <SelectItem value="Volunteer">Volunteer</SelectItem>
            <SelectItem value="Vendor">Vendor</SelectItem>
            <SelectItem value="Staff">Staff</SelectItem>
            <SelectItem value="Student">Student</SelectItem>
            <SelectItem value="Parent">Parent</SelectItem>
            <SelectItem value="Babysitter">Babysitter</SelectItem>
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
                    className="inline-flex items-center font-medium hover:text-foreground transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    Name
                    <SortIcon field="name" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium hover:text-foreground transition-colors"
                    onClick={() => handleSort("email")}
                  >
                    Email
                    <SortIcon field="email" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium hover:text-foreground transition-colors"
                    onClick={() => handleSort("phone")}
                  >
                    Phone
                    <SortIcon field="phone" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium hover:text-foreground transition-colors"
                    onClick={() => handleSort("role")}
                  >
                    Role
                    <SortIcon field="role" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium hover:text-foreground transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    Status
                    <SortIcon field="status" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium hover:text-foreground transition-colors"
                    onClick={() => handleSort("createdAt")}
                  >
                    Created
                    <SortIcon field="createdAt" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No people found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Link
                        href={`/people/${customer.id}/profile`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {customer.firstName} {customer.lastName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.phone}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={roleColors[customer.role]}
                      >
                        {customer.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          customer.status === "Active"
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                            : "bg-muted text-muted-foreground hover:bg-muted"
                        }
                      >
                        {customer.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(customer.createdAt).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        }
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
