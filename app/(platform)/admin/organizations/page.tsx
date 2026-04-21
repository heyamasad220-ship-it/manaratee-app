"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { PlatformHeader } from "@/components/platform/platform-header"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  MoreHorizontal,
  Plus,
  Building2,
  CreditCard,
  Settings,
  Boxes,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const filterTabs = ["All", "Active", "Suspended", "Pending"] as const

interface Organization {
  id: string
  name: string
  status: "Active" | "Suspended" | "Pending"
  members: number
  created: string
  mrr: number
  contactEmail: string
}

interface ModuleConfig {
  id: string
  name: string
  slug: string
  description: string
  enabled: boolean
  isDefault: boolean
}

const defaultModules: ModuleConfig[] = [
  {
    id: "mod-1",
    name: "Bookings",
    slug: "bookings",
    description: "Space and venue bookings",
    enabled: true,
    isDefault: true,
  },
  {
    id: "mod-2",
    name: "Ticketing",
    slug: "ticketing",
    description: "Event ticketing and sales",
    enabled: true,
    isDefault: true,
  },
  {
    id: "mod-3",
    name: "Bazaar",
    slug: "bazaar",
    description: "Bazaar and vendor management",
    enabled: false,
    isDefault: false,
  },
  {
    id: "mod-4",
    name: "Programs",
    slug: "programs",
    description: "Educational programs and classes",
    enabled: true,
    isDefault: true,
  },
  {
    id: "mod-5",
    name: "Donations",
    slug: "donations",
    description: "Donation and fundraising",
    enabled: false,
    isDefault: false,
  },
  {
    id: "mod-6",
    name: "Contacts",
    slug: "contacts",
    description: "Contact and CRM management",
    enabled: true,
    isDefault: true,
  },
  {
    id: "mod-7",
    name: "Human Resources",
    slug: "hr",
    description: "HR and employee management",
    enabled: false,
    isDefault: false,
  },
]

const statusStyles: Record<Organization["status"], string> = {
  Active: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Suspended: "bg-red-100 text-red-700 hover:bg-red-100",
  Pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

function formatDate(value: string | null) {
  if (!value) return "—"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
function toDbStatus(status: "Active" | "Pending" | "Suspended") {
  return status.toLowerCase()
}
export default function OrganizationsPage() {
  const supabase = createClient()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] =
    useState<(typeof filterTabs)[number]>("All")
  const [addOrgOpen, setAddOrgOpen] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [orgModules, setOrgModules] = useState<ModuleConfig[]>(defaultModules)

  const [newOrgName, setNewOrgName] = useState("")
  const [newOrgEmail, setNewOrgEmail] = useState("")
  const [newOrgStatus, setNewOrgStatus] = useState<"Active" | "Pending">("Pending")
  const [saving, setSaving] = useState(false)
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null)

  const fetchOrgs = async () => {
  setLoading(true)

  const response = await fetch("/api/platform/organizations")
  const result = await response.json()

  console.log("PLATFORM ORGS API RESULT:", result)

  if (!response.ok) {
    alert(result.error || "Failed to load organizations")
    setLoading(false)
    return
  }

  const mapped: Organization[] = (result.organizations || []).map((org: any) => ({
    id: org.id,
    name: org.name ?? "Unnamed Organization",
    status:
      org.status === "suspended"
        ? "Suspended"
        : org.status === "pending"
        ? "Pending"
        : "Active",
    members: org.members ?? 0,
    created: formatDate(org.created_at),
    mrr: org.mrr ?? 0,
    contactEmail: org.contact_email ?? org.contactEmail ?? "",
  }))

  setOrganizations(mapped)
  setLoading(false)
}
  useEffect(() => {
    fetchOrgs()
  }, [])

  const filtered = useMemo(() => {
    let result = organizations

    if (activeFilter !== "All") {
      result = result.filter((o) => o.status === activeFilter)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.contactEmail.toLowerCase().includes(q)
      )
    }

    return result
  }, [organizations, search, activeFilter])

  const handleOrgClick = (org: Organization) => {
    setSelectedOrg(org)
    setOrgModules(defaultModules.map((m) => ({ ...m })))
  }

  const handleEditClick = (org: Organization) => {
    setEditingOrgId(org.id)
    setNewOrgName(org.name)
    setNewOrgEmail(org.contactEmail || "")
    setNewOrgStatus(org.status === "Suspended" ? "Pending" : org.status)
    setAddOrgOpen(true)
  }

  const toggleModule = (moduleId: string) => {
    setOrgModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, enabled: !m.enabled } : m))
    )
  }

  const resetAddForm = () => {
    setNewOrgName("")
    setNewOrgEmail("")
    setNewOrgStatus("Pending")
    setEditingOrgId(null)
  }
  const updateOrganizationStatus = async (
  orgId: string,
  status: "Active" | "Pending" | "Suspended"
  ) => {
  const { error } = await supabase
    .from("organizations")
    .update({ status: toDbStatus(status) })
    .eq("id", orgId)

  console.log("STATUS UPDATE ERROR:", error)

  if (error) {
    alert(error.message)
    return
  }

  fetchOrgs()
  }
  const handleAddOrganization = async () => {
  if (!newOrgName.trim()) {
    alert("Organization name is required.")
    return
  }

  setSaving(true)

  try {
    if (editingOrgId) {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: newOrgName.trim(),
          status: toDbStatus(newOrgStatus),
          contact_email: newOrgEmail.trim() || null,
        })
        .eq("id", editingOrgId)

      console.log("UPDATE ERROR:", error)

      if (error) {
        alert(error.message)
        return
      }

      resetAddForm()
      setAddOrgOpen(false)
      fetchOrgs()
      return
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    const user = userData?.user

    if (userError || !user) {
      alert(userError?.message || "No logged-in user found.")
      return
    }

    const response = await fetch("/api/organizations/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    userId: user.id,
    name: newOrgName,
    contact_email: newOrgEmail,
    status: newOrgStatus.toLowerCase(),
  }),
})

const result = await response.json()
console.log("CREATE ORG RESULT:", result)
console.log("CREATE ORG STATUS:", response.status)
console.log("CREATE ORG OK:", response.ok)

if (!response.ok) {
  throw new Error(result.error || "Failed to create organization")
}

if (!result.organization) {
  throw new Error("No organization returned from API")
}

    resetAddForm()
    setAddOrgOpen(false)
    fetchOrgs()
  } catch (error: any) {
    console.error("SAVE ERROR:", error)
    alert(error?.message || "Something went wrong while saving.")
  } finally {
    setSaving(false)
  }
}

  return (
    <>
      <PlatformHeader title="Organizations" />

      <div className="flex flex-col gap-5 p-6">
        <Card className="border border-border shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="relative w-[280px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search organizations..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 pl-9"
                  />
                </div>

                <div className="flex gap-0 overflow-hidden rounded-lg border border-border">
                  {filterTabs.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveFilter(tab)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium transition-colors",
                        activeFilter === tab
                          ? "bg-foreground text-background"
                          : "bg-card text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => {
                  resetAddForm()
                  setAddOrgOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
                Add Organization
              </Button>
            </div>

            <div className="flex items-center gap-4 border-b border-border bg-muted/30 px-5 py-2.5 text-xs">
              <span className="text-muted-foreground">
                Showing {filtered.length} of {organizations.length} organizations
              </span>
              <span className="font-medium text-foreground">
                Total MRR: $
                {organizations
                  .reduce((sum, org) => sum + org.mrr, 0)
                  .toLocaleString("en-US")}
              </span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium text-muted-foreground">
                    Organization
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground">
                    Members
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground">
                    Created
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground">
                    MRR
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Loading organizations...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No organizations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((org) => (
                    <TableRow
                      key={org.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOrgClick(org)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{org.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {org.contactEmail || "—"}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusStyles[org.status]}
                        >
                          {org.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {org.members}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {org.created}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        ${org.mrr.toLocaleString("en-US")}
                      </TableCell>

                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOrgClick(org)}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditClick(org)}>
                              Edit
                            </DropdownMenuItem>

                            {org.status === "Active" && (
  <DropdownMenuItem
    className="text-destructive"
    onClick={() => updateOrganizationStatus(org.id, "Suspended")}
  >
    Suspend
  </DropdownMenuItem>
)}

{org.status === "Suspended" && (
  <DropdownMenuItem
    onClick={() => updateOrganizationStatus(org.id, "Active")}
  >
    Activate
  </DropdownMenuItem>
)}

{org.status === "Pending" && (
  <DropdownMenuItem
    onClick={() => updateOrganizationStatus(org.id, "Active")}
  >
    Approve
  </DropdownMenuItem>
)}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Sheet
        open={!!selectedOrg}
        onOpenChange={(open) => !open && setSelectedOrg(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-[600px]">
          <SheetHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <Building2 className="h-5 w-5 text-emerald-600" />
                </div>

                <div>
                  <SheetTitle className="text-lg">{selectedOrg?.name}</SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrg?.contactEmail || "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedOrg && (
                  <Badge
                    variant="secondary"
                    className={statusStyles[selectedOrg.status]}
                  >
                    {selectedOrg.status}
                  </Badge>
                )}
              </div>
            </div>
          </SheetHeader>

          <Tabs defaultValue="overview" className="mt-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" className="gap-1.5">
                <Building2 className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="modules" className="gap-1.5">
                <Boxes className="h-4 w-4" />
                Modules
              </TabsTrigger>
              <TabsTrigger value="billing" className="gap-1.5">
                <CreditCard className="h-4 w-4" />
                Billing
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Members</p>
                    <p className="text-2xl font-semibold">{selectedOrg?.members}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                    <p className="text-2xl font-semibold">${selectedOrg?.mrr}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Organization ID
                    </span>
                    <span className="text-sm font-mono">{selectedOrg?.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Created</span>
                    <span className="text-sm">{selectedOrg?.created}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span className="text-sm">{selectedOrg?.status}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="modules" className="mt-6 space-y-4">
              <div>
                <h3 className="font-medium">Module Access</h3>
                <p className="text-sm text-muted-foreground">
                  Enable or disable modules for this organization
                </p>
              </div>

              <Card>
                <CardContent className="divide-y p-0">
                  {orgModules.map((module) => (
                    <div
                      key={module.id}
                      className="flex items-center justify-between p-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{module.name}</p>
                          {module.isDefault && (
                            <Badge variant="outline" className="text-xs">
                              Plan Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {module.description}
                        </p>
                      </div>

                      <Switch
                        checked={module.enabled}
                        onCheckedChange={() => toggleModule(module.id)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground">
                Modules marked as &quot;Plan Default&quot; are included in the
                organization&apos;s current plan. You can override these settings
                for this specific organization.
              </p>
            </TabsContent>

            <TabsContent value="billing" className="mt-6 space-y-4">
              <Card>
                <CardContent className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Current Plan</p>
                      <p className="text-sm text-muted-foreground">Not set yet</p>
                    </div>
                    <Button variant="outline" size="sm">
                      Change Plan
                    </Button>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Monthly Revenue
                      </span>
                      <span className="text-sm font-medium">
                        ${selectedOrg?.mrr}/mo
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <h4 className="mb-3 font-medium">Recent Invoices</h4>
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    No invoices yet
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="mt-6 space-y-4">
              <Card>
                <CardContent className="space-y-4 pt-4">
                  <div className="flex flex-col gap-2">
                    <Label>Organization Name</Label>
                    <Input defaultValue={selectedOrg?.name} />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Contact Email</Label>
                    <Input defaultValue={selectedOrg?.contactEmail} />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Status</Label>
                    <Select defaultValue={selectedOrg?.status.toLowerCase()}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setSelectedOrg(null)}>
                  Cancel
                </Button>
              </div>

              <Card className="border-red-200">
                <CardContent className="pt-4">
                  <h4 className="mb-2 font-medium text-red-600">Danger Zone</h4>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Permanently delete this organization and all its data.
                  </p>
                  <Button variant="destructive" size="sm">
                    Delete Organization
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <Dialog open={addOrgOpen} onOpenChange={setAddOrgOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingOrgId ? "Edit Organization" : "Add Organization"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="e.g. Al-Noor Community Center"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="org-email">Contact Email</Label>
              <Input
                id="org-email"
                type="email"
                placeholder="admin@organization.org"
                value={newOrgEmail}
                onChange={(e) => setNewOrgEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-status">Status</Label>
                <Select
                  value={newOrgStatus}
                  onValueChange={(value: "Active" | "Pending") =>
                    setNewOrgStatus(value)
                  }
                >
                  <SelectTrigger id="org-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddOrgOpen(false)
                resetAddForm()
              }}
            >
              Cancel
            </Button>

            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleAddOrganization}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingOrgId
                ? "Save Changes"
                : "Add Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}