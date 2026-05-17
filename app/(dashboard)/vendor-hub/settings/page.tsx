"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Store,
  Mail,
  Globe,
  FileText,
  DollarSign,
  Settings,
  Bell,
  Tags,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react"

type BoothType = {
  id: string
  event_id: string | null
  name: string
  size: string | null
  price: number | null
  color: string | null
  description: string | null
  is_active: boolean | null
  sort_order: number | null
  capacity: number | null
  location: string | null
}

type VendorHubEvent = {
  id: string
  name: string
}

type BoothTypeForm = {
  name: string
  size: string
  price: string
  color: string
  description: string
  is_active: string
  sort_order: string
  capacity: string
  location: string
}

const emptyBoothTypeForm: BoothTypeForm = {
  name: "",
  size: "",
  price: "",
  color: "#2563eb",
  description: "",
  is_active: "true",
  sort_order: "0",
  capacity: "",
  location: "",
}

export default function VendorHubSettingsPage() {
  const supabase = createClient()

  const [emailNotifications, setEmailNotifications] = useState(false)
  const [autoApproveVendors, setAutoApproveVendors] = useState(false)
  const [publicApplications, setPublicApplications] = useState(false)
  const [requireDeposit, setRequireDeposit] = useState(false)

  const [boothTypes, setBoothTypes] = useState<BoothType[]>([])
  const [events, setEvents] = useState<VendorHubEvent[]>([])
const [selectedEventId, setSelectedEventId] = useState("")
  const [boothTypeDialogOpen, setBoothTypeDialogOpen] = useState(false)
  const [editingBoothType, setEditingBoothType] = useState<BoothType | null>(null)
  const [boothTypeForm, setBoothTypeForm] = useState<BoothTypeForm>(emptyBoothTypeForm)
  const [savingBoothType, setSavingBoothType] = useState(false)
  const [loadingBoothTypes, setLoadingBoothTypes] = useState(false)

  useEffect(() => {
  loadEvents()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])

useEffect(() => {
  if (selectedEventId) {
    loadBoothTypes(selectedEventId)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedEventId])
async function loadEvents() {
  const { data, error } = await supabase
    .from("vendor_hub_events")
    .select("id, name")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error loading events:", error)
    setEvents([])
    return
  }

  const eventData = data ?? []
  setEvents(eventData)

  if (eventData.length > 0) {
    setSelectedEventId(eventData[0].id)
  }
}
  async function loadBoothTypes(eventId: string) {
  setLoadingBoothTypes(true)

  const { data, error } = await supabase
    .from("vendor_hub_booth_types")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error loading booth types:", error)
    setBoothTypes([])
  } else {
    setBoothTypes(data ?? [])
  }

  setLoadingBoothTypes(false)
}

  function startAddBoothType() {
    setEditingBoothType(null)
    setBoothTypeForm(emptyBoothTypeForm)
    setBoothTypeDialogOpen(true)
  }

  function startEditBoothType(type: BoothType) {
    setEditingBoothType(type)
    setBoothTypeForm({
      name: type.name ?? "",
      size: type.size ?? "",
      price: type.price === null || type.price === undefined ? "" : String(type.price),
      color: type.color ?? "#2563eb",
      capacity: String(type.capacity ?? ""),
location: type.location ?? "",
      description: type.description ?? "",
      is_active: type.is_active === false ? "false" : "true",
      sort_order: String(type.sort_order ?? 0),
    })
    setBoothTypeDialogOpen(true)
  }

  async function saveBoothType() {
    if (!selectedEventId) {
  alert("Please select an event first.")
  return
}
    if (!boothTypeForm.name.trim()) {
      alert("Please enter a booth type name.")
      return
    }

    setSavingBoothType(true)

    const payload = {
  event_id: selectedEventId,
  name: boothTypeForm.name.trim(),
  size: boothTypeForm.size.trim() || null,
  price: boothTypeForm.price ? Number(boothTypeForm.price) : 0,
  color: boothTypeForm.color || "#2563eb",
  description: boothTypeForm.description.trim() || null,
  is_active: boothTypeForm.is_active === "true",
  sort_order: Number(boothTypeForm.sort_order || 0),
  capacity: boothTypeForm.capacity ? Number(boothTypeForm.capacity) : 0,
  location: boothTypeForm.location.trim() || null,
  updated_at: new Date().toISOString(),
}

    if (editingBoothType) {
      const { error } = await supabase
        .from("vendor_hub_booth_types")
        .update(payload)
        .eq("id", editingBoothType.id)

      if (error) {
        console.error("Error updating booth type:", error)
        alert("Booth type could not be updated.")
        setSavingBoothType(false)
        return
      }
    } else {
      const { error } = await supabase
        .from("vendor_hub_booth_types")
        .insert(payload)

      if (error) {
        console.error("Error adding booth type:", error)
        alert("Booth type could not be added.")
        setSavingBoothType(false)
        return
      }
    }

    await loadBoothTypes(selectedEventId)
    setSavingBoothType(false)
    setBoothTypeDialogOpen(false)
    setEditingBoothType(null)
    setBoothTypeForm(emptyBoothTypeForm)
  }

  async function deleteBoothType(id: string) {
    const confirmed = window.confirm("Delete this booth type? This cannot be undone.")
    if (!confirmed) return

    const { error } = await supabase
      .from("vendor_hub_booth_types")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting booth type:", error)
      alert("Booth type could not be deleted.")
      return
    }

    if (selectedEventId) {
  await loadBoothTypes(selectedEventId)
}
  }

  return (
    <>
      <Header title="Vendor Hub Settings" />

      <div className="p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage Vendor Hub preferences, applications, payments, notifications, booth settings, and vendor types.
            </p>
          </div>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="flex h-auto flex-wrap justify-start gap-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="booths">Booths</TabsTrigger>
              <TabsTrigger value="applications">Applications</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="email">Email Templates</TabsTrigger>
              <TabsTrigger value="public">Public Page</TabsTrigger>
              <TabsTrigger value="vendor-types">Vendor Types</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Settings className="h-5 w-5" />
                    General Settings
                  </CardTitle>
                  <CardDescription>Configure basic Vendor Hub defaults.</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="default-name">Default Vendor Event Name</Label>
                    <Input id="default-name" placeholder="Enter default event name" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="default-start">Default Start Time</Label>
                      <Input id="default-start" type="time" />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="default-end">Default End Time</Label>
                      <Input id="default-end" type="time" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="default-location">Default Location</Label>
                    <Input id="default-location" placeholder="Enter default location" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="booths" className="mt-6">
              <div className="flex flex-col gap-6">
                <Card>
  <CardHeader>
    <CardTitle className="text-base">Select Event</CardTitle>
    <CardDescription>
      Booth types are configured per event.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <Select value={selectedEventId} onValueChange={setSelectedEventId}>
      <SelectTrigger className="w-full sm:w-[320px]">
        <SelectValue placeholder="Select event" />
      </SelectTrigger>
      <SelectContent>
        {events.map((event) => (
          <SelectItem key={event.id} value={event.id}>
            {event.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </CardContent>
</Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Store className="h-5 w-5" />
                      Booth Settings
                    </CardTitle>
                    <CardDescription>
                      Configure booth pricing, deposits, limits, and booth types.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="booth-base-price">Base Booth Price</Label>
                        <Input id="booth-base-price" type="number" placeholder="Enter base price" />
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label htmlFor="booth-deposit">Deposit Amount</Label>
                        <Input id="booth-deposit" type="number" placeholder="Enter deposit amount" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Require Deposit</p>
                        <p className="text-sm text-muted-foreground">
                          Vendors must pay a deposit to secure their booth.
                        </p>
                      </div>
                      <Switch checked={requireDeposit} onCheckedChange={setRequireDeposit} />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="max-booths">Maximum Booths Per Vendor</Label>
                      <Select>
                        <SelectTrigger id="max-booths">
                          <SelectValue placeholder="Select booth limit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 booth</SelectItem>
                          <SelectItem value="2">2 booths</SelectItem>
                          <SelectItem value="3">3 booths</SelectItem>
                          <SelectItem value="unlimited">Unlimited</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Tags className="h-5 w-5" />
                        Booth Types
                      </CardTitle>
                      <CardDescription>
                        Configure booth type names, sizes, colors, pricing, and visibility.
                      </CardDescription>
                    </div>

                    <Button onClick={startAddBoothType}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Booth Type
                    </Button>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-3">
                    {loadingBoothTypes ? (
                      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                        Loading booth types...
                      </div>
                    ) : boothTypes.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                        No booth types configured yet.
                      </div>
                    ) : (
                      boothTypes.map((type) => (
                        <div
                          key={type.id}
                          className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="mt-1 h-5 w-5 rounded-full border"
                              style={{ backgroundColor: type.color ?? "#2563eb" }}
                            />

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">{type.name}</p>
                                <Badge variant={type.is_active === false ? "secondary" : "default"}>
                                  {type.is_active === false ? "Hidden" : "Active"}
                                </Badge>
                              </div>

                              <p className="text-sm text-muted-foreground">
                                {type.size || "No size"} · ${type.price ?? 0}
                              </p>

                              {type.description && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {type.description}
                                </p>
                              )}

                              <p className="mt-1 text-xs text-muted-foreground">
                                Sort order: {type.sort_order ?? 0}
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => startEditBoothType(type)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>

                            <Button variant="outline" size="sm" onClick={() => deleteBoothType(type.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="applications" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-5 w-5" />
                    Vendor Applications
                  </CardTitle>
                  <CardDescription>Configure vendor application process and requirements.</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Public Applications</p>
                      <p className="text-sm text-muted-foreground">
                        Allow vendors to apply through a public form.
                      </p>
                    </div>
                    <Switch checked={publicApplications} onCheckedChange={setPublicApplications} />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Auto-Approve Returning Vendors</p>
                      <p className="text-sm text-muted-foreground">
                        Automatically approve returning vendors.
                      </p>
                    </div>
                    <Switch checked={autoApproveVendors} onCheckedChange={setAutoApproveVendors} />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="application-deadline">Application Deadline</Label>
                    <Select>
                      <SelectTrigger id="application-deadline">
                        <SelectValue placeholder="Select deadline" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 days before event</SelectItem>
                        <SelectItem value="14">14 days before event</SelectItem>
                        <SelectItem value="21">21 days before event</SelectItem>
                        <SelectItem value="30">30 days before event</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="required-docs">Required Documents</Label>
                    <Textarea id="required-docs" placeholder="Enter required documents" rows={2} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DollarSign className="h-5 w-5" />
                    Payment Settings
                  </CardTitle>
                  <CardDescription>Configure payment options and policies.</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="payment-methods">Accepted Payment Methods</Label>
                    <Select>
                      <SelectTrigger id="payment-methods">
                        <SelectValue placeholder="Select payment methods" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Payment Methods</SelectItem>
                        <SelectItem value="card">Credit Card Only</SelectItem>
                        <SelectItem value="card-cash">Credit Card & Cash</SelectItem>
                        <SelectItem value="cash-check">Cash & Check</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="refund-policy">Refund Policy</Label>
                    <Select>
                      <SelectTrigger id="refund-policy">
                        <SelectValue placeholder="Select refund policy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">Full refund up to 7 days before</SelectItem>
                        <SelectItem value="14">Full refund up to 14 days before</SelectItem>
                        <SelectItem value="30">Full refund up to 30 days before</SelectItem>
                        <SelectItem value="none">No refunds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cancellation-fee">Late Cancellation Fee</Label>
                    <Input id="cancellation-fee" type="number" placeholder="Enter cancellation fee" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Bell className="h-5 w-5" />
                    Notifications
                  </CardTitle>
                  <CardDescription>Configure email notifications.</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Send email updates to vendors.
                      </p>
                    </div>
                    <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="reminder-days">Reminder Email Schedule</Label>
                    <Select>
                      <SelectTrigger id="reminder-days">
                        <SelectValue placeholder="Select reminder schedule" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7-3-1">7 days, 3 days, 1 day before</SelectItem>
                        <SelectItem value="7-1">7 days, 1 day before</SelectItem>
                        <SelectItem value="3-1">3 days, 1 day before</SelectItem>
                        <SelectItem value="1">1 day before only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="email" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Mail className="h-5 w-5" />
                    Email Templates
                  </CardTitle>
                  <CardDescription>Customize vendor communication templates.</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="approval-subject">Approval Email Subject</Label>
                    <Input id="approval-subject" placeholder="Enter approval email subject" />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="approval-body">Approval Email Body</Label>
                    <Textarea id="approval-body" placeholder="Enter approval email body" rows={6} />
                  </div>

                  <Button variant="outline" className="w-fit">
                    Edit More Templates
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="public" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Globe className="h-5 w-5" />
                    Public Page
                  </CardTitle>
                  <CardDescription>Configure the public-facing Vendor Hub page.</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="public-description">Public Description</Label>
                    <Textarea id="public-description" placeholder="Enter public-facing description" rows={3} />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="contact-email">Public Contact Email</Label>
                    <Input id="contact-email" type="email" placeholder="Enter public contact email" />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="contact-phone">Public Contact Phone</Label>
                    <Input id="contact-phone" placeholder="Enter public contact phone" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="vendor-types" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tags className="h-5 w-5" />
                    Vendor Types
                  </CardTitle>
                  <CardDescription>
                    Vendor type database connection can be restored here later if needed.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No vendor types configured here yet.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={boothTypeDialogOpen} onOpenChange={setBoothTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBoothType ? "Edit Booth Type" : "Add Booth Type"}</DialogTitle>
            <DialogDescription>
              Configure booth type name, size, price, color, visibility, and sort order.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input
                value={boothTypeForm.name}
                onChange={(event) => setBoothTypeForm({ ...boothTypeForm, name: event.target.value })}
                placeholder="Example: Standard Booth"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Size</Label>
                <Input
                  value={boothTypeForm.size}
                  onChange={(event) => setBoothTypeForm({ ...boothTypeForm, size: event.target.value })}
                  placeholder="Example: 10x10 ft"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  value={boothTypeForm.price}
                  onChange={(event) => setBoothTypeForm({ ...boothTypeForm, price: event.target.value })}
                  placeholder="Example: 100"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Color</Label>
              <Input
                type="color"
                value={boothTypeForm.color}
                onChange={(event) => setBoothTypeForm({ ...boothTypeForm, color: event.target.value })}
                className="h-10 w-20 cursor-pointer p-1"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
  <div className="flex flex-col gap-2">
    <Label>Capacity</Label>
    <Input
      type="number"
      value={boothTypeForm.capacity}
      onChange={(event) =>
        setBoothTypeForm({ ...boothTypeForm, capacity: event.target.value })
      }
      placeholder="Example: 15"
    />
  </div>

  <div className="flex flex-col gap-2">
    <Label>Location</Label>
    <Input
      value={boothTypeForm.location}
      onChange={(event) =>
        setBoothTypeForm({ ...boothTypeForm, location: event.target.value })
      }
      placeholder="Example: Main Hall"
    />
  </div>
</div>
            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea
                value={boothTypeForm.description}
                onChange={(event) => setBoothTypeForm({ ...boothTypeForm, description: event.target.value })}
                placeholder="Describe this booth type..."
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  value={boothTypeForm.is_active}
                  onValueChange={(value) => setBoothTypeForm({ ...boothTypeForm, is_active: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={boothTypeForm.sort_order}
                  onChange={(event) => setBoothTypeForm({ ...boothTypeForm, sort_order: event.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button onClick={saveBoothType} disabled={savingBoothType}>
                {savingBoothType
                  ? "Saving..."
                  : editingBoothType
                    ? "Save Booth Type"
                    : "Add Booth Type"}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setBoothTypeDialogOpen(false)
                  setEditingBoothType(null)
                  setBoothTypeForm(emptyBoothTypeForm)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}