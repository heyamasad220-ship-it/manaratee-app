"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
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
  Store,
  Users,
  LayoutGrid,
  List,
  UserPlus,
  Ban,
  ArrowRightLeft,
  CheckCircle2,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

type BoothType = {
  id: string
  name: string
  size: string | null
  price: number | null
  color: string | null
  is_active: boolean | null
}

type Booth = {
  id: string
  booth_type_id: string | null
  number: string
  location: string | null
  status: "available" | "reserved" | "assigned" | "blocked"
  vendor_name: string | null
  notes: string | null
}

const statusConfig = {
  available: { label: "Available", color: "border-blue-200 bg-blue-50 text-blue-700" },
  reserved: { label: "Reserved", color: "border-amber-200 bg-amber-50 text-amber-700" },
  assigned: { label: "Assigned", color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  blocked: { label: "Blocked", color: "border-red-200 bg-red-50 text-red-700" },
}

type TabType = "booths" | "map"

export default function BoothsPage() {
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<TabType>("booths")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [showAddBoothDialog, setShowAddBoothDialog] = useState(false)

  const [boothTypes, setBoothTypes] = useState<BoothType[]>([])
  const [booths, setBooths] = useState<Booth[]>([])
  const [loading, setLoading] = useState(false)
  const [savingBooth, setSavingBooth] = useState(false)
  const [editingBooth, setEditingBooth] = useState<Booth | null>(null)

  const [boothNumber, setBoothNumber] = useState("")
  const [boothTypeId, setBoothTypeId] = useState("")
  const [boothLocation, setBoothLocation] = useState("")
  const [boothNotes, setBoothNotes] = useState("")

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    setLoading(true)

    const [{ data: typeData, error: typeError }, { data: boothData, error: boothError }] =
      await Promise.all([
        supabase
          .from("vendor_hub_booth_types")
          .select("id, name, size, price, color, is_active")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),

        supabase
          .from("vendor_hub_booths")
          .select("*")
          .order("number", { ascending: true }),
      ])

    if (typeError) {
      console.error("Error loading booth types:", typeError)
      setBoothTypes([])
    } else {
      setBoothTypes(typeData ?? [])
    }

    if (boothError) {
      console.error("Error loading booths:", boothError)
      setBooths([])
    } else {
      setBooths((boothData ?? []) as Booth[])
    }

    setLoading(false)
  }

  function resetBoothForm() {
    setBoothNumber("")
    setBoothTypeId("")
    setBoothLocation("")
    setBoothNotes("")
  }

  function startEditBooth(booth: Booth) {
  setEditingBooth(booth)
  setBoothNumber(booth.number)
  setBoothTypeId(booth.booth_type_id || "")
  setBoothLocation(booth.location || "")
  setBoothNotes(booth.notes || "")
  setShowAddBoothDialog(true)
}

  async function saveBooth() {
  if (!boothNumber.trim()) {
    alert("Please enter a booth number.")
    return
  }

  setSavingBooth(true)

  const payload = {
    number: boothNumber.trim(),
    booth_type_id: boothTypeId || null,
    location: boothLocation.trim() || null,
    notes: boothNotes.trim() || null,
    updated_at: new Date().toISOString(),
  }

  if (editingBooth) {
    const { error } = await supabase
      .from("vendor_hub_booths")
      .update(payload)
      .eq("id", editingBooth.id)

    if (error) {
      console.error("Error updating booth:", error)
      alert("Booth could not be updated.")
      setSavingBooth(false)
      return
    }
  } else {
    const { error } = await supabase.from("vendor_hub_booths").insert({
      ...payload,
      status: "available",
      vendor_name: null,
    })

    if (error) {
      console.error("Error adding booth:", error)
      alert("Booth could not be added.")
      setSavingBooth(false)
      return
    }
  }

  await loadData()
  resetBoothForm()
  setEditingBooth(null)
  setShowAddBoothDialog(false)
  setSavingBooth(false)
}

  async function updateBoothStatus(id: string, status: Booth["status"]) {
    const { error } = await supabase
      .from("vendor_hub_booths")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      console.error("Error updating booth status:", error)
      alert("Booth status could not be updated.")
      return
    }

    await loadData()
  }

  async function deleteBooth(id: string) {
    const confirmed = window.confirm("Delete this booth? This cannot be undone.")
    if (!confirmed) return

    const { error } = await supabase
      .from("vendor_hub_booths")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting booth:", error)
      alert("Booth could not be deleted.")
      return
    }

    await loadData()
  }

  function getBoothType(typeId: string | null) {
    return boothTypes.find((type) => type.id === typeId) || null
  }

  const filteredBooths = booths.filter((booth) => {
    const boothType = getBoothType(booth.booth_type_id)

    const matchesSearch =
      booth.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (booth.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (booth.location?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)

    const matchesStatus = statusFilter === "all" || booth.status === statusFilter
    const matchesType = typeFilter === "all" || booth.booth_type_id === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  const stats = {
    total: booths.length,
    assigned: booths.filter((booth) => booth.status === "assigned").length,
    available: booths.filter((booth) => booth.status === "available").length,
    reserved: booths.filter((booth) => booth.status === "reserved").length,
    blocked: booths.filter((booth) => booth.status === "blocked").length,
  }

  return (
    <>
      <Header title="Booth Management" />

      <div className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Booths</h1>
              <p className="text-sm text-muted-foreground">
                Manage booth inventory, assignments, availability, and layout.
              </p>
            </div>

            <Link href="/vendor-hub/settings">
              <Button variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Booth Settings
              </Button>
            </Link>
          </div>

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
          </div>

          {activeTab === "booths" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search booths, vendors, or locations..."
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
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
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Booth Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {boothTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
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
                        <TableHead className="w-[80px]" />
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                            Loading booths...
                          </TableCell>
                        </TableRow>
                      ) : filteredBooths.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                            No booths found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredBooths.map((booth) => {
                          const boothType = getBoothType(booth.booth_type_id)
                          const status = statusConfig[booth.status] ?? statusConfig.available

                          return (
                            <TableRow key={booth.id}>
                              <TableCell className="font-medium">{booth.number}</TableCell>

                              <TableCell>
                                {boothType ? (
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="h-3 w-3 rounded-full border"
                                      style={{ backgroundColor: boothType.color ?? "#2563eb" }}
                                    />
                                    <span>{boothType.name}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">No type</span>
                                )}
                              </TableCell>

                              <TableCell>
                                {booth.vendor_name ? (
                                  booth.vendor_name
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>

                              <TableCell className="text-muted-foreground">
                                {booth.location || "-"}
                              </TableCell>

                              <TableCell>
                                <Badge variant="outline" className={cn(status.color)}>
                                  {status.label}
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
                                    <DropdownMenuItem onClick={() => startEditBooth(booth)}>
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
                                      <DropdownMenuItem onClick={() => updateBoothStatus(booth.id, "blocked")}>
                                        <Ban className="mr-2 h-4 w-4" />
                                        Mark Unavailable
                                      </DropdownMenuItem>
                                    )}

                                    {booth.status === "blocked" && (
                                      <DropdownMenuItem onClick={() => updateBoothStatus(booth.id, "available")}>
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Mark Available
                                      </DropdownMenuItem>
                                    )}

                                    <DropdownMenuItem className="text-red-600" onClick={() => deleteBooth(booth.id)}>
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "map" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-4">
                {Object.entries(statusConfig).map(([key, config]) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className={cn("h-4 w-4 rounded border", config.color)} />
                    <span className="text-sm">{config.label}</span>
                  </div>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Booth Assignment Map</CardTitle>
                  <CardDescription>Visual overview of booth assignments by location</CardDescription>
                </CardHeader>

                <CardContent>
                  {booths.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      No booths have been added to the map yet.
                    </div>
                  ) : (
                    Array.from(new Set(booths.map((booth) => booth.location || "Unassigned Location"))).map(
                      (location) => (
                        <div key={location} className="mb-6 last:mb-0">
                          <h4 className="mb-3 text-sm font-medium text-muted-foreground">{location}</h4>

                          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
                            {booths
                              .filter((booth) => (booth.location || "Unassigned Location") === location)
                              .map((booth) => {
                                const boothType = getBoothType(booth.booth_type_id)

                                return (
                                  <div
                                    key={booth.id}
                                    className={cn(
                                      "flex h-16 cursor-pointer flex-col items-center justify-center rounded-lg border-2 p-1 transition-all hover:scale-105",
                                      statusConfig[booth.status]?.color ?? statusConfig.available.color
                                    )}
                                    title={`${booth.number} - ${booth.vendor_name || booth.status}`}
                                  >
                                    <span className="text-xs font-bold">{booth.number}</span>
                                    <span className="truncate text-[10px]" style={{ maxWidth: "100%" }}>
                                      {booth.vendor_name || boothType?.name || booth.status}
                                    </span>
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      )
                    )
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showAddBoothDialog} onOpenChange={setShowAddBoothDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBooth ? "Edit Booth" : "Add Booth"}</DialogTitle>
            <DialogDescription>Create a new booth for Vendor Hub.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {boothTypes.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No active booth types found. Add booth types in Settings first.
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="booth-number">Booth Number</Label>
                <Input
                  id="booth-number"
                  placeholder="e.g., A-01"
                  value={boothNumber}
                  onChange={(event) => setBoothNumber(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="booth-type">Booth Type</Label>
                <Select value={boothTypeId} onValueChange={setBoothTypeId}>
                  <SelectTrigger id="booth-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>

                  <SelectContent>
                    {boothTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                        {type.size ? ` (${type.size})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="booth-location">Location</Label>
              <Input
                id="booth-location"
                placeholder="e.g., Main Hall - Row A"
                value={boothLocation}
                onChange={(event) => setBoothLocation(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="booth-notes">Notes</Label>
              <Textarea
                id="booth-notes"
                placeholder="Any special notes about this booth..."
                rows={2}
                value={boothNotes}
                onChange={(event) => setBoothNotes(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
  resetBoothForm()
  setEditingBooth(null)
  setShowAddBoothDialog(false)
}}
            >
              Cancel
            </Button>

            <Button onClick={saveBooth} disabled={savingBooth}>
  {savingBooth
    ? editingBooth
      ? "Saving..."
      : "Adding..."
    : editingBooth
      ? "Save Booth"
      : "Add Booth"}
</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}