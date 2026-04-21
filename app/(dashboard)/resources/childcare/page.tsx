"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Plus, MoreHorizontal, Edit, Trash2, Phone, Mail, Clock, Users, CheckCircle2 } from "lucide-react"
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

interface ChildcareHistory {
  id: string
  eventName: string
  date: string
  hoursWorked: number
  childrenSupervised: number
  performance: "Excellent" | "Good" | "Average" | "Poor"
  notes?: string
}

interface ChildcareProvider {
  id: string
  name: string
  phone: string
  email: string
  experience: string
  certifications: string
  ageGroups: string
  availability: string
  status: "Active" | "Inactive"
  notes: string
  totalHours: number
  eventsWorked: number
  history: ChildcareHistory[]
}

const childcareProviders: ChildcareProvider[] = [
  {
    id: "cp-1",
    name: "Sarah Johnson",
    phone: "(555) 123-4567",
    email: "sarah.johnson@email.com",
    experience: "5 years",
    certifications: "CPR, First Aid",
    ageGroups: "Infants, Toddlers",
    availability: "Weekends",
    status: "Active",
    notes: "Specializes in infant care",
    totalHours: 120,
    eventsWorked: 15,
    history: [
      { id: "h-1", eventName: "Eid Bazaar 2025", date: "Apr 10, 2025", hoursWorked: 8, childrenSupervised: 12, performance: "Excellent", notes: "Handled large group very well. Parents gave positive feedback." },
      { id: "h-2", eventName: "Community Iftar 2025", date: "Mar 25, 2025", hoursWorked: 6, childrenSupervised: 8, performance: "Excellent", notes: "Very patient with toddlers." },
      { id: "h-3", eventName: "Winter Fundraiser 2024", date: "Dec 15, 2024", hoursWorked: 5, childrenSupervised: 10, performance: "Good", notes: "" },
    ],
  },
  {
    id: "cp-2",
    name: "Maria Garcia",
    phone: "(555) 234-5678",
    email: "maria.garcia@email.com",
    experience: "8 years",
    certifications: "CPR, First Aid, Early Childhood Education",
    ageGroups: "Toddlers, Preschool",
    availability: "Fridays, Weekends",
    status: "Active",
    notes: "Bilingual (English/Spanish)",
    totalHours: 200,
    eventsWorked: 25,
    history: [
      { id: "h-4", eventName: "Sunday School 2025", date: "Sep-Dec 2025", hoursWorked: 60, childrenSupervised: 15, performance: "Excellent", notes: "Amazing with preschoolers. Educational activities." },
      { id: "h-5", eventName: "Summer Camp 2025", date: "Jul 2025", hoursWorked: 40, childrenSupervised: 20, performance: "Excellent", notes: "Coordinated other childcare workers effectively." },
    ],
  },
  {
    id: "cp-3",
    name: "Fatima Ahmed",
    phone: "(555) 345-6789",
    email: "fatima.ahmed@email.com",
    experience: "3 years",
    certifications: "CPR, First Aid",
    ageGroups: "All Ages",
    availability: "Flexible",
    status: "Active",
    notes: "",
    totalHours: 80,
    eventsWorked: 10,
    history: [
      { id: "h-6", eventName: "Youth Night 2025", date: "Oct 15, 2025", hoursWorked: 4, childrenSupervised: 18, performance: "Good", notes: "Good with older children." },
    ],
  },
  {
    id: "cp-4",
    name: "Jennifer Lee",
    phone: "(555) 456-7890",
    email: "jennifer.lee@email.com",
    experience: "10 years",
    certifications: "CPR, First Aid, Special Needs Training",
    ageGroups: "School Age",
    availability: "Weekdays",
    status: "Inactive",
    notes: "On leave until April",
    totalHours: 350,
    eventsWorked: 45,
    history: [
      { id: "h-7", eventName: "After School Program 2024", date: "Sep-Nov 2024", hoursWorked: 100, childrenSupervised: 25, performance: "Excellent", notes: "Excellent with special needs children." },
    ],
  },
  {
    id: "cp-5",
    name: "Amina Hassan",
    phone: "(555) 567-8901",
    email: "amina.hassan@email.com",
    experience: "6 years",
    certifications: "CPR, First Aid",
    ageGroups: "Infants, Toddlers, Preschool",
    availability: "Fridays, Saturdays",
    status: "Active",
    notes: "Available for special events",
    totalHours: 150,
    eventsWorked: 20,
    history: [
      { id: "h-8", eventName: "Ramadan Taraweeh 2025", date: "Mar 2025", hoursWorked: 30, childrenSupervised: 15, performance: "Excellent", notes: "Very reliable. Came every night." },
      { id: "h-9", eventName: "Eid Prayer 2024", date: "Apr 10, 2024", hoursWorked: 4, childrenSupervised: 30, performance: "Excellent", notes: "Managed large group during Eid prayer." },
    ],
  },
]

const performanceStyles: Record<string, string> = {
  Excellent: "bg-emerald-100 text-emerald-700",
  Good: "bg-blue-100 text-blue-700",
  Average: "bg-amber-100 text-amber-700",
  Poor: "bg-red-100 text-red-700",
}

export default function ChildcareDirectoryPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ChildcareProvider | null>(null)

  const filtered = childcareProviders.filter((provider) => {
    const matchesSearch =
      provider.name.toLowerCase().includes(search.toLowerCase()) ||
      provider.email.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || provider.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const activeCount = childcareProviders.filter((p) => p.status === "Active").length
  const totalCount = childcareProviders.length
  const totalHours = childcareProviders.reduce((sum, p) => sum + p.totalHours, 0)

  return (
    <>
      <Header title="Childcare Providers" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="border border-border">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalCount}</p>
                <p className="text-xs text-muted-foreground">Total Providers</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Active Providers</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalHours.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Hours</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {childcareProviders.reduce((sum, p) => sum + p.eventsWorked, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Total Events Worked</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 sm:w-[280px]"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Provider
          </Button>
        </div>

        {/* Providers Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Age Groups</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setSelectedProvider(provider)}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {provider.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {provider.phone}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          {provider.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{provider.experience}</TableCell>
                    <TableCell>{provider.ageGroups}</TableCell>
                    <TableCell className="tabular-nums font-medium">{provider.totalHours}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{provider.eventsWorked}</TableCell>
                    <TableCell>
                      <Badge
                        variant={provider.status === "Active" ? "default" : "secondary"}
                        className={
                          provider.status === "Active"
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                        }
                      >
                        {provider.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedProvider(provider)}>
                            <Edit className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
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

      {/* Provider Detail Dialog */}
      <Dialog open={!!selectedProvider} onOpenChange={() => setSelectedProvider(null)}>
        <DialogContent className="max-w-2xl">
          {selectedProvider && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedProvider.name}
                  <Badge
                    variant={selectedProvider.status === "Active" ? "default" : "secondary"}
                    className={
                      selectedProvider.status === "Active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }
                  >
                    {selectedProvider.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {selectedProvider.experience} experience | {selectedProvider.certifications}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="info" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="history">History ({selectedProvider.history.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="mt-4">
                  <div className="flex flex-col gap-6">
                    {/* Contact Info */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Phone</span>
                        <span className="text-sm font-medium">{selectedProvider.phone}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Email</span>
                        <span className="text-sm font-medium">{selectedProvider.email}</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border border-border p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{selectedProvider.totalHours}</p>
                        <p className="text-xs text-muted-foreground">Total Hours</p>
                      </div>
                      <div className="rounded-lg border border-border p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{selectedProvider.eventsWorked}</p>
                        <p className="text-xs text-muted-foreground">Events Worked</p>
                      </div>
                      <div className="rounded-lg border border-border p-4 text-center">
                        <p className="text-2xl font-bold text-primary">
                          {selectedProvider.history.length > 0
                            ? Math.round((selectedProvider.history.filter(h => h.performance === "Excellent" || h.performance === "Good").length / selectedProvider.history.length) * 100)
                            : 0}%
                        </p>
                        <p className="text-xs text-muted-foreground">Positive Reviews</p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Age Groups</span>
                        <span className="text-sm font-medium">{selectedProvider.ageGroups}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Availability</span>
                        <span className="text-sm font-medium">{selectedProvider.availability}</span>
                      </div>
                    </div>

                    {/* Certifications */}
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Certifications</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedProvider.certifications.split(", ").map((cert) => (
                          <Badge key={cert} variant="secondary">
                            {cert}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    {selectedProvider.notes && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Notes</span>
                        <p className="text-sm">{selectedProvider.notes}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  <div className="flex flex-col gap-4">
                    {/* Summary Stats */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border border-border p-3 text-center">
                        <p className="text-xl font-bold text-foreground">{selectedProvider.history.length}</p>
                        <p className="text-xs text-muted-foreground">Events Completed</p>
                      </div>
                      <div className="rounded-lg border border-border p-3 text-center">
                        <p className="text-xl font-bold text-foreground">
                          {selectedProvider.history.reduce((sum, h) => sum + h.hoursWorked, 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Hours</p>
                      </div>
                      <div className="rounded-lg border border-border p-3 text-center">
                        <p className="text-xl font-bold text-foreground">
                          {selectedProvider.history.reduce((sum, h) => sum + h.childrenSupervised, 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Children Supervised</p>
                      </div>
                    </div>

                    {/* History List */}
                    {selectedProvider.history.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">No participation history yet.</p>
                    ) : (
                      <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto">
                        {selectedProvider.history.map((record) => (
                          <div key={record.id} className="rounded-lg border p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{record.eventName}</span>
                                  <Badge variant="secondary" className={performanceStyles[record.performance]}>
                                    {record.performance}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">{record.date}</span>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">{record.hoursWorked} hrs</p>
                                <p className="text-xs text-muted-foreground">{record.childrenSupervised} children</p>
                              </div>
                            </div>
                            {record.notes && (
                              <div className="mt-2 rounded bg-muted/50 p-2">
                                <p className="text-xs text-muted-foreground">{record.notes}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedProvider(null)}>
                  Close
                </Button>
                <Button>Edit Provider</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Provider Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Childcare Provider</DialogTitle>
            <DialogDescription>
              Add a new childcare provider to the directory
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="provider-name">Provider Name</Label>
              <Input id="provider-name" placeholder="Enter provider's full name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" placeholder="(555) 123-4567" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="email@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="experience">Experience</Label>
                <Input id="experience" placeholder="e.g., 5 years" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="availability">Availability</Label>
                <Input id="availability" placeholder="e.g., Weekends" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="certifications">Certifications</Label>
              <Input id="certifications" placeholder="e.g., CPR, First Aid" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="age-groups">Age Groups</Label>
              <Input id="age-groups" placeholder="e.g., Infants, Toddlers, Preschool" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" placeholder="Any additional information" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDialog(false)}>
              Add Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
