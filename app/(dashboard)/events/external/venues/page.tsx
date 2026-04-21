"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/lib/status-badges"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  DollarSign,
  Calendar,
  MapPin,
  Image,
} from "lucide-react"

interface Venue {
  id: string
  name: string
  description: string
  capacity: number
  basePrice: number
  hourlyRate: number
  status: "Active" | "Inactive" | "Maintenance"
  amenities: string[]
  location: string
  totalBookings: number
  revenue: number
  image?: string
}

const mockVenues: Venue[] = [
  {
    id: "venue-1",
    name: "Main Hall",
    description: "Our largest venue, perfect for weddings, conferences, and large gatherings. Features high ceilings, customizable lighting, and a built-in stage.",
    capacity: 500,
    basePrice: 2500,
    hourlyRate: 350,
    status: "Active",
    amenities: ["Stage", "Audio System", "Projector", "Kitchen Access", "Wheelchair Accessible", "Parking"],
    location: "Building A, First Floor",
    totalBookings: 45,
    revenue: 125000,
  },
  {
    id: "venue-2",
    name: "Conference Room A",
    description: "Professional meeting space with modern AV equipment. Ideal for corporate meetings, workshops, and presentations.",
    capacity: 50,
    basePrice: 500,
    hourlyRate: 75,
    status: "Active",
    amenities: ["Projector", "Whiteboard", "Video Conferencing", "WiFi", "Air Conditioning"],
    location: "Building B, Second Floor",
    totalBookings: 120,
    revenue: 45000,
  },
  {
    id: "venue-3",
    name: "Garden Pavilion",
    description: "Beautiful outdoor covered space surrounded by gardens. Perfect for ceremonies, receptions, and intimate gatherings.",
    capacity: 150,
    basePrice: 1200,
    hourlyRate: 200,
    status: "Active",
    amenities: ["Outdoor Seating", "String Lights", "Garden View", "Catering Area", "Restrooms"],
    location: "North Garden",
    totalBookings: 32,
    revenue: 68000,
  },
  {
    id: "venue-4",
    name: "Banquet Room",
    description: "Elegant dining space with full kitchen access. Ideal for dinner banquets, graduation celebrations, and formal events.",
    capacity: 200,
    basePrice: 1800,
    hourlyRate: 275,
    status: "Active",
    amenities: ["Full Kitchen", "Bar Area", "Dance Floor", "Audio System", "Coat Check"],
    location: "Building A, Ground Floor",
    totalBookings: 28,
    revenue: 72000,
  },
  {
    id: "venue-5",
    name: "Meeting Room B",
    description: "Compact meeting space for small group discussions and interviews.",
    capacity: 15,
    basePrice: 200,
    hourlyRate: 40,
    status: "Maintenance",
    amenities: ["TV Screen", "Whiteboard", "WiFi"],
    location: "Building B, First Floor",
    totalBookings: 85,
    revenue: 12000,
  },
]

const statusStyles: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-gray-100 text-gray-700",
  Maintenance: "bg-amber-100 text-amber-700",
}

export default function ExternalVenuesPage() {
  const [venues, setVenues] = useState<Venue[]>(mockVenues)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount)
  }

  const filteredVenues = venues.filter((venue) => {
    const matchesSearch = venue.name.toLowerCase().includes(search.toLowerCase()) ||
      venue.description.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || venue.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalCapacity = venues.reduce((sum, v) => sum + v.capacity, 0)
  const totalRevenue = venues.reduce((sum, v) => sum + v.revenue, 0)
  const activeVenues = venues.filter((v) => v.status === "Active").length

  return (
    <>
      <Header title="External Venues" />
      <div className="flex flex-col gap-6 p-6">
        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Venues</p>
                  <p className="text-xl font-bold">{venues.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <Building2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Venues</p>
                  <p className="text-xl font-bold">{activeVenues}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Capacity</p>
                  <p className="text-xl font-bold">{totalCapacity.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-xl font-bold">{formatCurrency(totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search venues..."
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
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Venue
          </Button>
        </div>

        {/* Venues Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venue</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVenues.map((venue) => (
                  <TableRow 
                    key={venue.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => { setSelectedVenue(venue); setShowDetailDialog(true); }}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{venue.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">{venue.description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{venue.location}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{venue.capacity}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(venue.basePrice)}</TableCell>
                    <TableCell>{venue.totalBookings}</TableCell>
                    <TableCell className="font-medium text-emerald-600">{formatCurrency(venue.revenue)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusStyles[venue.status]}>
                        {venue.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedVenue(venue); setShowDetailDialog(true); }}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>Edit Venue</DropdownMenuItem>
                          <DropdownMenuItem>View Bookings</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add Venue Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Venue</DialogTitle>
              <DialogDescription>Create a new venue for external rentals</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Venue Name</Label>
                  <Input placeholder="e.g., Conference Room C" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Location</Label>
                  <Input placeholder="e.g., Building A, Floor 2" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Description</Label>
                <Textarea placeholder="Describe the venue, features, and ideal use cases..." rows={3} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label>Capacity</Label>
                  <Input type="number" placeholder="100" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Base Price ($)</Label>
                  <Input type="number" placeholder="1000" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Hourly Rate ($)</Label>
                  <Input type="number" placeholder="150" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Amenities</Label>
                <Input placeholder="e.g., Projector, WiFi, Kitchen Access (comma separated)" />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="venue-active" defaultChecked />
                <Label htmlFor="venue-active">Venue is active and available for bookings</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={() => setShowAddDialog(false)}>Add Venue</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Venue Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedVenue?.name}</DialogTitle>
              <DialogDescription>{selectedVenue?.location}</DialogDescription>
            </DialogHeader>
            {selectedVenue && (
              <div className="flex flex-col gap-6 py-4">
                {/* Status Badge */}
                <Badge variant="secondary" className={`${statusStyles[selectedVenue.status]} w-fit`}>
                  {selectedVenue.status}
                </Badge>

                {/* Description */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                  <p className="text-sm">{selectedVenue.description}</p>
                </div>

                {/* Stats Grid */}
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xl font-bold">{selectedVenue.capacity}</p>
                    <p className="text-xs text-muted-foreground">Capacity</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xl font-bold">{formatCurrency(selectedVenue.basePrice)}</p>
                    <p className="text-xs text-muted-foreground">Base Price</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xl font-bold">{formatCurrency(selectedVenue.hourlyRate)}</p>
                    <p className="text-xs text-muted-foreground">Hourly Rate</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xl font-bold">{selectedVenue.totalBookings}</p>
                    <p className="text-xs text-muted-foreground">Total Bookings</p>
                  </div>
                </div>

                {/* Amenities */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Amenities</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedVenue.amenities.map((amenity) => (
                      <Badge key={amenity} variant="outline">{amenity}</Badge>
                    ))}
                  </div>
                </div>

                {/* Revenue */}
                <div className="rounded-lg bg-emerald-50 p-4">
                  <p className="text-sm text-emerald-700">Total Revenue</p>
                  <p className="text-2xl font-bold text-emerald-700">{formatCurrency(selectedVenue.revenue)}</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
              <Button variant="outline">View Bookings</Button>
              <Button>Edit Venue</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
