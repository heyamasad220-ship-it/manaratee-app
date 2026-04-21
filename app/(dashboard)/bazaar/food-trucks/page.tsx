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
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Utensils,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Mock food trucks
const mockFoodTrucks = [
  {
    id: "ft-1",
    name: "Mediterranean Delights",
    cuisine: "Mediterranean",
    contact: "Hassan Ali",
    phone: "+1 (555) 111-2222",
    email: "hassan@meddelights.com",
    slot: "FT-01",
    location: "Food Court - West",
    status: "confirmed",
    menu: "Shawarma, Falafel, Hummus, Grilled Meats, Fresh Juices",
  },
  {
    id: "ft-2",
    name: "Biryani Express",
    cuisine: "South Asian",
    contact: "Fatima Khan",
    phone: "+1 (555) 222-3333",
    email: "fatima@biryaniexpress.com",
    slot: "FT-02",
    location: "Food Court - West",
    status: "confirmed",
    menu: "Chicken Biryani, Lamb Biryani, Kebabs, Naan",
  },
  {
    id: "ft-3",
    name: "Sweet Treats",
    cuisine: "Desserts",
    contact: "Yusuf Demir",
    phone: "+1 (555) 333-4444",
    email: "yusuf@sweettreats.com",
    slot: "FT-03",
    location: "Food Court - East",
    status: "confirmed",
    menu: "Baklava, Kunafa, Ice Cream, Turkish Delight",
  },
  {
    id: "ft-4",
    name: "Taco Halal",
    cuisine: "Mexican-Halal Fusion",
    contact: "Omar Rodriguez",
    phone: "+1 (555) 444-5555",
    email: "omar@tacohalal.com",
    slot: "FT-04",
    location: "Food Court - East",
    status: "pending",
    menu: "Halal Tacos, Burritos, Quesadillas, Churros",
  },
  {
    id: "ft-5",
    name: "BBQ Pitmaster",
    cuisine: "BBQ",
    contact: "Ahmed Johnson",
    phone: "+1 (555) 555-6666",
    email: "ahmed@bbqpitmaster.com",
    slot: "FT-05",
    location: "Outdoor Area",
    status: "confirmed",
    menu: "Smoked Brisket, Ribs, Chicken, Mac & Cheese",
  },
  {
    id: "ft-6",
    name: "Fresh Juice Bar",
    cuisine: "Beverages",
    contact: "Sarah Ahmed",
    phone: "+1 (555) 666-7777",
    email: "sarah@freshjuice.com",
    slot: "FT-06",
    location: "Near Main Entrance",
    status: "confirmed",
    menu: "Fresh Juices, Smoothies, Lemonade, Iced Tea",
  },
  {
    id: "ft-7",
    name: "Pizza Halal",
    cuisine: "Italian",
    contact: "Ibrahim Rossi",
    phone: "+1 (555) 777-8888",
    email: "ibrahim@pizzahalal.com",
    slot: null,
    location: "TBD",
    status: "pending",
    menu: "Wood-fired Pizza, Calzones, Garlic Bread",
  },
  {
    id: "ft-8",
    name: "Coffee & Chai",
    cuisine: "Beverages",
    contact: "Aisha Patel",
    phone: "+1 (555) 888-9999",
    email: "aisha@coffeeandchai.com",
    slot: "FT-07",
    location: "Activity Area",
    status: "confirmed",
    menu: "Specialty Coffee, Chai Tea, Pastries, Cookies",
  },
]

export default function FoodTrucksPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showAddDialog, setShowAddDialog] = useState(false)

  const filteredTrucks = mockFoodTrucks.filter((truck) => {
    const matchesSearch =
      truck.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      truck.cuisine.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || truck.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: mockFoodTrucks.length,
    confirmed: mockFoodTrucks.filter((t) => t.status === "confirmed").length,
    pending: mockFoodTrucks.filter((t) => t.status === "pending").length,
    slots: 10,
    slotsUsed: mockFoodTrucks.filter((t) => t.slot).length,
  }

  return (
    <>
      <Header title="Food Trucks" />
      <div className="p-6">
        <div className="flex flex-col gap-6">
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Food Trucks</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <div className="rounded-lg bg-orange-50 p-2">
                    <Utensils className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Confirmed</p>
                    <p className="text-2xl font-bold text-emerald-600">{stats.confirmed}</p>
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
                    <p className="text-sm text-muted-foreground">Pending</p>
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
                    <p className="text-sm text-muted-foreground">Slots Used</p>
                    <p className="text-2xl font-bold">{stats.slotsUsed}/{stats.slots}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search food trucks..."
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
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Food Truck
            </Button>
          </div>

          {/* Food Trucks Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Food Truck</TableHead>
                    <TableHead>Cuisine</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Slot</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrucks.map((truck) => (
                    <TableRow key={truck.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
                            <Utensils className="h-4 w-4 text-orange-600" />
                          </div>
                          <span className="font-medium">{truck.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{truck.cuisine}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{truck.contact}</span>
                          <span className="text-xs text-muted-foreground">{truck.phone}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {truck.slot || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{truck.location}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            truck.status === "confirmed" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                            truck.status === "pending" && "border-amber-200 bg-amber-50 text-amber-700"
                          )}
                        >
                          {truck.status === "confirmed" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                          {truck.status === "pending" && <Clock className="mr-1 h-3 w-3" />}
                          {truck.status.charAt(0).toUpperCase() + truck.status.slice(1)}
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
                            <DropdownMenuItem>
                              <Mail className="mr-2 h-4 w-4" />
                              Send Email
                            </DropdownMenuItem>
                            {!truck.slot && (
                              <DropdownMenuItem>
                                <MapPin className="mr-2 h-4 w-4" />
                                Assign Slot
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
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
      </div>

      {/* Add Food Truck Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Food Truck</DialogTitle>
            <DialogDescription>Register a new food truck for the bazaar</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="truck-name">Food Truck Name</Label>
              <Input id="truck-name" placeholder="e.g., Mediterranean Delights" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="truck-cuisine">Cuisine Type</Label>
                <Select>
                  <SelectTrigger id="truck-cuisine">
                    <SelectValue placeholder="Select cuisine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mediterranean">Mediterranean</SelectItem>
                    <SelectItem value="south-asian">South Asian</SelectItem>
                    <SelectItem value="middle-eastern">Middle Eastern</SelectItem>
                    <SelectItem value="american">American</SelectItem>
                    <SelectItem value="mexican">Mexican</SelectItem>
                    <SelectItem value="desserts">Desserts</SelectItem>
                    <SelectItem value="beverages">Beverages</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="truck-slot">Slot Assignment</Label>
                <Select>
                  <SelectTrigger id="truck-slot">
                    <SelectValue placeholder="Assign slot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="later">Assign Later</SelectItem>
                    <SelectItem value="FT-08">FT-08 (Food Court - East)</SelectItem>
                    <SelectItem value="FT-09">FT-09 (Outdoor Area)</SelectItem>
                    <SelectItem value="FT-10">FT-10 (Near Entrance)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="truck-contact">Contact Person</Label>
              <Input id="truck-contact" placeholder="Contact name" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="truck-phone">Phone</Label>
                <Input id="truck-phone" placeholder="+1 (555) 000-0000" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="truck-email">Email</Label>
                <Input id="truck-email" type="email" placeholder="email@example.com" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="truck-menu">Menu Items</Label>
              <Textarea id="truck-menu" placeholder="List main menu items..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDialog(false)}>Add Food Truck</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
