"use client"

import { useState, useMemo } from "react"
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
  Phone,
  Mail,
  Users,
  Heart,
  Store,
  Wrench,
  Calendar,
} from "lucide-react"

type ContactType = "Customer" | "Volunteer" | "Vendor" | "Service Provider" | "Donor"
type ContactStatus = "Active" | "Inactive" | "VIP" | "Pending" | "Major Donor"

interface Contact {
  id: string
  name: string
  email: string
  phone: string
  type: ContactType
  status: ContactStatus
  organization?: string
  createdAt: string
  lastActivity?: string
}

const typeColors: Record<ContactType, string> = {
  Customer: "bg-blue-100 text-blue-700",
  Volunteer: "bg-emerald-100 text-emerald-700",
  Vendor: "bg-amber-100 text-amber-700",
  "Service Provider": "bg-purple-100 text-purple-700",
  Donor: "bg-rose-100 text-rose-700",
}

const typeIcons: Record<ContactType, typeof Users> = {
  Customer: Users,
  Volunteer: Calendar,
  Vendor: Store,
  "Service Provider": Wrench,
  Donor: Heart,
}

const statusColors: Record<ContactStatus, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-gray-100 text-gray-700",
  VIP: "bg-yellow-100 text-yellow-700",
  Pending: "bg-orange-100 text-orange-700",
  "Major Donor": "bg-purple-100 text-purple-700",
}

// Combined mock contacts from all sources
const mockContacts: Contact[] = [
  // Customers
  { id: "c-1", name: "Sarah Johnson", email: "sarah.johnson@email.com", phone: "+1 (555) 123-4567", type: "Customer", status: "Active", createdAt: "2024-01-15", lastActivity: "2024-01-15" },
  { id: "c-2", name: "Michael Chen", email: "michael.chen@email.com", phone: "+1 (555) 234-5678", type: "Customer", status: "Active", createdAt: "2024-01-08", lastActivity: "2024-01-08" },
  { id: "c-3", name: "Emily Rodriguez", email: "emily.r@email.com", phone: "+1 (555) 345-6789", type: "Customer", status: "VIP", createdAt: "2024-01-20", lastActivity: "2024-01-20" },
  { id: "c-4", name: "Springfield Community Center", email: "rwilliams@springfieldcc.org", phone: "+1 (555) 111-2222", type: "Customer", status: "Active", organization: "Non-Profit", createdAt: "2024-01-18", lastActivity: "2024-01-18" },
  // Volunteers
  { id: "v-1", name: "Amira Hassan", email: "amira.hassan@email.com", phone: "(555) 345-6789", type: "Volunteer", status: "Active", createdAt: "2024-06-05", lastActivity: "2024-03-15" },
  { id: "v-2", name: "David Williams", email: "david.williams@email.com", phone: "(555) 456-7890", type: "Volunteer", status: "Inactive", createdAt: "2024-09-20", lastActivity: "2024-10-05" },
  { id: "v-3", name: "Lisa Park", email: "lisa.park@email.com", phone: "(555) 567-8901", type: "Volunteer", status: "Active", createdAt: "2024-02-10", lastActivity: "2024-03-10" },
  // Vendors
  { id: "vn-1", name: "Ahmed Hassan", email: "ahmed@islamicarts.com", phone: "+1 (555) 123-4567", type: "Vendor", status: "Active", organization: "Islamic Arts & Crafts", createdAt: "2026-02-15" },
  { id: "vn-2", name: "Fatima Ali", email: "fatima@modestfashion.com", phone: "+1 (555) 234-5678", type: "Vendor", status: "Active", organization: "Modest Fashion Hub", createdAt: "2026-02-14" },
  { id: "vn-3", name: "Omar Khan", email: "omar@halaleats.com", phone: "+1 (555) 345-6789", type: "Vendor", status: "Pending", organization: "Halal Eats Co.", createdAt: "2026-02-20" },
  // Service Providers
  { id: "sp-1", name: "John Smith", email: "john@cleanpro.com", phone: "(555) 123-4567", type: "Service Provider", status: "Active", organization: "CleanPro Carpet Services", createdAt: "2024-01-01" },
  { id: "sp-2", name: "Mike Johnson", email: "mike@secureguard.com", phone: "(555) 234-5678", type: "Service Provider", status: "Active", organization: "SecureGuard Systems", createdAt: "2024-01-01" },
  // Donors
  { id: "d-1", name: "Ahmed Hassan", email: "ahmed.hassan@email.com", phone: "+1 (555) 123-4567", type: "Donor", status: "Active", createdAt: "2024-01-15", lastActivity: "2024-01-15" },
  { id: "d-2", name: "Fatima Al-Rahman", email: "fatima.ar@email.com", phone: "+1 (555) 234-5678", type: "Donor", status: "Active", createdAt: "2024-01-08", lastActivity: "2024-01-08" },
  { id: "d-3", name: "Omar Khalil", email: "omar.k@email.com", phone: "+1 (555) 345-6789", type: "Donor", status: "Major Donor", createdAt: "2024-01-20", lastActivity: "2024-01-20" },
  { id: "d-4", name: "Al-Noor Foundation", email: "contact@alnoor.org", phone: "+1 (555) 111-2222", type: "Donor", status: "Major Donor", organization: "Non-Profit", createdAt: "2024-01-18", lastActivity: "2024-01-18" },
]

export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<ContactType | "all">("all")
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">("all")
  const [showAddDialog, setShowAddDialog] = useState(false)

  const filteredContacts = useMemo(() => {
    return mockContacts.filter((contact) => {
      const matchesSearch =
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone.includes(searchQuery)
      const matchesType = typeFilter === "all" || contact.type === typeFilter
      const matchesStatus = statusFilter === "all" || contact.status === statusFilter
      return matchesSearch && matchesType && matchesStatus
    })
  }, [searchQuery, typeFilter, statusFilter])

  const stats = useMemo(() => {
    return {
      total: mockContacts.length,
      customers: mockContacts.filter((c) => c.type === "Customer").length,
      volunteers: mockContacts.filter((c) => c.type === "Volunteer").length,
      vendors: mockContacts.filter((c) => c.type === "Vendor").length,
      serviceProviders: mockContacts.filter((c) => c.type === "Service Provider").length,
      donors: mockContacts.filter((c) => c.type === "Donor").length,
    }
  }, [])

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <>
      <Header title="Contacts" />
      <div className="flex flex-col gap-6 p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Contacts</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <div className="text-2xl font-bold">{stats.customers}</div>
              </div>
              <div className="text-sm text-muted-foreground">Customers</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <div className="text-2xl font-bold">{stats.volunteers}</div>
              </div>
              <div className="text-sm text-muted-foreground">Volunteers</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-amber-600" />
                <div className="text-2xl font-bold">{stats.vendors}</div>
              </div>
              <div className="text-sm text-muted-foreground">Vendors</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-purple-600" />
                <div className="text-2xl font-bold">{stats.serviceProviders}</div>
              </div>
              <div className="text-sm text-muted-foreground">Service Providers</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-600" />
                <div className="text-2xl font-bold">{stats.donors}</div>
              </div>
              <div className="text-sm text-muted-foreground">Donors</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ContactType | "all")}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Customer">Customers</SelectItem>
                <SelectItem value="Volunteer">Volunteers</SelectItem>
                <SelectItem value="Vendor">Vendors</SelectItem>
                <SelectItem value="Service Provider">Service Providers</SelectItem>
                <SelectItem value="Donor">Donors</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ContactStatus | "all")}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="VIP">VIP</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Major Donor">Major Donor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>

        {/* Contacts Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => {
                  const TypeIcon = typeIcons[contact.type]
                  return (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(contact.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium">{contact.name}</span>
                            <span className="text-sm text-muted-foreground">{contact.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("gap-1", typeColors[contact.type])}>
                          <TypeIcon className="h-3 w-3" />
                          {contact.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {contact.organization || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[contact.status]}>
                          {contact.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {contact.lastActivity || contact.createdAt}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredContacts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No contacts found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Add Contact Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <DialogDescription>Add a new contact to your directory.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder="Enter full name" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="Enter email address" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" placeholder="Enter phone number" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="type">Contact Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Customer">Customer</SelectItem>
                  <SelectItem value="Volunteer">Volunteer</SelectItem>
                  <SelectItem value="Vendor">Vendor</SelectItem>
                  <SelectItem value="Service Provider">Service Provider</SelectItem>
                  <SelectItem value="Donor">Donor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="organization">Organization (Optional)</Label>
              <Input id="organization" placeholder="Enter organization name" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea id="notes" placeholder="Add any notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDialog(false)}>Add Contact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
