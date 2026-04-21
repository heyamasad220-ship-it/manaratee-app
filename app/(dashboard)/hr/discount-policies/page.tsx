"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Building2,
  Briefcase,
  Heart,
  UserCheck,
  Shield,
  MoreHorizontal,
  Info,
} from "lucide-react"

// Types
interface DiscountPolicy {
  id: string
  name: string
  customerType: string
  discountPercent: number
  appliesTo: string[]
  isActive: boolean
  description?: string
  priority: number
}

// Customer type icons
const customerTypeIcons: Record<string, typeof Users> = {
  "Full-Time Staff": Briefcase,
  "Part-Time Staff": Briefcase,
  "Volunteer": Heart,
  "Member": UserCheck,
  "Non-Profit": Building2,
  "Board Member": Shield,
  "Senior": Users,
  "Student": Users,
}

// Service categories that policies can apply to
const serviceCategories = [
  { id: "venue-rentals", label: "Venue Rentals" },
  { id: "programs", label: "Programs & Classes" },
  { id: "events", label: "Events & Tickets" },
  { id: "memberships", label: "Memberships" },
  { id: "services", label: "Services" },
  { id: "merchandise", label: "Merchandise" },
]

// Mock discount policies
const mockPolicies: DiscountPolicy[] = [
  {
    id: "dp1",
    name: "Full-Time Staff Discount",
    customerType: "Full-Time Staff",
    discountPercent: 50,
    appliesTo: ["venue-rentals", "programs", "events", "services"],
    isActive: true,
    description: "50% discount for all full-time employees on most services",
    priority: 1,
  },
  {
    id: "dp2",
    name: "Part-Time Staff Discount",
    customerType: "Part-Time Staff",
    discountPercent: 25,
    appliesTo: ["venue-rentals", "programs", "events"],
    isActive: true,
    description: "25% discount for part-time employees",
    priority: 2,
  },
  {
    id: "dp3",
    name: "Volunteer Appreciation",
    customerType: "Volunteer",
    discountPercent: 10,
    appliesTo: ["programs", "events", "memberships"],
    isActive: true,
    description: "10% discount for active volunteers",
    priority: 3,
  },
  {
    id: "dp4",
    name: "Member Benefits",
    customerType: "Member",
    discountPercent: 10,
    appliesTo: ["programs", "events", "services", "merchandise"],
    isActive: true,
    description: "Standard 10% member discount",
    priority: 4,
  },
  {
    id: "dp5",
    name: "Non-Profit Partner Discount",
    customerType: "Non-Profit",
    discountPercent: 50,
    appliesTo: ["venue-rentals"],
    isActive: true,
    description: "50% discount on venue rentals for registered non-profits",
    priority: 5,
  },
  {
    id: "dp6",
    name: "Board Member Discount",
    customerType: "Board Member",
    discountPercent: 100,
    appliesTo: ["programs", "events", "memberships"],
    isActive: true,
    description: "Complimentary access for board members",
    priority: 1,
  },
  {
    id: "dp7",
    name: "Senior Discount",
    customerType: "Senior",
    discountPercent: 15,
    appliesTo: ["programs", "events"],
    isActive: false,
    description: "15% discount for seniors (65+)",
    priority: 6,
  },
]

export default function DiscountPoliciesPage() {
  const [policies, setPolicies] = useState<DiscountPolicy[]>(mockPolicies)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedPolicy, setSelectedPolicy] = useState<DiscountPolicy | null>(null)
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all")

  // Form state
  const [formData, setFormData] = useState<Partial<DiscountPolicy>>({
    name: "",
    customerType: "",
    discountPercent: 0,
    appliesTo: [],
    isActive: true,
    description: "",
  })

  const filteredPolicies = policies.filter((policy) => {
    if (filterActive === "active") return policy.isActive
    if (filterActive === "inactive") return !policy.isActive
    return true
  })

  function openEditDialog(policy: DiscountPolicy) {
    setSelectedPolicy(policy)
    setFormData({
      name: policy.name,
      customerType: policy.customerType,
      discountPercent: policy.discountPercent,
      appliesTo: [...policy.appliesTo],
      isActive: policy.isActive,
      description: policy.description,
    })
    setShowEditDialog(true)
  }

  function openCreateDialog() {
    setFormData({
      name: "",
      customerType: "",
      discountPercent: 0,
      appliesTo: [],
      isActive: true,
      description: "",
    })
    setShowCreateDialog(true)
  }

  function togglePolicyActive(policyId: string) {
    setPolicies((prev) =>
      prev.map((p) => (p.id === policyId ? { ...p, isActive: !p.isActive } : p))
    )
  }

  function deletePolicy(policyId: string) {
    setPolicies((prev) => prev.filter((p) => p.id !== policyId))
  }

  function handleSavePolicy() {
    if (selectedPolicy) {
      // Edit existing
      setPolicies((prev) =>
        prev.map((p) =>
          p.id === selectedPolicy.id
            ? { ...p, ...formData } as DiscountPolicy
            : p
        )
      )
      setShowEditDialog(false)
    } else {
      // Create new
      const newPolicy: DiscountPolicy = {
        id: `dp-${Date.now()}`,
        name: formData.name || "",
        customerType: formData.customerType || "",
        discountPercent: formData.discountPercent || 0,
        appliesTo: formData.appliesTo || [],
        isActive: formData.isActive ?? true,
        description: formData.description,
        priority: policies.length + 1,
      }
      setPolicies((prev) => [...prev, newPolicy])
      setShowCreateDialog(false)
    }
    setSelectedPolicy(null)
  }

  function toggleAppliesTo(categoryId: string) {
    setFormData((prev) => ({
      ...prev,
      appliesTo: prev.appliesTo?.includes(categoryId)
        ? prev.appliesTo.filter((id) => id !== categoryId)
        : [...(prev.appliesTo || []), categoryId],
    }))
  }

  return (
    <>
      <Header title="Discount Policies" />
      <div className="flex flex-col gap-6 p-6">
        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="flex items-start gap-3 p-4">
            <Info className="mt-0.5 h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-800">About Discount Policies</p>
              <p className="text-sm text-blue-700">
                Discount policies automatically apply discounts based on customer type. When a customer 
                is tagged as a specific type (e.g., Staff, Member, Volunteer), the appropriate discount 
                is automatically applied at checkout. Policies are applied in priority order if multiple apply.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Policies Table Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Discount Policies</CardTitle>
              <CardDescription>
                Manage automatic discounts based on customer type
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={filterActive} onValueChange={(v) => setFilterActive(v as typeof filterActive)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Policies</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Policy
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Policy Name</TableHead>
                  <TableHead>Customer Type</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Applies To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPolicies.map((policy) => {
                  const TypeIcon = customerTypeIcons[policy.customerType] || Users
                  return (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{policy.name}</span>
                          {policy.description && (
                            <span className="text-xs text-muted-foreground">
                              {policy.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                            <TypeIcon className="h-4 w-4 text-primary" />
                          </div>
                          <span>{policy.customerType}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            policy.discountPercent === 100
                              ? "bg-emerald-100 text-emerald-700"
                              : policy.discountPercent >= 50
                                ? "bg-blue-100 text-blue-700"
                                : "bg-muted"
                          }
                        >
                          {policy.discountPercent === 100 ? "Free" : `${policy.discountPercent}% off`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {policy.appliesTo.slice(0, 3).map((category) => {
                            const cat = serviceCategories.find((c) => c.id === category)
                            return (
                              <Badge key={category} variant="outline" className="text-xs">
                                {cat?.label || category}
                              </Badge>
                            )
                          })}
                          {policy.appliesTo.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{policy.appliesTo.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={policy.isActive}
                            onCheckedChange={() => togglePolicyActive(policy.id)}
                          />
                          <Badge
                            variant="secondary"
                            className={
                              policy.isActive
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {policy.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(policy)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deletePolicy(policy.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
                <Shield className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{policies.filter((p) => p.isActive).length}</p>
                <p className="text-sm text-muted-foreground">Active Policies</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {new Set(policies.map((p) => p.customerType)).size}
                </p>
                <p className="text-sm text-muted-foreground">Customer Types</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
                <Briefcase className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">50%</p>
                <p className="text-sm text-muted-foreground">Max Staff Discount</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <Heart className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">10%</p>
                <p className="text-sm text-muted-foreground">Member Discount</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create/Edit Policy Dialog */}
        <Dialog
          open={showCreateDialog || showEditDialog}
          onOpenChange={(open) => {
            if (!open) {
              setShowCreateDialog(false)
              setShowEditDialog(false)
              setSelectedPolicy(null)
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedPolicy ? "Edit Discount Policy" : "Create Discount Policy"}
              </DialogTitle>
              <DialogDescription>
                {selectedPolicy
                  ? "Update the discount policy settings"
                  : "Create a new automatic discount policy for a customer type"}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="policy-name">Policy Name</Label>
                <Input
                  id="policy-name"
                  placeholder="e.g., Full-Time Staff Discount"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="customer-type">Customer Type</Label>
                <Select
                  value={formData.customerType}
                  onValueChange={(v) => setFormData({ ...formData, customerType: v })}
                >
                  <SelectTrigger id="customer-type">
                    <SelectValue placeholder="Select customer type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-Time Staff">Full-Time Staff</SelectItem>
                    <SelectItem value="Part-Time Staff">Part-Time Staff</SelectItem>
                    <SelectItem value="Volunteer">Volunteer</SelectItem>
                    <SelectItem value="Member">Member</SelectItem>
                    <SelectItem value="Non-Profit">Non-Profit Organization</SelectItem>
                    <SelectItem value="Board Member">Board Member</SelectItem>
                    <SelectItem value="Senior">Senior (65+)</SelectItem>
                    <SelectItem value="Student">Student</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="discount-percent">Discount Percentage</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="discount-percent"
                    type="number"
                    min={0}
                    max={100}
                    placeholder="50"
                    value={formData.discountPercent || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, discountPercent: Number(e.target.value) })
                    }
                    className="w-24"
                  />
                  <span className="text-muted-foreground">%</span>
                  {formData.discountPercent === 100 && (
                    <Badge className="bg-emerald-100 text-emerald-700">Free / Complimentary</Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Applies To</Label>
                <p className="text-xs text-muted-foreground">
                  Select which service categories this discount applies to
                </p>
                <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
                  {serviceCategories.map((category) => (
                    <div key={category.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`cat-${category.id}`}
                        checked={formData.appliesTo?.includes(category.id)}
                        onCheckedChange={() => toggleAppliesTo(category.id)}
                      />
                      <Label htmlFor={`cat-${category.id}`} className="text-sm font-normal">
                        {category.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="policy-description">Description (Optional)</Label>
                <Input
                  id="policy-description"
                  placeholder="Brief description of this policy"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="policy-active" className="text-sm">Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable this policy to apply discounts automatically
                  </p>
                </div>
                <Switch
                  id="policy-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false)
                  setShowEditDialog(false)
                  setSelectedPolicy(null)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePolicy}
                disabled={!formData.name || !formData.customerType || !formData.discountPercent}
              >
                {selectedPolicy ? "Save Changes" : "Create Policy"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
