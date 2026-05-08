"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOrganizationId } from "@/lib/current-organization"
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Search,
  Plus,
  Building2,
  User,
  Calendar,
  DollarSign,
  Phone,
} from "lucide-react"

const tabs = ["Individuals", "Organizations"] as const
type Tab = (typeof tabs)[number]

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-700",
  pending: "bg-orange-100 text-orange-700",
  vip: "bg-yellow-100 text-yellow-700",
}

export default function CustomersPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Individuals")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])

  const supabase = createClient()

  useEffect(() => {
    async function loadCustomers() {
      const orgId = await getCurrentOrganizationId()

      if (!orgId) {
        setCustomers([])
        return
      }

      let allRows: any[] = []
      let from = 0
      const pageSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from("contacts")
          .select(`
            id,
            full_name,
            email,
            phone,
            address,
            contact_type,
            status,
            created_at,
            contact_roles!inner(role)
          `)
          .eq("organization_id", orgId)
          .eq("contact_roles.role", "customer")
          .order("full_name", { ascending: true })
          .range(from, from + pageSize - 1)

        if (error) {
          console.error("Error loading customers:", error)
          setCustomers([])
          return
        }

        allRows = [...allRows, ...(data || [])]

        if (!data || data.length < pageSize) break

        from += pageSize
      }

      setCustomers(allRows)
    }

    loadCustomers()
  }, [])

  const individuals = customers.filter((c) => c.contact_type !== "organization")
  const organizations = customers.filter((c) => c.contact_type === "organization")

  const getDisplayName = (contact: any) => {
    return contact.full_name || contact.email || contact.phone || "Unnamed Customer"
  }

  const getInitials = (name?: string) => {
    return (name || "?")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const formatStatus = (status?: string) => {
    if (!status) return "Active"
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const filteredIndividuals = individuals.filter((customer) => {
    const search = searchQuery.toLowerCase()

    const matchesSearch =
      getDisplayName(customer).toLowerCase().includes(search) ||
      (customer.email || "").toLowerCase().includes(search) ||
      (customer.phone || "").includes(search)

    const matchesStatus =
      statusFilter === "all" ||
      (customer.status || "").toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesStatus
  })

  const filteredOrganizations = organizations.filter((org) => {
    const search = searchQuery.toLowerCase()

    const matchesSearch =
      getDisplayName(org).toLowerCase().includes(search) ||
      (org.email || "").toLowerCase().includes(search) ||
      (org.phone || "").includes(search)

    const matchesStatus =
      statusFilter === "all" ||
      (org.status || "").toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesStatus
  })

  const stats = {
    totalIndividuals: individuals.length,
    totalOrganizations: organizations.length,
    totalRevenue: 0,
    totalBookings: 0,
  }

  return (
    <>
      <Header title="Customers" />

      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                <div className="text-2xl font-bold">{stats.totalIndividuals}</div>
              </div>
              <div className="text-sm text-muted-foreground">Individuals</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                <div className="text-2xl font-bold">{stats.totalOrganizations}</div>
              </div>
              <div className="text-sm text-muted-foreground">Organizations</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <div className="text-2xl font-bold">
                  ${stats.totalRevenue.toLocaleString()}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">Total Revenue</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-600" />
                <div className="text-2xl font-bold">{stats.totalBookings}</div>
              </div>
              <div className="text-sm text-muted-foreground">Total Bookings</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-1 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                {tab === "Individuals" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
                {tab}
              </div>

              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add {activeTab === "Individuals" ? "Individual" : "Organization"}
          </Button>
        </div>

        {activeTab === "Individuals" && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead className="hidden lg:table-cell">Total Bookings</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Last Booking</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {searchQuery.trim() !== "" &&
  filteredIndividuals.map((customer) => (
                    <TableRow
                      key={customer.id}
                      onClick={() => window.location.href = `/contacts/${customer.id}`}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(getDisplayName(customer))}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex flex-col">
                            <span className="font-medium">
                              {getDisplayName(customer)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {customer.email || "-"}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {customer.phone || "-"}
                        </div>
                      </TableCell>

                      <TableCell className="hidden lg:table-cell">0</TableCell>
                      <TableCell className="font-medium">$0</TableCell>

                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            statusColors[(customer.status || "active").toLowerCase()] ||
                            statusColors.active
                          }
                        >
                          {formatStatus(customer.status)}
                        </Badge>
                      </TableCell>

                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        -
                      </TableCell>
                    </TableRow>
                  ))}

                  {searchQuery.trim() === "" ? (
  <TableRow>
    <TableCell
      colSpan={6}
      className="h-24 text-center text-muted-foreground"
    >
      Start typing to search customers..
    </TableCell>
  </TableRow>
) : filteredIndividuals.length === 0 ? (
  <TableRow>
    <TableCell
      colSpan={6}
      className="h-24 text-center text-muted-foreground"
    >
      No customers found.
    </TableCell>
  </TableRow>
) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeTab === "Organizations" && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                    <TableHead className="hidden lg:table-cell">Type</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Last Booking</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {searchQuery.trim() !== "" &&
  filteredOrganizations.map((org) => (
                    <TableRow
                      key={org.id}
                      onClick={() => window.location.href = `/contacts/${org.id}`}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-purple-100 text-purple-700 text-sm">
                              {getInitials(getDisplayName(org))}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex flex-col">
                            <span className="font-medium">
                              {getDisplayName(org)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {org.email || "-"}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell">-</TableCell>

                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline">Organization</Badge>
                      </TableCell>

                      <TableCell className="font-medium">$0</TableCell>

                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            statusColors[(org.status || "active").toLowerCase()] ||
                            statusColors.active
                          }
                        >
                          {formatStatus(org.status)}
                        </Badge>
                      </TableCell>

                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        -
                      </TableCell>
                    </TableRow>
                  ))}

                  {searchQuery.trim() === "" ? (
  <TableRow>
    <TableCell
      colSpan={6}
      className="h-24 text-center text-muted-foreground"
    >
      Start typing to search organizations..
    </TableCell>
  </TableRow>
) : filteredOrganizations.length === 0 ? (
  <TableRow>
    <TableCell
      colSpan={6}
      className="h-24 text-center text-muted-foreground"
    >
      No organization customers found.
    </TableCell>
  </TableRow>
) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Add {activeTab === "Individuals" ? "Individual" : "Organization"}
            </DialogTitle>
            <DialogDescription>
              Add a new {activeTab === "Individuals" ? "individual customer" : "organization"} to your directory.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">
                {activeTab === "Individuals" ? "Full Name" : "Organization Name"}
              </Label>
              <Input
                id="name"
                placeholder={
                  activeTab === "Individuals"
                    ? "Enter full name"
                    : "Enter organization name"
                }
              />
            </div>

            {activeTab === "Organizations" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="contact">Contact Person</Label>
                <Input id="contact" placeholder="Enter contact name" />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="Enter email address" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" placeholder="Enter phone number" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" placeholder="Enter address" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDialog(false)}>
              Add Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}