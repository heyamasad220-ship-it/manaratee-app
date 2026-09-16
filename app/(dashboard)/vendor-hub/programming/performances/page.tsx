"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TimeInput } from "@/components/ui/time-input"
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
import { formatPhoneDisplay } from "@/lib/ui/format-phone"
import { cn } from "@/lib/utils"

type Entertainment = {
  id: string
  name: string
  type: string
  performer: string
  time: string
  stage: string
  status: "confirmed" | "pending"
  description: string
  contact: string
  phone: string
}

const entertainment: Entertainment[] = []

const performanceTypes = ["All", "Music", "Dance", "Kids", "Comedy", "Recitation"]

export default function EntertainmentPage() {
  const [selectedType, setSelectedType] = useState("All")
  const [showAddDialog, setShowAddDialog] = useState(false)

  const filteredEntertainment = entertainment.filter(
    (item) => selectedType === "All" || item.type === selectedType
  )

  const sortedEntertainment = [...filteredEntertainment].sort((a, b) => {
    const timeA = a.time.split(" - ")[0]
    const timeB = b.time.split(" - ")[0]
    return timeA.localeCompare(timeB)
  })

  const mainStageItems = sortedEntertainment.filter((item) => item.stage === "Main Stage")
  const kidsStageItems = sortedEntertainment.filter((item) => item.stage === "Kids Stage")

  return (
    <>
      <div>
        <div className="flex flex-col gap-6">
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
              {sortedEntertainment.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No performances scheduled yet.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {sortedEntertainment.map((item, index) => (
                    <div
                      key={item.id}
                      className={cn(
                        "relative flex gap-4 pb-4",
                        index !== sortedEntertainment.length - 1 && "border-b"
                      )}
                    >
                      <div className="w-[140px] shrink-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {item.time.split(" - ")[0]}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          to {item.time.split(" - ")[1]}
                        </p>
                      </div>

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
                                item.status === "confirmed" &&
                                  "border-emerald-200 bg-emerald-50 text-emerald-700",
                                item.status === "pending" &&
                                  "border-amber-200 bg-amber-50 text-amber-700"
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
                          <span>
                            Contact: {item.contact} • {formatPhoneDisplay(item.phone) || item.phone}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Music className="h-5 w-5 text-pink-600" />
                  Main Stage
                </CardTitle>
              </CardHeader>

              <CardContent>
                {mainStageItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No Main Stage performances yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {mainStageItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{item.time}</p>
                        </div>
                        <Badge variant="outline">{item.type}</Badge>
                      </div>
                    ))}
                  </div>
                )}
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
                {kidsStageItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No Kids Stage performances yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {kidsStageItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{item.time}</p>
                        </div>
                        <Badge variant="outline">{item.type}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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
                <TimeInput id="perf-start" />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="perf-end">End Time</Label>
                <TimeInput id="perf-end" />
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