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
    name: "Harmony Wedding Planners",
    type: "Corporate",
    contact: "Lisa Chang",
    email: "lisa@harmonyweddings.com",
    phone: "+1 (555) 444-5555",
    address: "75 Bridal Way, Naperville, IL 60563",
    totalBookings: 15,
    totalSpent: 32000,
    lastBooking: "2024-01-22",
    status: "VIP",
  },
  {
    id: "org-5",
    name: "First Baptist Church",
    type: "Religious",
    contact: "Pastor James Brown",
    email: "jbrown@firstbaptist.org",
    phone: "+1 (555) 555-6666",
    address: "300 Faith Avenue, Springfield, IL 62704",
    totalBookings: 4,
    totalSpent: 3200,
    lastBooking: "2023-12-20",
    status: "Active",
  },
]

export default function CustomersPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Individuals")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showAddDialog, setShowAddDialog] = useState(false)

  const filteredIndividuals = individuals.filter((ind) => {
    const matchesSearch =
      ind.name.toLowerCase().includes(search.toLowerCase()) ||
      ind.email.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || ind.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const filteredOrganizations = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.contact.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || org.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalIndividuals = individuals.length
  const totalOrganizations = organizations.length
  const totalBookings = [...individuals, ...organizations].reduce((sum, c) => sum + c.totalBookings, 0)
  const totalRevenue = [...individuals, ...organizations].reduce((sum, c) => sum + c.totalSpent, 0)

  return (
    <>
      <Header title="Customers" />
      <div className="p-6">
        {/* Stats */}
        <div className="mb-6 flex flex-wrap gap-4 [&>*]:w-fit">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Individuals</p>
                  <p className="text-2xl font-semibold">{totalIndividuals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Organizations</p>
                  <p className="text-2xl font-semibold">{totalOrganizations}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                  <p className="text-2xl font-semibold">{totalBookings}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-semibold">${totalRevenue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-0 border-b border-border">
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
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Filters and Actions */}
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={activeTab === "Individuals" ? "Search individuals..." : "Search organizations..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="VIP">VIP</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add {activeTab === "Individuals" ? "Individual" : "Organization"}
          </Button>
        </div>

        {/* Individuals Tab */}
        {activeTab === "Individuals" && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-center">Bookings</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                    <TableHead>Last Booking</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIndividuals.map((ind) => (
                    <TableRow key={ind.id}>
                      <TableCell>
                        <Link
                          href={`/events/external/customers/individuals/${ind.id}`}
                          className="flex items-center gap-3"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {ind.name.split(" ").map((n) => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-primary hover:underline">
                            {ind.name}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 text-sm">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            {ind.email}
                          </span>
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            {ind.phone}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">{ind.totalBookings}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        ${ind.totalSpent.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(ind.lastBooking).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            ind.status === "VIP"
                              ? "default"
                              : ind.status === "Active"
                              ? "secondary"
                              : "outline"
                          }
                          className={cn(
                            ind.status === "VIP" && "bg-amber-500 hover:bg-amber-600"
                          )}
                        >
                          {ind.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Organizations Tab */}
        {activeTab === "Organizations" && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead className="text-center">Bookings</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                    <TableHead>Last Booking</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrganizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <Link
                          href={`/events/external/customers/organizations/${org.id}`}
                          className="flex flex-col gap-0.5"
                        >
                          <span className="font-medium text-primary hover:underline">
                            {org.name}
                          </span>
                          <span className="text-sm text-muted-foreground">{org.type}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">{org.contact}</span>
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            {org.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">{org.totalBookings}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        ${org.totalSpent.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(org.lastBooking).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            org.status === "VIP"
                              ? "default"
                              : org.status === "Active"
                              ? "secondary"
                              : "outline"
                          }
                          className={cn(
                            org.status === "VIP" && "bg-amber-500 hover:bg-amber-600"
                          )}
                        >
                          {org.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Customer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Add {activeTab === "Individuals" ? "Individual" : "Organization"}
            </DialogTitle>
            <DialogDescription>
              Add a new {activeTab === "Individuals" ? "individual customer" : "organization"} to your venue rental customers.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {activeTab === "Individuals" ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ind-name">Full Name</Label>
                  <Input id="ind-name" placeholder="Enter full name" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ind-email">Email</Label>
                    <Input id="ind-email" type="email" placeholder="email@example.com" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ind-phone">Phone</Label>
                    <Input id="ind-phone" placeholder="+1 (555) 000-0000" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ind-address">Address</Label>
                  <Textarea id="ind-address" placeholder="Enter address" rows={2} />
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input id="org-name" placeholder="Enter organization name" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="org-type">Type</Label>
                    <Select>
                      <SelectTrigger id="org-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="non-profit">Non-Profit</SelectItem>
                        <SelectItem value="corporate">Corporate</SelectItem>
                        <SelectItem value="educational">Educational</SelectItem>
                        <SelectItem value="religious">Religious</SelectItem>
                        <SelectItem value="government">Government</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="org-contact">Contact Person</Label>
                    <Input id="org-contact" placeholder="Contact name" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="org-email">Email</Label>
                    <Input id="org-email" type="email" placeholder="contact@org.com" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="org-phone">Phone</Label>
                    <Input id="org-phone" placeholder="+1 (555) 000-0000" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="org-address">Address</Label>
                  <Textarea id="org-address" placeholder="Enter address" rows={2} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDialog(false)}>
              Add {activeTab === "Individuals" ? "Individual" : "Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
