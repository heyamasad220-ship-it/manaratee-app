"use client"

import { useState } from "react"
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
import {
  Search,
  Plus,
  Store,
  Phone,
  Mail,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
} from "lucide-react"

// Mock vendors
const mockVendors = [
  {
    id: "v-1",
    businessName: "Islamic Arts & Crafts",
    contactName: "Ahmed Hassan",
    email: "ahmed@islamicarts.com",
    phone: "+1 (555) 123-4567",
    type: "Retail",
    status: "approved",
    appliedDate: "Feb 15, 2026",
    products: "Handmade Islamic calligraphy, prayer beads, decorative items",
  },
  {
    id: "v-2",
    businessName: "Modest Fashion Hub",
    contactName: "Fatima Ali",
    email: "fatima@modestfashion.com",
    phone: "+1 (555) 234-5678",
    type: "Clothing",
    status: "approved",
    appliedDate: "Feb 14, 2026",
    products: "Hijabs, abayas, modest dresses, accessories",
  },
  {
    id: "v-3",
    businessName: "Halal Eats Co.",
    contactName: "Omar Khan",
    email: "omar@halaleats.com",
    phone: "+1 (555) 345-6789",
    type: "Food",
    status: "pending",
    appliedDate: "Feb 20, 2026",
    products: "Mediterranean cuisine, shawarma, falafel, fresh juices",
  },
  {
    id: "v-4",
    businessName: "Kids Fun Zone",
    contactName: "Sarah Johnson",
    email: "sarah@kidsfunzone.com",
    phone: "+1 (555) 456-7890",
    type: "Activity",
    status: "approved",
    appliedDate: "Feb 12, 2026",
    products: "Bounce house, face painting, balloon animals, games",
  },
  {
    id: "v-5",
    businessName: "Baklava Paradise",
    contactName: "Yusuf Demir",
    email: "yusuf@baklavaparadise.com",
    phone: "+1 (555) 567-8901",
    type: "Food",
    status: "rejected",
    appliedDate: "Feb 18, 2026",
    products: "Turkish baklava, kunafa, Turkish delight",
  },
  {
    id: "v-6",
    businessName: "Halal Cosmetics Co.",
    contactName: "Aisha Rahman",
    email: "aisha@halalcosmetics.com",
    phone: "+1 (555) 678-9012",
    type: "Beauty",
    status: "pending",
    appliedDate: "Feb 22, 2026",
    products: "Halal-certified cosmetics, skincare, fragrances",
  },
  {
    id: "v-7",
    businessName: "Books & Beyond",
    contactName: "Ibrahim Patel",
    email: "ibrahim@booksandbeyond.com",
    phone: "+1 (555) 789-0123",
    type: "Retail",
    status: "pending",
    appliedDate: "Feb 24, 2026",
    products: "Islamic books, children books, educational materials",
  },
  {
    id: "v-8",
    businessName: "Henna Artists",
    contactName: "Zainab Mohammed",
    email: "zainab@hennaartists.com",
    phone: "+1 (555) 890-1234",
    type: "Service",
    status: "approved",
    appliedDate: "Feb 10, 2026",
    products: "Henna designs, bridal henna, kids henna",
  },
]

const statusColors: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
}

const statusIcons: Record<string, typeof CheckCircle2> = {
  approved: CheckCircle2,
  pending: Clock,
  rejected: XCircle,
}

export default function ContactsVendorsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [showAddDialog, setShowAddDialog] = useState(false)

  const filteredVendors = mockVendors.filter((vendor) => {
    const matchesSearch =
      vendor.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.contactName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || vendor.status === statusFilter
    const matchesType = typeFilter === "all" || vendor.type === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  const stats = {
    total: mockVendors.length,
    approved: mockVendors.filter((v) => v.status === "approved").length,
    pending: mockVendors.filter((v) => v.status === "pending").length,
    rejected: mockVendors.filter((v) => v.status === "rejected").length,
  }

  const vendorTypes = [...new Set(mockVendors.map((v) => v.type))]

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
      <Header title="Vendors" />
      <div className="flex flex-col gap-6 p-6">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Vendors</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <Store className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {vendorTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Vendor
          </Button>
        </div>

        {/* Vendors Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="hidden lg:table-cell">Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Applied</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.map((vendor) => {
                  const StatusIcon = statusIcons[vendor.status]
                  return (
                    <TableRow key={vendor.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-amber-100 text-amber-700 text-sm">
                              {getInitials(vendor.businessName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium">{vendor.businessName}</span>
                            <span className="text-sm text-muted-foreground">{vendor.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-col">
                          <span>{vendor.contactName}</span>
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {vendor.phone}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline">{vendor.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`gap-1 ${statusColors[vendor.status]}`}>
                          <StatusIcon className="h-3 w-3" />
                          {vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {vendor.appliedDate}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Add Vendor Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Vendor</DialogTitle>
            <DialogDescription>Add a new vendor to your contacts.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input id="businessName" placeholder="Enter business name" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contactName">Contact Person</Label>
              <Input id="contactName" placeholder="Enter contact name" />
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
              <Label htmlFor="type">Vendor Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Retail">Retail</SelectItem>
                  <SelectItem value="Food">Food</SelectItem>
                  <SelectItem value="Clothing">Clothing</SelectItem>
                  <SelectItem value="Service">Service</SelectItem>
                  <SelectItem value="Activity">Activity</SelectItem>
                  <SelectItem value="Beauty">Beauty</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="products">Products/Services</Label>
              <Textarea id="products" placeholder="Describe products or services" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDialog(false)}>Add Vendor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
