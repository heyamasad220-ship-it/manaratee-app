"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Store, Users, LayoutGrid, List, UserPlus, Ban, ArrowRightLeft, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

// Mock booth types
const boothTypes = [
  { id: "bt-1", name: "Standard", size: "10x10 ft", price: "$150", color: "#3b82f6", count: 25 },
  { id: "bt-2", name: "Premium", size: "10x15 ft", price: "$250", color: "#8b5cf6", count: 10 },
  { id: "bt-3", name: "Corner", size: "12x12 ft", price: "$200", color: "#10b981", count: 8 },
  { id: "bt-4", name: "Food Booth", size: "10x12 ft", price: "$300", color: "#f59e0b", count: 12 },
  { id: "bt-5", name: "Activity Space", size: "15x15 ft", price: "$350", color: "#ec4899", count: 6 },
  { id: "bt-6", name: "Double", size: "20x10 ft", price: "$280", color: "#06b6d4", count: 4 },
]

// Mock booths
const mockBooths = [
  { id: "b-1", number: "A-01", type: "Standard", status: "assigned", vendor: "Islamic Arts & Crafts", location: "Main Hall - Row A" },
  { id: "b-2", number: "A-02", type: "Standard", status: "assigned", vendor: "Modest Fashion Hub", location: "Main Hall - Row A" },
  { id: "b-3", number: "A-03", type: "Premium", status: "assigned", vendor: "Halal Cosmetics Co.", location: "Main Hall - Row A" },
  { id: "b-4", number: "A-04", type: "Standard", status: "available", vendor: null, location: "Main Hall - Row A" },
  { id: "b-5", number: "A-05", type: "Corner", status: "reserved", vendor: "Pending: Books & Beyond", location: "Main Hall - Row A" },
  { id: "b-6", number: "B-01", type: "Food Booth", status: "assigned", vendor: "Halal Eats Co.", location: "Food Court" },
  { id: "b-7", number: "B-02", type: "Food Booth", status: "assigned", vendor: "Baklava Paradise", location: "Food Court" },
  { id: "b-8", number: "B-03", type: "Food Booth", status: "available", vendor: null, location: "Food Court" },
  { id: "b-9", number: "C-01", type: "Activity Space", status: "assigned", vendor: "Kids Fun Zone", location: "Outdoor Area" },
  { id: "b-10", number: "C-02", type: "Activity Space", status: "assigned", vendor: "Henna Artists", location: "Outdoor Area" },
  { id: "b-11", number: "D-01", type: "Double", status: "reserved", vendor: "Pending: Tech Bazaar", location: "Main Hall - Row D" },
  { id: "b-12", number: "D-02", type: "Premium", status: "available", vendor: null, location: "Main Hall - Row D" },
  { id: "b-13", number: "D-03", type: "Standard", status: "blocked", vendor: null, location: "Main Hall - Row D" },
]

const statusConfig = {
  available: { label: "Available", color: "border-blue-200 bg-blue-50 text-blue-700" },
  reserved: { label: "Reserved", color: "border-amber-200 bg-amber-50 text-amber-700" },
  assigned: { label: "Assigned", color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  blocked: { label: "Blocked", color: "border-red-200 bg-red-50 text-red-700" },
}

type TabType = "booths" | "map" | "types"

export default function BoothsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("booths")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [showAddBoothDialog, setShowAddBoothDialog] = useState(false)
  const [showAddTypeDialog, setShowAddTypeDialog] = useState(false)

  const filteredBooths = mockBooths.filter((booth) => {
    const matchesSearch =
      booth.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (booth.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    const matchesStatus = statusFilter === "all" || booth.status === statusFilter
    const matchesType = typeFilter === "all" || booth.type === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  const stats = {
    total: mockBooths.length,
    assigned: mockBooths.filter((b) => b.status === "assigned").length,
    available: mockBooths.filter((b) => b.status === "available").length,
    reserved: mockBooths.filter((b) => b.status === "reserved").length,
    blocked: mockBooths.filter((b) => b.status === "blocked").length,
  }

  return (
    <>
      <Header title="Booth Management" />
      <div className="p-6">
        <div className="flex flex-col gap-6">
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Booths</p>
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
                    <p className="text-sm text-muted-foreground">Assigned</p>
                    <p className="text-2xl font-bold text-emerald-600">{stats.assigned}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2">
                    <Users className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Available</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.available}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-2">
                    <Store className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Reserved</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.reserved}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2">
                    <Store className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Blocked</p>
                    <p className="text-2xl font-bold text-red-600">{stats.blocked}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-2">
                    <Ban className="h-5 w-5 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-border">
            <button
              onClick={() => setActiveTab("booths")}
              className={cn(
                "relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === "booths" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-4 w-4" />
              Booth List
              {activeTab === "booths" && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("map")}
              className={cn(
                "relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === "map" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Booth Map
              {activeTab === "map" && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("types")}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === "types" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Booth Types
              {activeTab === "types" && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
              )}
            </button>
          </div>

          {/* Booths Tab */}
          {activeTab === "booths" && (
            <div className="flex flex-col gap-4">
              {/* Filters */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search booths or vendors..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-[280px] pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {boothTypes.map((type) => (
                        <SelectItem key={type.id} value={type.name}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => setShowAddBoothDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Booth
                </Button>
              </div>

              {/* Booths Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Booth #</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBooths.map((booth) => (
                        <TableRow key={booth.id}>
                          <TableCell className="font-medium">{booth.number}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: boothTypes.find((t) => t.name === booth.type)?.color }}
                              />
                              {booth.type}
                            </div>
                          </TableCell>
                          <TableCell>
                            {booth.vendor ? (
                              <span>{booth.vendor}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{booth.location}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(statusConfig[booth.status as keyof typeof statusConfig].color)}>
                              {statusConfig[booth.status as keyof typeof statusConfig].label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                {(booth.status === "available" || booth.status === "reserved") && (
                                  <DropdownMenuItem>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Assign Vendor
                                  </DropdownMenuItem>
                                )}
                                {booth.status === "assigned" && (
                                  <DropdownMenuItem>
                                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                                    Reassign Vendor
                                  </DropdownMenuItem>
                                )}
                                {booth.status !== "blocked" && (
                                  <DropdownMenuItem>
                                    <Ban className="mr-2 h-4 w-4" />
                                    Mark Unavailable
                                  </DropdownMenuItem>
                                )}
                                {booth.status === "blocked" && (
                                  <DropdownMenuItem>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Mark Available
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem className="text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Map View Tab */}
          {activeTab === "map" && (
            <div className="flex flex-col gap-4">
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4">
                {Object.entries(statusConfig).map(([key, config]) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className={cn("h-4 w-4 rounded border", config.color)} />
                    <span className="text-sm">{config.label}</span>
                  </div>
                ))}
              </div>

              {/* Booth Grid Map */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Booth Assignment Map</CardTitle>
                  <CardDescription>Visual overview of booth assignments by location</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Main Hall Section */}
                  <div className="mb-6">
                    <h4 className="mb-3 text-sm font-medium text-muted-foreground">Main Hall</h4>
                    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
                      {mockBooths.filter(b => b.location.includes("Main Hall")).map((booth) => (
                        <div
                          key={booth.id}
                          className={cn(
                            "flex h-16 cursor-pointer flex-col items-center justify-center rounded-lg border-2 p-1 transition-all hover:scale-105",
                            statusConfig[booth.status as keyof typeof statusConfig].color
                          )}
                          title={`${booth.number} - ${booth.vendor || booth.status}`}
                        >
                          <span className="text-xs font-bold">{booth.number}</span>
                          <span className="truncate text-[10px]" style={{ maxWidth: "100%" }}>
                            {booth.vendor ? booth.vendor.split(" ")[0] : booth.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Food Court Section */}
                  <div className="mb-6">
                    <h4 className="mb-3 text-sm font-medium text-muted-foreground">Food Court</h4>
                    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
                      {mockBooths.filter(b => b.location.includes("Food Court")).map((booth) => (
                        <div
                          key={booth.id}
                          className={cn(
                            "flex h-16 cursor-pointer flex-col items-center justify-center rounded-lg border-2 p-1 transition-all hover:scale-105",
                            statusConfig[booth.status as keyof typeof statusConfig].color
                          )}
                          title={`${booth.number} - ${booth.vendor || booth.status}`}
                        >
                          <span className="text-xs font-bold">{booth.number}</span>
                          <span className="truncate text-[10px]" style={{ maxWidth: "100%" }}>
                            {booth.vendor ? booth.vendor.split(" ")[0] : booth.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Outdoor Area Section */}
                  <div>
                    <h4 className="mb-3 text-sm font-medium text-muted-foreground">Outdoor Area</h4>
                    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
                      {mockBooths.filter(b => b.location.includes("Outdoor")).map((booth) => (
                        <div
                          key={booth.id}
                          className={cn(
                            "flex h-16 cursor-pointer flex-col items-center justify-center rounded-lg border-2 p-1 transition-all hover:scale-105",
                            statusConfig[booth.status as keyof typeof statusConfig].color
                          )}
                          title={`${booth.number} - ${booth.vendor || booth.status}`}
                        >
                          <span className="text-xs font-bold">{booth.number}</span>
                          <span className="truncate text-[10px]" style={{ maxWidth: "100%" }}>
                            {booth.vendor ? booth.vendor.split(" ")[0] : booth.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Booth Types Tab */}
          {activeTab === "types" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold">Booth Types</h3>
                  <p className="text-sm text-muted-foreground">Configure different booth types and pricing</p>
                </div>
                <Button onClick={() => setShowAddTypeDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Booth Type
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {boothTypes.map((type) => (
                  <Card key={type.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-lg"
                            style={{ backgroundColor: type.color + "20" }}
                          >
                            <div
                              className="flex h-full w-full items-center justify-center rounded-lg"
                              style={{ backgroundColor: type.color }}
                            >
                              <Store className="h-5 w-5 text-white" />
                            </div>
                          </div>
                          <div>
                            <p className="font-medium">{type.name}</p>
                            <p className="text-sm text-muted-foreground">{type.size}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t pt-4">
                        <div>
                          <p className="text-xl font-bold">{type.price}</p>
                          <p className="text-xs text-muted-foreground">per event</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-muted-foreground">{type.count}</p>
                          <p className="text-xs text-muted-foreground">booths</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Booth Dialog */}
      <Dialog open={showAddBoothDialog} onOpenChange={setShowAddBoothDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Booth</DialogTitle>
            <DialogDescription>Create a new booth for the bazaar</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="booth-number">Booth Number</Label>
                <Input id="booth-number" placeholder="e.g., A-01" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="booth-type">Booth Type</Label>
                <Select>
                  <SelectTrigger id="booth-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {boothTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name} ({type.size})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="booth-location">Location</Label>
              <Input id="booth-location" placeholder="e.g., Main Hall - Row A" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="booth-notes">Notes (Optional)</Label>
              <Textarea id="booth-notes" placeholder="Any special notes about this booth..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBoothDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddBoothDialog(false)}>Add Booth</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Booth Type Dialog */}
      <Dialog open={showAddTypeDialog} onOpenChange={setShowAddTypeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Booth Type</DialogTitle>
            <DialogDescription>Create a new booth type configuration</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="type-name">Name</Label>
              <Input id="type-name" placeholder="e.g., Premium Corner" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="type-size">Size</Label>
                <Input id="type-size" placeholder="e.g., 10x10 ft" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="type-price">Price</Label>
                <Input id="type-price" placeholder="e.g., $200" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="type-color">Color</Label>
              <div className="flex items-center gap-3">
                <Input id="type-color" type="color" className="h-10 w-20 cursor-pointer p-1" defaultValue="#3b82f6" />
                <span className="text-sm text-muted-foreground">Color for visual identification</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="type-description">Description (Optional)</Label>
              <Textarea id="type-description" placeholder="Describe this booth type..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTypeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddTypeDialog(false)}>Add Booth Type</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
