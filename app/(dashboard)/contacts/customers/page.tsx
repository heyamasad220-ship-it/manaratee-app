"use client"

import { useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  Mail,
} from "lucide-react"

const tabs = ["Individuals", "Organizations"] as const
type Tab = (typeof tabs)[number]

// Mock individual customers
const individuals = [
  {
    id: "ind-1",
    name: "Sarah Johnson",
    email: "sarah.johnson@email.com",
    phone: "+1 (555) 123-4567",
    address: "123 Oak Street, Springfield, IL 62701",
    totalBookings: 5,
    totalSpent: 4250,
    lastBooking: "2024-01-15",
    status: "Active",
  },
  {
    id: "ind-2",
    name: "Michael Chen",
    email: "michael.chen@email.com",
    phone: "+1 (555) 234-5678",
    address: "456 Maple Ave, Chicago, IL 60601",
    totalBookings: 3,
    totalSpent: 2800,
    lastBooking: "2024-01-08",
    status: "Active",
  },
  {
    id: "ind-3",
    name: "Emily Rodriguez",
    email: "emily.r@email.com",
    phone: "+1 (555) 345-6789",
    address: "789 Pine Road, Naperville, IL 60540",
    totalBookings: 8,
    totalSpent: 7500,
    lastBooking: "2024-01-20",
    status: "VIP",
  },
  {
    id: "ind-4",
    name: "David Kim",
    email: "david.kim@email.com",
    phone: "+1 (555) 456-7890",
    address: "321 Elm Street, Evanston, IL 60201",
    totalBookings: 2,
    totalSpent: 1200,
    lastBooking: "2023-12-10",
    status: "Active",
  },
  {
    id: "ind-5",
    name: "Jessica Thompson",
    email: "j.thompson@email.com",
    phone: "+1 (555) 567-8901",
    address: "654 Cedar Lane, Oak Park, IL 60302",
    totalBookings: 1,
    totalSpent: 450,
    lastBooking: "2023-11-25",
    status: "Inactive",
  },
]

// Mock organization customers
const organizations = [
  {
    id: "org-1",
    name: "Springfield Community Center",
    type: "Non-Profit",
    contact: "Robert Williams",
    email: "rwilliams@springfieldcc.org",
    phone: "+1 (555) 111-2222",
    address: "100 Community Drive, Springfield, IL 62702",
    totalBookings: 12,
    totalSpent: 18500,
    lastBooking: "2024-01-18",
    status: "Active",
  },
  {
    id: "org-2",
    name: "Tech Innovators Inc.",
    type: "Corporate",
    contact: "Amanda Foster",
    email: "afoster@techinnovators.com",
    phone: "+1 (555) 222-3333",
    address: "500 Innovation Blvd, Chicago, IL 60606",
    totalBookings: 8,
    totalSpent: 24000,
    lastBooking: "2024-01-12",
    status: "VIP",
  },
  {
    id: "org-3",
    name: "Lincoln High School",
    type: "Educational",
    contact: "Patricia Moore",
    email: "pmoore@lincolnhs.edu",
    phone: "+1 (555) 333-4444",
    address: "200 School Street, Lincoln, IL 62656",
    totalBookings: 6,
    totalSpent: 5400,
    lastBooking: "2024-01-05",
    status: "Active",
  },
  {
    id: "org-4",
    name: "First Baptist Church",
    type: "Religious",
    contact: "Pastor James Brown",
    email: "jbrown@firstbaptist.org",
    phone: "+1 (555) 444-5555",
    address: "300 Church Road, Decatur, IL 62521",
    totalBookings: 4,
    totalSpent: 3200,
    lastBooking: "2023-12-28",
    status: "Active",
  },
]

const statusColors: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-gray-100 text-gray-700",
  VIP: "bg-yellow-100 text-yellow-700",
}

export default function CustomersPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Individuals")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showAddDialog, setShowAddDialog] = useState(false)

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const filteredIndividuals = individuals.filter((ind) => {
    const matchesSearch =
      ind.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ind.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || ind.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const filteredOrganizations = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || org.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    totalIndividuals: individuals.length,
    totalOrganizations: organizations.length,
    totalRevenue: [...individuals, ...organizations].reduce((acc, c) => acc + c.totalSpent, 0),
    totalBookings: [...individuals, ...organizations].reduce((acc, c) => acc + c.totalBookings, 0),
  }

  return (
    <>
      <Header title="Customers" />
      <div className="flex flex-col gap-6 p-6">
        {/* Stats Cards */}
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
                <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
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

        {/* Tabs */}
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

        {/* Filters and Actions */}
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
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="VIP">VIP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add {activeTab === "Individuals" ? "Individual" : "Organization"}
          </Button>
        </div>

        {/* Content */}
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
                  {filteredIndividuals.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(customer.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium">{customer.name}</span>
                            <span className="text-sm text-muted-foreground">{customer.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{customer.totalBookings}</TableCell>
                      <TableCell className="font-medium">${customer.totalSpent.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[customer.status]}>
                          {customer.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {customer.lastBooking}
                      </TableCell>
                    </TableRow>
                  ))}
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
                  {filteredOrganizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-purple-100 text-purple-700 text-sm">
                              {getInitials(org.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium">{org.name}</span>
                            <span className="text-sm text-muted-foreground">{org.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{org.contact}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline">{org.type}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">${org.totalSpent.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[org.status]}>
                          {org.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {org.lastBooking}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add {activeTab === "Individuals" ? "Individual" : "Organization"}</DialogTitle>
            <DialogDescription>
              Add a new {activeTab === "Individuals" ? "individual customer" : "organization"} to your directory.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{activeTab === "Individuals" ? "Full Name" : "Organization Name"}</Label>
              <Input id="name" placeholder={activeTab === "Individuals" ? "Enter full name" : "Enter organization name"} />
            </div>
            {activeTab === "Organizations" && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="contact">Contact Person</Label>
                  <Input id="contact" placeholder="Enter contact name" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="type">Organization Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corporate">Corporate</SelectItem>
                      <SelectItem value="non-profit">Non-Profit</SelectItem>
                      <SelectItem value="educational">Educational</SelectItem>
                      <SelectItem value="religious">Religious</SelectItem>
                      <SelectItem value="government">Government</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
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
            <Button onClick={() => setShowAddDialog(false)}>Add Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
