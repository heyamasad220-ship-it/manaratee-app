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
  MoreHorizontal,
  Pencil,
  Trash2,
  Music,
  Mic2,
  Users,
  Clock,
  MapPin,
  Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Mock entertainment
const mockEntertainment = [
  {
    id: "ent-1",
    name: "Nasheed Performance",
    type: "Music",
    performer: "Harmony Voices",
    time: "11:00 AM - 12:00 PM",
    stage: "Main Stage",
    status: "confirmed",
    description: "Traditional nasheed performance by local vocal group",
    contact: "Ahmed Hassan",
    phone: "+1 (555) 111-1111",
  },
  {
    id: "ent-2",
    name: "Children's Story Time",
    type: "Kids",
    performer: "Sister Fatima",
    time: "1:00 PM - 1:30 PM",
    stage: "Kids Stage",
    status: "confirmed",
    description: "Interactive storytelling session for children ages 3-8",
    contact: "Fatima Ali",
    phone: "+1 (555) 222-2222",
  },
  {
    id: "ent-3",
    name: "Cultural Dance",
    type: "Dance",
    performer: "Unity Dance Troupe",
    time: "2:00 PM - 2:45 PM",
    stage: "Main Stage",
    status: "confirmed",
    description: "Traditional cultural dance performances from various regions",
    contact: "Yusuf Khan",
    phone: "+1 (555) 333-3333",
  },
  {
    id: "ent-4",
    name: "Comedy Show",
    type: "Comedy",
    performer: "Preacher Moss",
    time: "4:00 PM - 5:00 PM",
    stage: "Main Stage",
    status: "pending",
    description: "Family-friendly stand-up comedy performance",
    contact: "Omar Ahmed",
    phone: "+1 (555) 444-4444",
  },
  {
    id: "ent-5",
    name: "Quran Recitation",
    type: "Recitation",
    performer: "Qari Ibrahim",
    time: "6:00 PM - 6:30 PM",
    stage: "Main Stage",
    status: "confirmed",
    description: "Beautiful Quran recitation with translation",
    contact: "Ibrahim Patel",
    phone: "+1 (555) 555-5555",
  },
  {
    id: "ent-6",
    name: "Magic Show",
    type: "Kids",
    performer: "The Amazing Ali",
    time: "3:00 PM - 3:45 PM",
    stage: "Kids Stage",
    status: "confirmed",
    description: "Family-friendly magic and illusion show",
    contact: "Ali Rahman",
    phone: "+1 (555) 666-6666",
  },
]

const performanceTypes = ["All", "Music", "Dance", "Kids", "Comedy", "Recitation"]

export default function EntertainmentPage() {
  const [selectedType, setSelectedType] = useState("All")
  const [showAddDialog, setShowAddDialog] = useState(false)

  const filteredEntertainment = mockEntertainment.filter(
    (item) => selectedType === "All" || item.type === selectedType
  )

  // Sort by time
  const sortedEntertainment = [...filteredEntertainment].sort((a, b) => {
    const timeA = a.time.split(" - ")[0]
    const timeB = b.time.split(" - ")[0]
    return timeA.localeCompare(timeB)
  })

  return (
    <>
      <Header title="Entertainment" />
      <div className="p-6">
        <div className="flex flex-col gap-6">
          {/* Header & Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Entertainment Schedule</h2>
              <p className="text-sm text-muted-foreground">
                Manage stage performances, shows, and entertainment acts
              </p>
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Performance
            </Button>
          </div>

          {/* Type Filter */}
          <div className="flex flex-wrap gap-2">
            {performanceTypes.map((type) => (
              <Button
                key={type}
                variant={selectedType === type ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType(type)}
              >
                {type}
              </Button>
            ))}
          </div>

          {/* Schedule Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-5 w-5" />
                Performance Schedule
              </CardTitle>
              <CardDescription>
                {sortedEntertainment.length} performances scheduled
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {sortedEntertainment.map((item, index) => (
                  <div
                    key={item.id}
                    className={cn(
                      "relative flex gap-4 pb-4",
                      index !== sortedEntertainment.length - 1 && "border-b"
                    )}
                  >
                    {/* Time */}
                    <div className="w-[140px] shrink-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {item.time.split(" - ")[0]}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        to {item.time.split(" - ")[1]}
                      </p>
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{item.name}</h4>
                          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mic2 className="h-3.5 w-3.5" />
                              {item.performer}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {item.stage}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              item.status === "confirmed" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                              item.status === "pending" && "border-amber-200 bg-amber-50 text-amber-700"
                            )}
                          >
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                          </Badge>
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
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">
                          {item.type}
                        </Badge>
                        <span>Contact: {item.contact} • {item.phone}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stage Overview */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Music className="h-5 w-5 text-pink-600" />
                  Main Stage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {sortedEntertainment
                    .filter((e) => e.stage === "Main Stage")
                    .map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{item.time}</p>
                        </div>
                        <Badge variant="outline">{item.type}</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5 text-blue-600" />
                  Kids Stage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {sortedEntertainment
                    .filter((e) => e.stage === "Kids Stage")
                    .map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{item.time}</p>
                        </div>
                        <Badge variant="outline">{item.type}</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Performance Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Performance</DialogTitle>
            <DialogDescription>Schedule a new entertainment performance</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="perf-name">Performance Name</Label>
              <Input id="perf-name" placeholder="e.g., Nasheed Performance" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="perf-type">Type</Label>
                <Select>
                  <SelectTrigger id="perf-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="music">Music</SelectItem>
                    <SelectItem value="dance">Dance</SelectItem>
                    <SelectItem value="kids">Kids</SelectItem>
                    <SelectItem value="comedy">Comedy</SelectItem>
                    <SelectItem value="recitation">Recitation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="perf-stage">Stage</Label>
                <Select>
                  <SelectTrigger id="perf-stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Main Stage</SelectItem>
                    <SelectItem value="kids">Kids Stage</SelectItem>
                    <SelectItem value="outdoor">Outdoor Area</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="perf-performer">Performer/Group Name</Label>
              <Input id="perf-performer" placeholder="e.g., Harmony Voices" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="perf-start">Start Time</Label>
                <Input id="perf-start" type="time" defaultValue="12:00" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="perf-end">End Time</Label>
                <Input id="perf-end" type="time" defaultValue="13:00" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="perf-contact">Contact Person</Label>
                <Input id="perf-contact" placeholder="Contact name" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="perf-phone">Phone</Label>
                <Input id="perf-phone" placeholder="+1 (555) 000-0000" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="perf-description">Description</Label>
              <Textarea id="perf-description" placeholder="Describe the performance..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDialog(false)}>Add Performance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
