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

type OrgStatus = "Active" | "Inactive" | "Pending"

interface Organization {
  id: string
  name: string
  contact: string
  phone: string
  dateAdded: string
  status: OrgStatus
}

const mockOrganizations: Organization[] = []

type SortField = "name" | "contact" | "phone" | "dateAdded" | "status"
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

const statusStyles: Record<OrgStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Inactive: "bg-muted text-muted-foreground hover:bg-muted",
  Pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
}

interface OrganizationsListProps {
  basePath?: string
}

export function OrganizationsList({ basePath = "/people/organizations" }: OrganizationsListProps) {
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
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
    let result = [...mockOrganizations]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.contact.toLowerCase().includes(q) ||
          o.phone.includes(q)
      )
    }

    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter)
    }

    result.sort((a, b) => {
      let aVal: string
      let bVal: string
      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case "contact":
          aVal = a.contact.toLowerCase()
          bVal = b.contact.toLowerCase()
          break
        case "phone":
          aVal = a.phone
          bVal = b.phone
          break
        case "dateAdded":
          aVal = a.dateAdded
          bVal = b.dateAdded
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
  }, [search, statusFilter, sortField, sortDirection])

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
          <h2 className="text-lg font-semibold text-foreground">Organizations</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {mockOrganizations.length}{" "}
            {mockOrganizations.length !== 1 ? "organizations" : "organization"}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-1.5 size-4" />
          Add Organization
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, contact, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
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
                    onClick={() => handleSort("contact")}
                  >
                    Contact
                    <SortIcon field="contact" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("phone")}
                  >
                    Phone Number
                    <SortIcon field="phone" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("dateAdded")}
                  >
                    Date Added
                    <SortIcon field="dateAdded" currentField={sortField} direction={sortDirection} />
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
                    No organizations found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <Link
                        href={`${basePath}/${org.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {org.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{org.contact}</TableCell>
                    <TableCell className="text-muted-foreground">{org.phone}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(org.dateAdded).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusStyles[org.status]}>
                        {org.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Organization Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Organization</DialogTitle>
            <DialogDescription>
              Add a new organization to your contacts.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input id="org-name" placeholder="Enter organization name" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-contact">Contact Person</Label>
                <Input id="org-contact" placeholder="Contact name" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-phone">Phone Number</Label>
                <Input id="org-phone" placeholder="+1 (555) 000-0000" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-email">Email</Label>
              <Input id="org-email" type="email" placeholder="contact@organization.org" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-type">Organization Type</Label>
                <Select>
                  <SelectTrigger id="org-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="non-profit">Non-Profit</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="foundation">Foundation</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-status">Status</Label>
                <Select defaultValue="Active">
                  <SelectTrigger id="org-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDialog(false)}>
              Add Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
