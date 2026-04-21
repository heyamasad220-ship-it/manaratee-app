"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const mainSettingsTabs = ["Events Settings", "Volunteers Settings", "Childcare Settings"] as const
type MainSettingsTab = (typeof mainSettingsTabs)[number]

const eventsSubTabs = ["Event Types", "Notifications"] as const
type EventsSubTab = (typeof eventsSubTabs)[number]

// Mock event types
const defaultEventTypes = [
  { id: "et-1", name: "Community Event", color: "#10B981", description: "General community gatherings" },
  { id: "et-2", name: "Religious Service", color: "#6366F1", description: "Regular prayer services" },
  { id: "et-3", name: "Educational", color: "#F59E0B", description: "Classes and workshops" },
  { id: "et-4", name: "Youth Program", color: "#EC4899", description: "Youth-focused activities" },
  { id: "et-5", name: "Fundraiser", color: "#8B5CF6", description: "Fundraising events" },
]

export default function SettingsPage() {
  const [mainTab, setMainTab] = useState<MainSettingsTab>("Events Settings")
  const [eventsSubTab, setEventsSubTab] = useState<EventsSubTab>("Event Types")
  const [eventTypes, setEventTypes] = useState(defaultEventTypes)
  const [showAddTypeDialog, setShowAddTypeDialog] = useState(false)
  const [editingType, setEditingType] = useState<typeof defaultEventTypes[0] | null>(null)

  return (
    <>
      <Header title="Internal Events Settings" />
      <div className="p-6">
        {/* Main Settings Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
          {mainSettingsTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                mainTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Events Settings */}
        {mainTab === "Events Settings" && (
          <>
            <div className="mb-6 flex gap-0 border-b border-border">
              {eventsSubTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setEventsSubTab(tab)}
                  className={cn(
                    "relative px-4 py-2.5 text-sm font-medium transition-colors",
                    eventsSubTab === tab
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab}
                  {eventsSubTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                  )}
                </button>
              ))}
            </div>

            {eventsSubTab === "Event Types" && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Event Types</h3>
                    <p className="text-sm text-muted-foreground">Categorize your events by type</p>
                  </div>
                  <Button onClick={() => setShowAddTypeDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Type
                  </Button>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Color</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {eventTypes.map((type) => (
                          <TableRow key={type.id}>
                            <TableCell>
                              <div className="h-4 w-4 rounded-full" style={{ backgroundColor: type.color }} />
                            </TableCell>
                            <TableCell className="font-medium">{type.name}</TableCell>
                            <TableCell className="text-muted-foreground">{type.description}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingType(type)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={() => setEventTypes(eventTypes.filter((t) => t.id !== type.id))}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

            {eventsSubTab === "Notifications" && (
              <div className="flex flex-col gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Email Notifications</CardTitle>
                    <CardDescription>Configure when email notifications are sent for events</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Event Created</Label>
                          <p className="text-sm text-muted-foreground">Send notification when a new event is created</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    </div>
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Event Updated</Label>
                          <p className="text-sm text-muted-foreground">Send notification when event details are changed</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    </div>
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Event Cancelled</Label>
                          <p className="text-sm text-muted-foreground">Send notification when an event is cancelled</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    </div>
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Event Reminders</Label>
                          <p className="text-sm text-muted-foreground">Send reminder notifications before events</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex justify-end">
                  <Button>Save Changes</Button>
                </div>
              </div>
            )}

            
          </>
        )}

        {/* Volunteers Settings */}
        {mainTab === "Volunteers Settings" && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Volunteer Defaults</CardTitle>
                <CardDescription>Configure default settings for volunteer sign-ups</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="default-slots">Default Volunteer Slots</Label>
                    <Input id="default-slots" type="number" defaultValue="10" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="signup-deadline">Default Sign-up Deadline</Label>
                    <Select defaultValue="24h">
                      <SelectTrigger id="signup-deadline">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No deadline</SelectItem>
                        <SelectItem value="1h">1 hour before event</SelectItem>
                        <SelectItem value="24h">24 hours before event</SelectItem>
                        <SelectItem value="48h">48 hours before event</SelectItem>
                        <SelectItem value="1w">1 week before event</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Multiple Sign-ups</Label>
                      <p className="text-sm text-muted-foreground">Allow volunteers to sign up for multiple slots per event</p>
                    </div>
                    <Switch />
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Approval</Label>
                      <p className="text-sm text-muted-foreground">Volunteer sign-ups require admin approval</p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Volunteer Notifications</CardTitle>
                <CardDescription>Configure volunteer notification settings</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Sign-up Confirmation</Label>
                      <p className="text-sm text-muted-foreground">Send confirmation email when volunteer signs up</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Event Reminders</Label>
                      <p className="text-sm text-muted-foreground">Send reminder emails before volunteer shifts</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Cancellation Notifications</Label>
                      <p className="text-sm text-muted-foreground">Notify admins when volunteers cancel</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button>Save Changes</Button>
            </div>
          </div>
        )}

        {/* Childcare Settings */}
        {mainTab === "Childcare Settings" && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Childcare Defaults</CardTitle>
                <CardDescription>Configure default settings for childcare services</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="default-capacity">Default Capacity</Label>
                    <Input id="default-capacity" type="number" defaultValue="20" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="age-range">Default Age Range</Label>
                    <Select defaultValue="0-10">
                      <SelectTrigger id="age-range">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0-2">0-2 years</SelectItem>
                        <SelectItem value="3-5">3-5 years</SelectItem>
                        <SelectItem value="6-10">6-10 years</SelectItem>
                        <SelectItem value="0-10">All ages (0-10)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="staff-ratio">Staff-to-Child Ratio</Label>
                    <Select defaultValue="1:5">
                      <SelectTrigger id="staff-ratio">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1:3">1:3</SelectItem>
                        <SelectItem value="1:4">1:4</SelectItem>
                        <SelectItem value="1:5">1:5</SelectItem>
                        <SelectItem value="1:6">1:6</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="registration-deadline">Registration Deadline</Label>
                    <Select defaultValue="24h">
                      <SelectTrigger id="registration-deadline">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No deadline</SelectItem>
                        <SelectItem value="24h">24 hours before</SelectItem>
                        <SelectItem value="48h">48 hours before</SelectItem>
                        <SelectItem value="1w">1 week before</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Emergency Contact</Label>
                      <p className="text-sm text-muted-foreground">Require emergency contact information for all children</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Collect Allergy Information</Label>
                      <p className="text-sm text-muted-foreground">Ask for allergy and dietary information during registration</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Childcare Notifications</CardTitle>
                <CardDescription>Configure notification settings for childcare services</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Registration Confirmation</Label>
                      <p className="text-sm text-muted-foreground">Send confirmation when child is registered</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Capacity Alerts</Label>
                      <p className="text-sm text-muted-foreground">Notify staff when capacity is nearly full</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Event Reminders</Label>
                      <p className="text-sm text-muted-foreground">Send reminder to parents before events</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button>Save Changes</Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Event Type Dialog */}
      <Dialog open={showAddTypeDialog || !!editingType} onOpenChange={(open) => { if (!open) { setShowAddTypeDialog(false); setEditingType(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Event Type" : "Add Event Type"}</DialogTitle>
            <DialogDescription>Configure the event type details</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="type-name">Name</Label>
              <Input id="type-name" defaultValue={editingType?.name || ""} placeholder="Enter type name" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="type-color">Color</Label>
              <Input id="type-color" type="color" defaultValue={editingType?.color || "#10B981"} className="h-10 w-20" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="type-description">Description</Label>
              <Textarea id="type-description" defaultValue={editingType?.description || ""} placeholder="Describe this event type" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddTypeDialog(false); setEditingType(null); }}>Cancel</Button>
            <Button onClick={() => { setShowAddTypeDialog(false); setEditingType(null); }}>{editingType ? "Save Changes" : "Add Type"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
