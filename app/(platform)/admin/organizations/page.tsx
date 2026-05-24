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
  Users,
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
  plan_id?: string | null
  plan_name?: string | null
}

interface Plan {
  id: string
  name: string
  monthly_price: number
}

interface ModuleConfig {
  id: string
  name: string
  slug: string
  description: string | null
  enabled: boolean
  isDefault: boolean
  organizationModuleId?: string
}

const statusStyles: Record<Organization["status"], string> = {
  Active: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Suspended: "bg-red-100 text-red-700 hover:bg-red-100",
  Pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
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
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] =
    useState<(typeof filterTabs)[number]>("All")
  const [addOrgOpen, setAddOrgOpen] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState("")
  const [orgModules, setOrgModules] = useState<ModuleConfig[]>([])

  const [newOrgName, setNewOrgName] = useState("")
  const [newOrgEmail, setNewOrgEmail] = useState("")
  const [newOrgStatus, setNewOrgStatus] = useState<"Active" | "Pending">(
    "Pending"
  )
  const [saving, setSaving] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null)

  useEffect(() => {
    fetchOrgs()
    loadPlans()
  }, [])

  const loadPlans = async () => {
    const { data, error } = await supabase
      .from("plans")
      .select("id, name, monthly_price")
      .eq("is_active", true)
      .order("monthly_price", { ascending: true })

    if (error) {
      console.error(error)
      alert("Failed to load plans.")
      return
    }

    setPlans((data || []).map((plan: any) => ({
      id: plan.id,
      name: plan.name,
      monthly_price: Number(plan.monthly_price || 0),
    })))
  }

  const fetchOrgs = async () => {
    setLoading(true)

    const response = await fetch("/api/platform/organizations")
    const result = await response.json()

    if (!response.ok) {
      alert(result.error || "Failed to load organizations")
      setLoading(false)
      return
    }

    const mapped: Organization[] = (result.organizations || []).map(
      (org: any) => ({
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
        plan_id: org.plan_id ?? null,
        plan_name: org.plan_name ?? org.plans?.name ?? null,
      })
    )

    setOrganizations(mapped)
    setLoading(false)
  }

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

  const handleOrgClick = async (org: Organization) => {
    setSelectedOrg(org)
    setSelectedPlanId(org.plan_id || "")

    const { data: orgData } = await supabase
      .from("organizations")
      .select("plan_id, plans(name)")
      .eq("id", org.id)
      .single()

    if (orgData) {
      const updatedOrg: Organization = {
        ...org,
        plan_id: orgData.plan_id,
        plan_name: (orgData as any).plans?.name ?? null,
      }

      setSelectedOrg(updatedOrg)
      setSelectedPlanId(orgData.plan_id || "")
    }

    const { data, error } = await supabase
      .from("organization_modules")
      .select(`
        id,
        enabled,
        enabled_by_plan,
        modules (
          id,
          name,
          slug,
          description
        )
      `)
      .eq("organization_id", org.id)
      .order("created_at", { ascending: true })

    if (error) {
      console.error(error)
      alert("Failed to load organization modules.")
      return
    }

    const mapped: ModuleConfig[] = (data || []).map((item: any) => ({
      id: item.modules.id,
      name: item.modules.name,
      slug: item.modules.slug,
      description: item.modules.description,
      enabled: item.enabled,
      isDefault: item.enabled_by_plan,
      organizationModuleId: item.id,
    }))

    setOrgModules(mapped)
  }

  const saveOrganizationPlan = async () => {
    if (!selectedOrg || !selectedPlanId) {
      alert("Please select a plan.")
      return
    }

    setSavingPlan(true)

    const { error } = await supabase.rpc("assign_plan_to_organization", {
      p_organization_id: selectedOrg.id,
      p_plan_id: selectedPlanId,
    })

    if (error) {
      console.error(error)
      alert("Failed to assign plan.")
      setSavingPlan(false)
      return
    }

    const selectedPlan = plans.find((plan) => plan.id === selectedPlanId)

    const updatedOrg: Organization = {
      ...selectedOrg,
      plan_id: selectedPlanId,
      plan_name: selectedPlan?.name || null,
      mrr: selectedPlan?.monthly_price ?? selectedOrg.mrr,
    }

    setSelectedOrg(updatedOrg)
    setOrganizations((prev) =>
      prev.map((org) => (org.id === updatedOrg.id ? updatedOrg : org))
    )

    await handleOrgClick(updatedOrg)
    await fetchOrgs()

    alert("Plan assigned successfully.")
    setSavingPlan(false)
  }

  const handleEditClick = (org: Organization) => {
    setEditingOrgId(org.id)
    setNewOrgName(org.name)
    setNewOrgEmail(org.contactEmail || "")
    setNewOrgStatus(org.status === "Suspended" ? "Pending" : org.status)
    setAddOrgOpen(true)
  }

  const toggleModule = async (moduleId: string) => {
    if (!selectedOrg) return

    const existing = orgModules.find((m) => m.id === moduleId)
    if (!existing) return

    const nextEnabled = !existing.enabled

    setOrgModules((prev) =>
      prev.map((m) =>
        m.id === moduleId ? { ...m, enabled: nextEnabled } : m
      )
    )

    const { error } = await supabase
      .from("organization_modules")
      .update({
        enabled: nextEnabled,
        manually_overridden: true,
      })
      .eq("organization_id", selectedOrg.id)
      .eq("module_id", moduleId)

    if (error) {
      console.error(error)
      alert("Failed to update module.")
    }
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

    if (error) {
      alert(error.message)
      return
    }

    fetchOrgs()
  }

  const deleteOrganization = async (org: Organization) => {
    const confirmed = window.confirm(
      `Delete "${org.name}"? This cannot be undone.`
    )

    if (!confirmed) return

    const { error } = await supabase
      .from("organizations")
      .delete()
      .eq("id", org.id)

    if (error) {
      alert(error.message)
      return
    }

    alert("Organization deleted.")
    fetchOrgs()
  }

  const inviteOrganizationAdmin = async (org: Organization) => {
    if (!org.contactEmail) {
      alert("This organization does not have an admin/contact email.")
      return
    }

    const response = await fetch("/api/platform/invite-admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: org.contactEmail,
        organizationId: org.id,
        organizationName: org.name,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      alert(result.error || "Failed to invite admin.")
      return
    }

    alert(`Admin invite sent to ${org.contactEmail}`)
  }

  const handleAddOrganization = async () => {
    if (!newOrgName.trim()) {
      alert("Organization name is required.")
      return
    }

    if (!newOrgEmail.trim()) {
      alert("Admin email is required.")
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

      const createResponse = await fetch("/api/organizations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          name: newOrgName.trim(),
          contact_email: newOrgEmail.trim(),
          status: newOrgStatus.toLowerCase(),
        }),
      })

      const createResult = await createResponse.json()

      if (!createResponse.ok) {
        throw new Error(createResult.error || "Failed to create organization")
      }

      if (!createResult.organization) {
        throw new Error("No organization returned from API")
      }

      const inviteResponse = await fetch("/api/platform/invite-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newOrgEmail.trim(),
          organizationId: createResult.organization.id,
          organizationName: createResult.organization.name,
        }),
      })

      const inviteResult = await inviteResponse.json()

      if (!inviteResponse.ok) {
        alert(
          `Organization was created, but the admin invite failed: ${
            inviteResult.error || "Unknown error"
          }`
        )
      } else {
        alert(`Organization created and admin invite sent to ${newOrgEmail}`)
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
                type="button"
                onClick={() => {
                  resetAddForm()
                  setAddOrgOpen(true)
                }}
                style={{
                  backgroundColor: "#000",
                  color: "#fff",
                }}
                className="flex items-center gap-2 rounded-md px-4 py-2 hover:opacity-90"
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
                  <TableHead className="w-[50px]" />
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
                          <p className="font-medium text-foreground">
                            {org.name}
                          </p>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
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

                            <DropdownMenuItem
                              onClick={() => inviteOrganizationAdmin(org)}
                            >
                              Send Admin Login Invite
                            </DropdownMenuItem>

                            {org.status === "Active" && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() =>
                                  updateOrganizationStatus(org.id, "Suspended")
                                }
                              >
                                Suspend
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteOrganization(org)}
                            >
                              Delete
                            </DropdownMenuItem>

                            {org.status === "Suspended" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateOrganizationStatus(org.id, "Active")
                                }
                              >
                                Activate
                              </DropdownMenuItem>
                            )}

                            {org.status === "Pending" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateOrganizationStatus(org.id, "Active")
                                }
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
        <SheetContent className="w-[95vw] max-w-none overflow-y-auto sm:max-w-none lg:w-[1100px]">
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

              {selectedOrg && (
                <Badge
                  variant="secondary"
                  className={statusStyles[selectedOrg.status]}
                >
                  {selectedOrg.status}
                </Badge>
              )}
            </div>
          </SheetHeader>

          <Tabs defaultValue="overview" className="mt-6">
            <TabsList className="flex w-full flex-nowrap items-center gap-2 overflow-hidden rounded-lg bg-muted p-1">
              <TabsTrigger
                value="overview"
                className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap"
              >
                <Building2 className="h-4 w-4 shrink-0" />
                Overview
              </TabsTrigger>

              <TabsTrigger
                value="members"
                className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap"
              >
                <Users className="h-4 w-4 shrink-0" />
                Members
              </TabsTrigger>

              <TabsTrigger
                value="modules"
                className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap"
              >
                <Boxes className="h-4 w-4 shrink-0" />
                Modules
              </TabsTrigger>

              <TabsTrigger
                value="billing"
                className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap"
              >
                <CreditCard className="h-4 w-4 shrink-0" />
                Billing
              </TabsTrigger>

              <TabsTrigger
                value="settings"
                className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap"
              >
                <Settings className="h-4 w-4 shrink-0" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Members</p>
                    <p className="text-2xl font-semibold">
                      {selectedOrg?.members}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">
                      Monthly Revenue
                    </p>
                    <p className="text-2xl font-semibold">
                      ${selectedOrg?.mrr}
                    </p>
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

                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <span className="text-sm">
                      {selectedOrg?.plan_name || "Not set"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="members" className="mt-6 space-y-4">
              <div>
                <h3 className="font-medium">Organization Members</h3>
                <p className="text-sm text-muted-foreground">
                  Manage admins and members for this organization.
                </p>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">
                          {selectedOrg?.name} Admin
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {selectedOrg?.contactEmail || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                            Admin
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              selectedOrg?.status === "Active"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-zinc-100 text-zinc-700"
                            }
                          >
                            {selectedOrg?.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => selectedOrg && inviteOrganizationAdmin(selectedOrg)}
              >
                Send Admin Login Invite
              </Button>
            </TabsContent>

            <TabsContent value="modules" className="mt-6 space-y-4">
              <div>
                <h3 className="font-medium">Module Access</h3>
                <p className="text-sm text-muted-foreground">
                  Enable or disable modules for this organization
                </p>
              </div>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <div>
                    <h3 className="text-sm font-semibold">Subscription Plan</h3>
                    <p className="text-xs text-muted-foreground">
                      Assign a plan to control included modules and billing access.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Select
                      value={selectedPlanId}
                      onValueChange={setSelectedPlanId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No Plan Selected" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name} (${plan.monthly_price}/month)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={saveOrganizationPlan}
                      disabled={savingPlan}
                    >
                      {savingPlan ? "Saving..." : "Save Plan"}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Current plan: {selectedOrg?.plan_name || "Not set"}
                  </p>
                </CardContent>
              </Card>

              
            </TabsContent>

            <TabsContent value="billing" className="mt-6 space-y-4">
              <Card>
                <CardContent className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Current Plan</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedOrg?.plan_name || "Not set yet"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const modulesTab = document.querySelector(
                          '[data-value="modules"]'
                        ) as HTMLButtonElement | null
                        modulesTab?.click()
                      }}
                    >
                      Change Plan
                    </Button>
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
              <Label htmlFor="org-email">Admin Email</Label>
              <Input
                id="org-email"
                type="email"
                placeholder="admin@organization.org"
                value={newOrgEmail}
                onChange={(e) => setNewOrgEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This person will receive the login invite for this organization.
              </p>
            </div>

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
                : "Create Organization + Invite Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}