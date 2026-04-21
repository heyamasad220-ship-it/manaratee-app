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
  MapPin,
  Clock,
  Users,
  Sparkles,
  Palette,
  Castle,
  Gamepad2,
  Baby,
  Heart,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Mock activities
const mockActivities = [
  {
    id: "act-1",
    name: "Bounce House",
    category: "Kids Zone",
    location: "Outdoor Area - Zone A",
    time: "10:00 AM - 6:00 PM",
    capacity: "20 kids at a time",
    vendor: "Kids Fun Zone",
    status: "confirmed",
    description: "Large inflatable bounce house for children ages 3-12",
    icon: Castle,
    color: "#3b82f6",
  },
  {
    id: "act-2",
    name: "Face Painting",
    category: "Kids Zone",
    location: "Activity Tent B",
    time: "11:00 AM - 5:00 PM",
    capacity: "Unlimited",
    vendor: "Artsy Kids",
    status: "confirmed",
    description: "Professional face painting with fun designs for kids",
    icon: Palette,
    color: "#ec4899",
  },
  {
    id: "act-3",
    name: "Henna Station",
    category: "Arts & Crafts",
    location: "Booth C-02",
    time: "10:00 AM - 7:00 PM",
    capacity: "Unlimited",
    vendor: "Henna Artists",
    status: "confirmed",
    description: "Traditional henna designs for all ages",
    icon: Heart,
    color: "#f59e0b",
  },
  {
    id: "act-4",
    name: "Carnival Games",
    category: "Games",
    location: "Outdoor Area - Zone B",
    time: "10:00 AM - 8:00 PM",
    capacity: "Multiple stations",
    vendor: "Fun Games Co.",
    status: "pending",
    description: "Ring toss, balloon darts, and prize games",
    icon: Gamepad2,
    color: "#10b981",
  },
  {
    id: "act-5",
    name: "Balloon Animals",
    category: "Kids Zone",
    location: "Roaming / Activity Tent A",
    time: "12:00 PM - 6:00 PM",
    capacity: "Unlimited",
    vendor: "Twist & Shout",
    status: "confirmed",
    description: "Professional balloon artist creating custom designs",
    icon: Baby,
    color: "#8b5cf6",
  },
  {
    id: "act-6",
    name: "Arts & Crafts Station",
    category: "Arts & Crafts",
    location: "Activity Tent C",
    time: "10:00 AM - 4:00 PM",
    capacity: "30 participants",
    vendor: "Creative Kids",
    status: "pending",
    description: "Islamic art projects for children",
    icon: Sparkles,
    color: "#06b6d4",
  },
]

const activityCategories = ["All", "Kids Zone", "Arts & Crafts", "Games", "Educational"]

export default function ActivitiesPage() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [showAddDialog, setShowAddDialog] = useState(false)

  const filteredActivities = mockActivities.filter(
    (activity) => selectedCategory === "All" || activity.category === selectedCategory
  )

  return (
    <>
      <Header title="Activities" />
      <div className="p-6">
        <div className="flex flex-col gap-6">
          {/* Header & Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Bazaar Activities</h2>
              <p className="text-sm text-muted-foreground">
                Manage activities like bounce houses, face painting, games, and more
              </p>
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Activity
            </Button>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {activityCategories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>

          {/* Activities Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredActivities.map((activity) => {
              const IconComponent = activity.icon
              return (
                <Card key={activity.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg"
                          style={{ backgroundColor: activity.color + "20" }}
                        >
                          <IconComponent className="h-5 w-5" style={{ color: activity.color }} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{activity.name}</CardTitle>
                          <CardDescription>{activity.category}</CardDescription>
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
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                    <div className="flex flex-col gap-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{activity.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{activity.time}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{activity.capacity}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t pt-3">
                      <span className="text-sm text-muted-foreground">{activity.vendor}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          activity.status === "confirmed" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                          activity.status === "pending" && "border-amber-200 bg-amber-50 text-amber-700"
                        )}
                      >
                        {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>

      {/* Add Activity Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Activity</DialogTitle>
            <DialogDescription>Add a new activity for the bazaar</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="activity-name">Activity Name</Label>
              <Input id="activity-name" placeholder="e.g., Bounce House" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="activity-category">Category</Label>
                <Select>
                  <SelectTrigger id="activity-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kids-zone">Kids Zone</SelectItem>
                    <SelectItem value="arts-crafts">Arts & Crafts</SelectItem>
                    <SelectItem value="games">Games</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="activity-vendor">Vendor/Provider</Label>
                <Select>
                  <SelectTrigger id="activity-vendor">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kids-fun">Kids Fun Zone</SelectItem>
                    <SelectItem value="artsy">Artsy Kids</SelectItem>
                    <SelectItem value="fun-games">Fun Games Co.</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="activity-location">Location</Label>
              <Input id="activity-location" placeholder="e.g., Outdoor Area - Zone A" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="activity-start">Start Time</Label>
                <Input id="activity-start" type="time" defaultValue="10:00" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="activity-end">End Time</Label>
                <Input id="activity-end" type="time" defaultValue="18:00" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="activity-capacity">Capacity</Label>
              <Input id="activity-capacity" placeholder="e.g., 20 kids at a time" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="activity-description">Description</Label>
              <Textarea id="activity-description" placeholder="Describe this activity..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDialog(false)}>Add Activity</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
