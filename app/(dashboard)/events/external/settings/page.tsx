"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const settingsTabs = ["Event Types", "Deposit Policy", "General"] as const
type SettingsTab = (typeof settingsTabs)[number]

const defaultEventTypes = [
  { id: "et-1", name: "Wedding", active: true },
  { id: "et-2", name: "Engagement", active: true },
  { id: "et-3", name: "Graduation", active: true },
  { id: "et-4", name: "Baby Shower", active: true },
  { id: "et-5", name: "Birthday Party", active: true },
  { id: "et-6", name: "Corporate Event", active: true },
  { id: "et-7", name: "Dinner Banquet", active: true },
  { id: "et-8", name: "Meeting", active: true },
  { id: "et-9", name: "Memorial Service", active: true },
  { id: "et-10", name: "Fundraiser", active: true },
  { id: "et-11", name: "Workshop", active: true },
  { id: "et-12", name: "Conference", active: true },
]



export default function VenueRentalSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("Event Types")
  const [eventTypes, setEventTypes] = useState(defaultEventTypes)
  const [newTypeName, setNewTypeName] = useState("")
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  

  function addEventType() {
    if (!newTypeName.trim()) return
    const id = `et-${Date.now()}`
    setEventTypes((prev) => [...prev, { id, name: newTypeName.trim(), active: true }])
    setNewTypeName("")
    setAddDialogOpen(false)
  }

  function startEditing(id: string, name: string) {
    setEditingId(id)
    setEditName(name)
  }

  function saveEdit(id: string) {
    if (!editName.trim()) return
    setEventTypes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name: editName.trim() } : t))
    )
    setEditingId(null)
    setEditName("")
  }

  function toggleActive(id: string) {
    setEventTypes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, active: !t.active } : t))
    )
  }

  function deleteEventType(id: string) {
    setEventTypes((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <>
      <Header title="Venue Rental Settings" />
      <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
        {/* Settings sub-tabs */}
        <div className="mb-6 flex gap-0 border-b border-border">
          {settingsTabs.map((tab) => (
            <button
              key={tab}
              suppressHydrationWarning
              onClick={() => {
                setActiveTab(tab)
                setSearchQuery("")
              }}
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

        {/* Event Types Tab */}
        {activeTab === "Event Types" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Event Types</h3>
                <p className="text-sm text-muted-foreground">
                  Manage the types of events available for venue rentals.
                </p>
              </div>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Add Event Type
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Event Type</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 pt-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="event-type-name">Name</Label>
                      <Input
                        id="event-type-name"
                        placeholder="e.g. Anniversary, Bridal Shower..."
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addEventType()}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={addEventType} disabled={!newTypeName.trim()}>
                        Add
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[140px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventTypes.map((eventType, index) => (
                    <TableRow key={eventType.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        {editingId === eventType.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && saveEdit(eventType.id)}
                              className="h-8 w-[240px]"
                              autoFocus
                            />
                            <Button size="sm" className="h-8" onClick={() => saveEdit(eventType.id)}>
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-foreground">
                            {eventType.name}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => toggleActive(eventType.id)}
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                            eventType.active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {eventType.active ? "Active" : "Inactive"}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => startEditing(eventType.id, eventType.name)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteEventType(eventType.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        

        {/* Deposit Policy Tab */}
        {activeTab === "Deposit Policy" && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Deposit Policy</h3>
              <p className="text-sm text-muted-foreground">
                Configure deposit requirements for venue rentals.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-card p-5">
                <Label className="text-sm font-medium text-foreground">Default Deposit Percentage</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input defaultValue="50" className="w-[100px]" />
                  <span className="text-sm text-muted-foreground">% of total cost</span>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <Label className="text-sm font-medium text-foreground">Deposit Due</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input defaultValue="14" className="w-[100px]" />
                  <span className="text-sm text-muted-foreground">days before event</span>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <Label className="text-sm font-medium text-foreground">Remaining Balance Due</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input defaultValue="3" className="w-[100px]" />
                  <span className="text-sm text-muted-foreground">days before event</span>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <Label className="text-sm font-medium text-foreground">Cancellation Fee</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input defaultValue="25" className="w-[100px]" />
                  <span className="text-sm text-muted-foreground">% of deposit (non-refundable)</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button>Save Changes</Button>
            </div>
          </div>
        )}

        {/* General Tab */}
        {activeTab === "General" && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">General Settings</h3>
              <p className="text-sm text-muted-foreground">
                Configure general venue rental settings.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-card p-5">
                <Label className="text-sm font-medium text-foreground">Rental Agreement Template</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload or edit the default rental agreement sent to customers.
                </p>
                <Button variant="outline" className="mt-3">Upload Template</Button>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <Label className="text-sm font-medium text-foreground">Confirmation Email</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Automatically send a confirmation email when a rental is booked.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <input type="checkbox" id="auto-confirm" defaultChecked className="h-4 w-4 rounded border-border" />
                  <label htmlFor="auto-confirm" className="text-sm text-foreground">Enable auto-confirmation emails</label>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <Label className="text-sm font-medium text-foreground">Booking Buffer</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Minimum time between back-to-back rentals for setup and teardown.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Input defaultValue="2" className="w-[100px]" />
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button>Save Changes</Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
