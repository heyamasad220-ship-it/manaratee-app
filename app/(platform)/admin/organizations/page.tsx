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
import { Checkbox } from "@/components/ui/checkbox"
import type { OrganizationSubscriptionTerms } from "@/lib/organizations/organization-subscription-types"
import {
  computeOrganizationSubscriptionTerms,
  formatDisplayDate,
} from "@/lib/organizations/organization-subscription-terms"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PlatformEnterOrganizationButton } from "@/components/platform/platform-enter-organization-button"
import {
  organizationProgramKindToggles,
  organizationProgramKindsFromToggles,
  type OrganizationProgramKindsEntitlement,
} from "@/lib/programs/program-kind-policy"
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
  isCore?: boolean
  isProduct?: boolean
  isCapability?: boolean
  organizationModuleId?: string
}

interface SubscriptionBundleOption {
  slug: string
  name: string
  description: string
  moduleSlugs: string[]
}

interface OrgRole {
  id: string
  name: string
  description?: string | null
}

interface OrgMember {
  membershipId: string
  userId: string
  name: string
  email: string
  systemRole: string
  roleId: string | null
  roleName: string
  status: "Active" | "Inactive"
  lastLogin: string | null
  createdAt: string
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
  const [coreModules, setCoreModules] = useState<ModuleConfig[]>([])
  const [capabilityModules, setCapabilityModules] = useState<ModuleConfig[]>([])
  const [subscriptionBundles, setSubscriptionBundles] = useState<
    SubscriptionBundleOption[]
  >([])
  const [activeBundleSlug, setActiveBundleSlug] = useState<string | null>(null)
  const [applyingBundleSlug, setApplyingBundleSlug] = useState<string | null>(
    null
  )
  const [loadingModules, setLoadingModules] = useState(false)
  const [programKinds, setProgramKinds] = useState<
    "academic" | "seasonal" | "both"
  >("both")
  const [loadingProgramKinds, setLoadingProgramKinds] = useState(false)
  const [savingProgramKinds, setSavingProgramKinds] = useState(false)

  const [newOrgName, setNewOrgName] = useState("")
  const [newOrgEmail, setNewOrgEmail] = useState("")
  const [newOrgStatus, setNewOrgStatus] = useState<"Active" | "Pending">(
    "Pending"
  )
  const [saving, setSaving] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null)

  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([])
  const [orgRoles, setOrgRoles] = useState<OrgRole[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [inviteMemberOpen, setInviteMemberOpen] = useState(false)
  const [inviteFirstName, setInviteFirstName] = useState("")
  const [inviteLastName, setInviteLastName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRoleId, setInviteRoleId] = useState("")
  const [sendingInvite, setSendingInvite] = useState(false)

  const [loadingBillingTerms, setLoadingBillingTerms] = useState(false)
  const [savingBillingTerms, setSavingBillingTerms] = useState(false)
  const [subscriptionStartDate, setSubscriptionStartDate] = useState("")
  const [threeMonthsFree, setThreeMonthsFree] = useState(false)
  const [firstYearSpecialRate, setFirstYearSpecialRate] = useState("")

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

  const billingTermsDraftPreview = useMemo(() => {
    const plan = plans.find((item) => item.id === selectedOrg?.plan_id)
    const standardRate = plan?.monthly_price ?? selectedOrg?.mrr ?? 0

    return computeOrganizationSubscriptionTerms(
      {
        subscriptionStartDate: subscriptionStartDate || null,
        complimentaryMonths: threeMonthsFree ? 3 : 0,
        firstYearSpecialMonthlyRate: firstYearSpecialRate.trim()
          ? Number(firstYearSpecialRate)
          : null,
      },
      standardRate
    )
  }, [
    plans,
    selectedOrg?.plan_id,
    selectedOrg?.mrr,
    subscriptionStartDate,
    threeMonthsFree,
    firstYearSpecialRate,
  ])

  const loadBillingTerms = async (organizationId: string) => {
    setLoadingBillingTerms(true)
    try {
      const response = await fetch(
        `/api/platform/organizations/${organizationId}/billing-terms`
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to load billing terms.")
      }

      const terms = result.terms as OrganizationSubscriptionTerms
      setSubscriptionStartDate(terms.subscriptionStartDate || "")
      setThreeMonthsFree(terms.complimentaryMonths === 3)
      setFirstYearSpecialRate(
        terms.firstYearSpecialMonthlyRate == null
          ? ""
          : String(terms.firstYearSpecialMonthlyRate)
      )
    } catch (error) {
      console.error(error)
      setSubscriptionStartDate("")
      setThreeMonthsFree(false)
      setFirstYearSpecialRate("")
    } finally {
      setLoadingBillingTerms(false)
    }
  }

  const saveBillingTerms = async () => {
    if (!selectedOrg) return

    setSavingBillingTerms(true)
    try {
      const response = await fetch(
        `/api/platform/organizations/${selectedOrg.id}/billing-terms`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscriptionStartDate: subscriptionStartDate || null,
            complimentaryMonths: threeMonthsFree ? 3 : 0,
            firstYearSpecialMonthlyRate: firstYearSpecialRate.trim()
              ? Number(firstYearSpecialRate)
              : null,
          }),
        }
      )
      const result = await response.json()

      if (!response.ok || !result.success) {
        alert(result.error || "Failed to save subscription terms.")
        return
      }

      alert("Subscription terms saved.")
    } catch (error) {
      console.error(error)
      alert("Unexpected error saving subscription terms.")
    } finally {
      setSavingBillingTerms(false)
    }
  }

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

    setLoadingModules(true)

    try {
      const response = await fetch(
        `/api/platform/organizations/${org.id}/modules`
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to load organization modules.")
      }

      const mapModule = (item: any): ModuleConfig => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        enabled: item.enabled,
        isDefault: item.enabledByPlan,
        isCore: item.isCore,
        isProduct: item.isProduct,
        isCapability: item.isCapability,
        organizationModuleId: item.organizationModuleId,
      })

      setOrgModules((result.catalogModules || []).map(mapModule))
      setCoreModules((result.coreModules || []).map(mapModule))
      setCapabilityModules((result.capabilityModules || []).map(mapModule))
      setSubscriptionBundles(result.bundles || [])
      setActiveBundleSlug(result.bundleSlug || null)
    } catch (error) {
      console.error(error)
      alert(
        error instanceof Error
          ? error.message
          : "Failed to load organization modules."
      )
    } finally {
      setLoadingModules(false)
    }

    await Promise.all([
      loadOrganizationMembers(org.id),
      loadBillingTerms(org.id),
      loadProgramKinds(org.id),
    ])
  }

  const loadProgramKinds = async (organizationId: string) => {
    setLoadingProgramKinds(true)
    try {
      const response = await fetch(
        `/api/platform/organizations/${organizationId}/program-kinds`
      )
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load program modes.")
      }
      const next =
        result.programKinds === "academic" || result.programKinds === "seasonal"
          ? result.programKinds
          : "both"
      setProgramKinds(next)
    } catch (error) {
      console.error(error)
      setProgramKinds("both")
    } finally {
      setLoadingProgramKinds(false)
    }
  }

  const saveProgramKindToggle = async (
    kind: "academic" | "seasonal",
    enabled: boolean
  ) => {
    if (!selectedOrg || savingProgramKinds) return

    const current = organizationProgramKindToggles(programKinds)
    const nextToggles = { ...current, [kind]: enabled }
    const next = organizationProgramKindsFromToggles(
      nextToggles.academic,
      nextToggles.seasonal
    )
    if (!next) {
      alert("Turn on Academic, Seasonal, or both.")
      return
    }
    if (next === programKinds) return

    const previous = programKinds
    setProgramKinds(next)
    setSavingProgramKinds(true)
    try {
      const response = await fetch(
        `/api/platform/organizations/${selectedOrg.id}/program-kinds`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ programKinds: next }),
        }
      )
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save program modes.")
      }
      setProgramKinds(
        result.programKinds as OrganizationProgramKindsEntitlement
      )
    } catch (error) {
      console.error(error)
      setProgramKinds(previous)
      alert(
        error instanceof Error ? error.message : "Failed to save program modes."
      )
    } finally {
      setSavingProgramKinds(false)
    }
  }

  const loadOrganizationMembers = async (organizationId: string) => {
    setLoadingMembers(true)

    try {
      const response = await fetch(
        `/api/platform/organizations/${organizationId}/members`
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to load organization members.")
      }

      setOrgMembers(result.members || [])
      setOrgRoles(result.roles || [])

      if (!inviteRoleId && result.roles?.length > 0) {
        const adminRole = result.roles.find(
          (role: OrgRole) => role.name.toLowerCase() === "admin"
        )
        setInviteRoleId(adminRole?.id ?? result.roles[0].id)
      }
    } catch (error) {
      console.error(error)
      alert(
        error instanceof Error
          ? error.message
          : "Failed to load organization members."
      )
      setOrgMembers([])
      setOrgRoles([])
    } finally {
      setLoadingMembers(false)
    }
  }

  const resetInviteMemberForm = () => {
    setInviteFirstName("")
    setInviteLastName("")
    setInviteEmail("")

    const adminRole = orgRoles.find((role) => role.name.toLowerCase() === "admin")
    setInviteRoleId(adminRole?.id ?? orgRoles[0]?.id ?? "")
  }

  const handleInviteOrganizationMember = async () => {
    if (!selectedOrg) return

    const cleanEmail = inviteEmail.trim().toLowerCase()
    if (!cleanEmail) {
      alert("Enter an email address.")
      return
    }

    setSendingInvite(true)

    try {
      const selectedRole = orgRoles.find((role) => role.id === inviteRoleId)
      const response = await fetch(
        `/api/platform/organizations/${selectedOrg.id}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: cleanEmail,
            firstName: inviteFirstName.trim() || null,
            lastName: inviteLastName.trim() || null,
            roleId: inviteRoleId || null,
            roleName: selectedRole?.name || null,
            organizationName: selectedOrg.name,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok || !result.success) {
        const message = [result.error, result.details, result.fix]
          .filter(Boolean)
          .join(" — ")
        alert(message || "Failed to send invitation.")
        return
      }

      alert(result.message || "Invitation email sent.")
      resetInviteMemberForm()
      setInviteMemberOpen(false)
      await loadOrganizationMembers(selectedOrg.id)
      fetchOrgs()
    } catch (error) {
      console.error(error)
      alert("Unexpected error sending invitation.")
    } finally {
      setSendingInvite(false)
    }
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

  const applySubscriptionBundle = async (bundleSlug: string) => {
    if (!selectedOrg) return

    setApplyingBundleSlug(bundleSlug)

    try {
      const response = await fetch(
        `/api/platform/organizations/${selectedOrg.id}/modules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bundleSlug }),
        }
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to apply bundle.")
      }

      const mapModule = (item: any): ModuleConfig => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        enabled: item.enabled,
        isDefault: item.enabledByPlan,
        isCore: item.isCore,
        isProduct: item.isProduct,
        isCapability: item.isCapability,
        organizationModuleId: item.organizationModuleId,
      })

      setOrgModules((result.catalogModules || []).map(mapModule))
      setCoreModules((result.coreModules || []).map(mapModule))
      setCapabilityModules((result.capabilityModules || []).map(mapModule))
      setActiveBundleSlug(result.bundleSlug || bundleSlug)
      alert("Subscription bundle applied.")
    } catch (error) {
      console.error(error)
      alert(
        error instanceof Error ? error.message : "Failed to apply bundle."
      )
    } finally {
      setApplyingBundleSlug(null)
    }
  }

  const toggleModule = async (moduleSlug: string) => {
    if (!selectedOrg) return

    const existing = orgModules.find((m) => m.slug === moduleSlug)
    if (!existing) return

    const nextEnabled = !existing.enabled

    setOrgModules((prev) =>
      prev.map((m) =>
        m.slug === moduleSlug ? { ...m, enabled: nextEnabled } : m
      )
    )

    try {
      const response = await fetch(
        `/api/platform/organizations/${selectedOrg.id}/modules`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleSlug, enabled: nextEnabled }),
        }
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to update module.")
      }

      const mapModule = (item: any): ModuleConfig => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        enabled: item.enabled,
        isDefault: item.enabledByPlan,
        isCore: item.isCore,
        isProduct: item.isProduct,
        isCapability: item.isCapability,
        organizationModuleId: item.organizationModuleId,
      })

      setOrgModules((result.catalogModules || []).map(mapModule))
      setCapabilityModules((result.capabilityModules || []).map(mapModule))
      setActiveBundleSlug(result.bundleSlug || null)
    } catch (error) {
      console.error(error)
      setOrgModules((prev) =>
        prev.map((m) =>
          m.slug === moduleSlug ? { ...m, enabled: !nextEnabled } : m
        )
      )
      alert(
        error instanceof Error ? error.message : "Failed to update module."
      )
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

      const inviteEmail = newOrgEmail.trim().toLowerCase()
      if (inviteEmail === "admin@manaratee.com") {
        alert(
          "Organization created. admin@manaratee.com stays a platform admin. Invite an organization Super Admin from the Members tab."
        )
      } else {
        const inviteResponse = await fetch(
          `/api/platform/organizations/${createResult.organization.id}/members`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: newOrgEmail.trim(),
              organizationName: createResult.organization.name,
              roleId: createResult.roles?.superAdminRoleId || null,
              roleName: "Super Admin",
            }),
          }
        )

        const inviteResult = await inviteResponse.json()

        if (!inviteResponse.ok) {
          alert(
            `Organization was created, but the Super Admin invite failed: ${
              inviteResult.error || "Unknown error"
            }`
          )
        } else {
          alert(
            `Organization created and Super Admin invite sent to ${newOrgEmail}`
          )
        }
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
        onOpenChange={(open) => {
          if (!open) setSelectedOrg(null)
        }}
      >
        {selectedOrg ? (
        <SheetContent className="w-[95vw] max-w-none overflow-y-auto sm:max-w-none lg:w-[1100px]">
          <SheetHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <Building2 className="h-5 w-5 text-emerald-600" />
                </div>

                <div>
                  <SheetTitle className="text-lg">{selectedOrg.name}</SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrg.contactEmail || "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <PlatformEnterOrganizationButton
                  organizationId={selectedOrg.id}
                  organizationName={selectedOrg.name}
                />
                <Badge
                  variant="secondary"
                  className={statusStyles[selectedOrg.status]}
                >
                  {selectedOrg.status}
                </Badge>
              </div>
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-medium">Organization Members</h3>
                  <p className="text-sm text-muted-foreground">
                    Organization admins and staff only. Customer portal users are
                    managed inside each organization.
                  </p>
                </div>

                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => {
                    resetInviteMemberForm()
                    setInviteMemberOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Invite User
                </Button>
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
                      {loadingMembers ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="h-20 text-center text-muted-foreground"
                          >
                            Loading members...
                          </TableCell>
                        </TableRow>
                      ) : orgMembers.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="h-20 text-center text-muted-foreground"
                          >
                            No members yet. Invite the first user for this
                            organization.
                          </TableCell>
                        </TableRow>
                      ) : (
                        orgMembers.map((member) => (
                          <TableRow key={member.membershipId}>
                            <TableCell className="font-medium">
                              {member.name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {member.email}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className="bg-blue-100 text-blue-700"
                              >
                                {member.roleName}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={
                                  member.status === "Active"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-zinc-100 text-zinc-700"
                                }
                              >
                                {member.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
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
                <CardContent className="space-y-3 p-4">
                  <div>
                    <h3 className="text-sm font-semibold">Subscription Plan</h3>
                    <p className="text-xs text-muted-foreground">
                      Assign a plan to control included modules and billing access.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Select
                      value={selectedPlanId || undefined}
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

              <Card>
                <CardContent className="space-y-4 p-4">
                  <div>
                    <h3 className="text-sm font-semibold">Persona Bundle</h3>
                    <p className="text-xs text-muted-foreground">
                      Apply a preset module mix for common organization types.
                      {activeBundleSlug
                        ? ` Active bundle: ${activeBundleSlug.replace(/-/g, " ")}.`
                        : " Custom module mix (no bundle applied)."}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {subscriptionBundles.map((bundle) => (
                      <div
                        key={bundle.slug}
                        className={cn(
                          "rounded-lg border p-3",
                          activeBundleSlug === bundle.slug &&
                            "border-emerald-500 bg-emerald-50/40"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{bundle.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {bundle.description}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={
                              activeBundleSlug === bundle.slug
                                ? "secondary"
                                : "outline"
                            }
                            disabled={applyingBundleSlug !== null}
                            onClick={() => applySubscriptionBundle(bundle.slug)}
                          >
                            {applyingBundleSlug === bundle.slug
                              ? "Applying..."
                              : activeBundleSlug === bundle.slug
                                ? "Reapply"
                                : "Apply"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 p-4">
                  <div>
                    <h3 className="text-sm font-semibold">Core Platform</h3>
                    <p className="text-xs text-muted-foreground">
                      Included with every tenant — always enabled.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {coreModules.map((module) => (
                      <div
                        key={module.slug}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{module.name}</p>
                          {module.description ? (
                            <p className="text-xs text-muted-foreground">
                              {module.description}
                            </p>
                          ) : null}
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-emerald-100 text-emerald-700"
                        >
                          Always on
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 p-4">
                  <div>
                    <h3 className="text-sm font-semibold">Product Modules</h3>
                    <p className="text-xs text-muted-foreground">
                      Toggle billable modules for this organization. Capability
                      modules sync automatically.
                    </p>
                  </div>

                  {loadingModules ? (
                    <p className="text-sm text-muted-foreground">
                      Loading modules...
                    </p>
                  ) : orgModules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No product modules found. Run migration 067 in Supabase.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {orgModules.map((module) => {
                        const isPrograms = module.slug === "programs"
                        const kindToggles =
                          organizationProgramKindToggles(programKinds)
                        return (
                          <div
                            key={module.slug}
                            className="rounded-md border"
                          >
                            <div className="flex items-center justify-between px-3 py-2">
                              <div className="pr-4">
                                <p className="text-sm font-medium">
                                  {module.name}
                                </p>
                                {module.description ? (
                                  <p className="text-xs text-muted-foreground">
                                    {module.description}
                                  </p>
                                ) : null}
                              </div>
                              <Switch
                                checked={module.enabled}
                                onCheckedChange={() =>
                                  toggleModule(module.slug)
                                }
                              />
                            </div>
                            {isPrograms && module.enabled ? (
                              <div className="space-y-1 border-t bg-zinc-50/70 px-3 py-2">
                                {loadingProgramKinds ? (
                                  <p className="text-xs text-muted-foreground">
                                    Loading Academic and Seasonal options…
                                  </p>
                                ) : (
                                  <>
                                    <div className="flex items-center justify-between py-1 pl-3">
                                      <div className="pr-4">
                                        <p className="text-sm font-medium">
                                          Academic
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          Years and course offerings
                                        </p>
                                      </div>
                                      <Switch
                                        checked={kindToggles.academic}
                                        disabled={savingProgramKinds}
                                        onCheckedChange={(checked) =>
                                          void saveProgramKindToggle(
                                            "academic",
                                            checked
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="flex items-center justify-between py-1 pl-3">
                                      <div className="pr-4">
                                        <p className="text-sm font-medium">
                                          Seasonal
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          Camps and seasons
                                        </p>
                                      </div>
                                      <Switch
                                        checked={kindToggles.seasonal}
                                        disabled={savingProgramKinds}
                                        onCheckedChange={(checked) =>
                                          void saveProgramKindToggle(
                                            "seasonal",
                                            checked
                                          )
                                        }
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {capabilityModules.length > 0 ? (
                <Card>
                  <CardContent className="space-y-4 p-4">
                    <div>
                      <h3 className="text-sm font-semibold">
                        Included Capabilities
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Managed automatically when parent product modules are
                        enabled — not sold separately.
                      </p>
                    </div>

                    <div className="space-y-2">
                      {capabilityModules.map((module) => (
                        <div
                          key={module.slug}
                          className="flex items-center justify-between rounded-md border border-dashed px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium">{module.name}</p>
                            {module.description ? (
                              <p className="text-xs text-muted-foreground">
                                {module.description}
                              </p>
                            ) : null}
                          </div>
                          <Badge
                            variant="secondary"
                            className={
                              module.enabled
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-zinc-100 text-zinc-600"
                            }
                          >
                            {module.enabled ? "Active" : "Off"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
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

              <Card>
                <CardContent className="space-y-5 pt-4">
                  <div>
                    <p className="font-medium">Subscription terms</p>
                    <p className="text-sm text-muted-foreground">
                      Set start date, optional complimentary months, and first-year
                      promotional pricing visible on the organization billing page.
                    </p>
                  </div>

                  {loadingBillingTerms ? (
                    <p className="text-sm text-muted-foreground">Loading subscription terms…</p>
                  ) : (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="subscription-start-date">Subscription start date</Label>
                        <Input
                          id="subscription-start-date"
                          type="date"
                          value={subscriptionStartDate}
                          onChange={(event) => setSubscriptionStartDate(event.target.value)}
                        />
                      </div>

                      <div className="flex items-start gap-3 rounded-md border p-3">
                        <Checkbox
                          id="three-months-free"
                          checked={threeMonthsFree}
                          onCheckedChange={(checked) => setThreeMonthsFree(checked === true)}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="three-months-free" className="cursor-pointer">
                            3 months free
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Optional complimentary period before paid billing begins.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label htmlFor="first-year-special-rate">
                          First year special rate (monthly, optional)
                        </Label>
                        <Input
                          id="first-year-special-rate"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Leave blank to use plan price"
                          value={firstYearSpecialRate}
                          onChange={(event) => setFirstYearSpecialRate(event.target.value)}
                        />
                        <p className="text-sm text-muted-foreground">
                          Organizations see this promotional rate for the first subscription year,
                          then the standard plan price. Pricing may be adjusted after year one.
                        </p>
                      </div>

                      {billingTermsDraftPreview.pricingNotes.length > 0 ? (
                        <div className="rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
                          <p className="font-medium text-foreground">Organization preview</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            {billingTermsDraftPreview.pricingNotes.map((note) => (
                              <li key={note}>{note}</li>
                            ))}
                          </ul>
                          {billingTermsDraftPreview.paidBillingStartsDate ? (
                            <p className="mt-2">
                              Paid billing begins{" "}
                              {formatDisplayDate(billingTermsDraftPreview.paidBillingStartsDate)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <Button
                        onClick={() => void saveBillingTerms()}
                        disabled={savingBillingTerms}
                      >
                        {savingBillingTerms ? "Saving..." : "Save subscription terms"}
                      </Button>
                    </>
                  )}
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
                    <Select defaultValue={selectedOrg.status.toLowerCase()}>
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
        ) : null}
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

      <Dialog open={inviteMemberOpen} onOpenChange={setInviteMemberOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Invite Organization User</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invite-first-name">First Name</Label>
                <Input
                  id="invite-first-name"
                  value={inviteFirstName}
                  onChange={(event) => setInviteFirstName(event.target.value)}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-last-name">Last Name</Label>
                <Input
                  id="invite-last-name"
                  value={inviteLastName}
                  onChange={(event) => setInviteLastName(event.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="user@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">Organization Role</Label>
              {orgRoles.length > 0 ? (
                <Select value={inviteRoleId || undefined} onValueChange={setInviteRoleId}>
                  <SelectTrigger id="invite-role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No staff roles configured yet. The user will receive admin
                  access for this organization.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteMemberOpen(false)}
              disabled={sendingInvite}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleInviteOrganizationMember}
              disabled={sendingInvite}
            >
              {sendingInvite ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}