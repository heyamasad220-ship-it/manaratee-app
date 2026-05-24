"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { PlatformHeader } from "@/components/platform/platform-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Plus, Pencil, Check, Boxes, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"

interface Module {
  id: string
  name: string
  slug: string
}

interface Plan {
  id: string
  name: string
  slug: string
  description: string | null
  monthly_price: number
  yearly_price: number
  member_limit: number | null
  event_limit: number | null
  is_popular: boolean
  is_active: boolean
  modules: string[]
}

function getPlanColor(slug: string) {
  switch (slug) {
    case "free":
      return "border-zinc-200 bg-zinc-50"
    case "starter":
      return "border-blue-200 bg-blue-50"
    case "professional":
      return "border-emerald-200 bg-emerald-50"
    case "enterprise":
      return "border-amber-200 bg-amber-50"
    default:
      return "border-zinc-200 bg-white"
  }
}

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export default function PlansPage() {
  const supabase = createClient()

  const [plans, setPlans] = useState<Plan[]>([])
  const [availableModules, setAvailableModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)

  const [addPlanOpen, setAddPlanOpen] = useState(false)
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [editModules, setEditModules] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editMonthlyPrice, setEditMonthlyPrice] = useState("")
  const [editYearlyPrice, setEditYearlyPrice] = useState("")
  const [editMemberLimit, setEditMemberLimit] = useState("")
  const [editEventLimit, setEditEventLimit] = useState("")
  const [editIsPopular, setEditIsPopular] = useState(false)

  const [newPlanName, setNewPlanName] = useState("")
  const [newPlanPrice, setNewPlanPrice] = useState("")
  const [newMemberLimit, setNewMemberLimit] = useState("")

  useEffect(() => {
    loadPageData()
  }, [])

  async function loadPageData() {
    setLoading(true)
    await Promise.all([loadModules(), loadPlans()])
    setLoading(false)
  }

  async function loadModules() {
    const { data, error } = await supabase
      .from("modules")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })

    if (error) {
      console.error("Error loading modules:", error)
      alert("Failed to load modules.")
      return
    }

    setAvailableModules(data || [])
  }

  async function loadPlans() {
    const { data, error } = await supabase
      .from("plans")
      .select(`
        id,
        name,
        slug,
        description,
        monthly_price,
        yearly_price,
        member_limit,
        event_limit,
        is_popular,
        is_active,
        plan_modules (
          module_id,
          modules (
            slug
          )
        )
      `)
      .eq("is_active", true)
      .order("monthly_price", { ascending: true })

    if (error) {
      console.error("Error loading plans:", error)
      alert("Failed to load plans.")
      return
    }

    const mapped: Plan[] = (data || []).map((plan: any) => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      monthly_price: Number(plan.monthly_price || 0),
      yearly_price: Number(plan.yearly_price || 0),
      member_limit: plan.member_limit,
      event_limit: plan.event_limit,
      is_popular: Boolean(plan.is_popular),
      is_active: Boolean(plan.is_active),
      modules:
        plan.plan_modules
          ?.map((pm: any) => pm.modules?.slug)
          .filter(Boolean) || [],
    }))

    setPlans(mapped)
  }

  function handleEditPlan(plan: Plan) {
  setEditPlan(plan)
  setEditModules([...plan.modules])

  setEditName(plan.name)
  setEditDescription(plan.description || "")
  setEditMonthlyPrice(String(plan.monthly_price || 0))
  setEditYearlyPrice(String(plan.yearly_price || 0))
  setEditMemberLimit(plan.member_limit ? String(plan.member_limit) : "")
  setEditEventLimit(plan.event_limit ? String(plan.event_limit) : "")
  setEditIsPopular(plan.is_popular)
}

  function toggleEditModule(slug: string) {
    setEditModules((prev) =>
      prev.includes(slug)
        ? prev.filter((m) => m !== slug)
        : [...prev, slug]
    )
  }

  async function savePlanEdit() {
  if (!editPlan) return

  if (!editName.trim()) {
    alert("Plan name is required.")
    return
  }

  setSaving(true)

  const { error: planError } = await supabase
    .from("plans")
    .update({
      name: editName.trim(),
      description: editDescription.trim() || null,
      monthly_price: Number(editMonthlyPrice || 0),
      yearly_price: Number(editYearlyPrice || 0),
      member_limit: editMemberLimit ? Number(editMemberLimit) : null,
      event_limit: editEventLimit ? Number(editEventLimit) : null,
      is_popular: editIsPopular,
    })
    .eq("id", editPlan.id)

  if (planError) {
    console.error(planError)
    alert(planError.message)
    setSaving(false)
    return
  }

  const { error: deleteError } = await supabase
    .from("plan_modules")
    .delete()
    .eq("plan_id", editPlan.id)

  if (deleteError) {
    console.error(deleteError)
    alert("Plan details saved, but failed to update included tools.")
    setSaving(false)
    return
  }

  const selectedModules = availableModules.filter((module) =>
    editModules.includes(module.slug)
  )

  if (selectedModules.length > 0) {
    const rows = selectedModules.map((module) => ({
      plan_id: editPlan.id,
      module_id: module.id,
    }))

    const { error: insertError } = await supabase
      .from("plan_modules")
      .insert(rows)

    if (insertError) {
      console.error(insertError)
      alert("Plan details saved, but failed to save selected tools.")
      setSaving(false)
      return
    }
  }

  setEditPlan(null)
  setEditModules([])
  await loadPlans()
  setSaving(false)
}

  async function createPlan() {
    if (!newPlanName.trim()) {
      alert("Plan name is required.")
      return
    }

    setSaving(true)

    const slug = newPlanName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")

    const price = Number(newPlanPrice || 0)
    const memberLimit = newMemberLimit ? Number(newMemberLimit) : null

    const { error } = await supabase.from("plans").insert({
      code: slug,
      name: newPlanName.trim(),
      slug,
      description: `${newPlanName.trim()} plan`,
      monthly_price: price,
      yearly_price: price * 10,
      member_limit: memberLimit,
      event_limit: null,
      is_active: true,
      is_public: true,
      is_popular: false,
    })

    if (error) {
      console.error(error)
      alert(error.message)
      setSaving(false)
      return
    }

    setNewPlanName("")
    setNewPlanPrice("")
    setNewMemberLimit("")
    setAddPlanOpen(false)
    await loadPlans()
    setSaving(false)
  }

  return (
    <>
      <PlatformHeader title="Subscription Plans" />

      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {plans.length} plans configured
          </p>

          <Button
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => setAddPlanOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Plan
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Loading plans...
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative border-2 shadow-sm ${getPlanColor(plan.slug)}`}
              >
                {plan.is_popular && (
                  <Badge className="absolute -top-2.5 right-4 bg-emerald-600 text-white hover:bg-emerald-600">
                    Most Popular
                  </Badge>
                )}

                <CardContent className="flex h-full flex-col gap-5 p-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      {plan.name}
                    </h3>

                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">
                        ${formatPrice(plan.monthly_price)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {plan.monthly_price === 0 ? "Forever" : "/month"}
                      </span>
                    </div>

                    {plan.description && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {plan.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span className="text-sm text-foreground">
                        {plan.member_limit
                          ? `Up to ${plan.member_limit.toLocaleString()} members`
                          : "Unlimited members"}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span className="text-sm text-foreground">
                        {plan.event_limit
                          ? `${plan.event_limit} events per month`
                          : "Unlimited events"}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span className="text-sm text-foreground">
                        Module-based access
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span className="text-sm text-foreground">
                        Organization management
                      </span>
                    </div>
                  </div>

                  <Separator className="my-2" />

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Boxes className="h-3.5 w-3.5" />
                      Included Modules
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {availableModules.map((module) => {
                        const included = plan.modules.includes(module.slug)

                        return (
                          <Badge
                            key={module.id}
                            variant={included ? "default" : "outline"}
                            className={
                              included
                                ? "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                : "text-muted-foreground opacity-50"
                            }
                          >
                            {included ? (
                              <Check className="mr-1 h-3 w-3" />
                            ) : (
                              <X className="mr-1 h-3 w-3" />
                            )}
                            {module.name}
                          </Badge>
                        )
                      })}
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {plan.modules.length} of {availableModules.length} modules
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    className="mt-auto gap-1.5"
                    onClick={() => handleEditPlan(plan)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Plan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={addPlanOpen} onOpenChange={setAddPlanOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add New Plan</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="plan-name">Plan Name</Label>
              <Input
                id="plan-name"
                placeholder="e.g. Professional Plus"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-price">Monthly Price ($)</Label>
                <Input
                  id="plan-price"
                  type="number"
                  placeholder="0"
                  value={newPlanPrice}
                  onChange={(e) => setNewPlanPrice(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-members">Member Limit</Label>
                <Input
                  id="plan-members"
                  type="number"
                  placeholder="e.g. 500"
                  value={newMemberLimit}
                  onChange={(e) => setNewMemberLimit(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddPlanOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={createPlan}
              disabled={saving}
            >
              {saving ? "Creating..." : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editPlan}
        onOpenChange={(open) => !open && setEditPlan(null)}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit Plan: {editPlan?.name}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-5 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-plan-name">Plan Name</Label>
                <Input
                  id="edit-plan-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-monthly-price">Monthly Price ($)</Label>
                <Input
                  id="edit-monthly-price"
                  type="number"
                  value={editMonthlyPrice}
                  onChange={(e) => setEditMonthlyPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-yearly-price">Yearly Price ($)</Label>
                <Input
                  id="edit-yearly-price"
                  type="number"
                  value={editYearlyPrice}
                  onChange={(e) => setEditYearlyPrice(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-member-limit">Member Limit</Label>
                <Input
                  id="edit-member-limit"
                  type="number"
                  placeholder="Leave blank for unlimited"
                  value={editMemberLimit}
                  onChange={(e) => setEditMemberLimit(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-event-limit">Event Limit</Label>
                <Input
                  id="edit-event-limit"
                  type="number"
                  placeholder="Leave blank for unlimited"
                  value={editEventLimit}
                  onChange={(e) => setEditEventLimit(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Most Popular</Label>
                  <p className="text-xs text-muted-foreground">
                    Show badge on this plan.
                  </p>
                </div>

                <Checkbox
                  checked={editIsPopular}
                  onCheckedChange={(checked) => setEditIsPopular(Boolean(checked))}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-emerald-600" />
                <Label className="text-base font-medium">
                  Included Tools / Modules
                </Label>
              </div>

              <p className="text-sm text-muted-foreground">
                Select which tools are included with this plan by default.
              </p>

              <div className="mt-2 grid grid-cols-2 gap-3">
                {availableModules.map((module) => {
                  const checked = editModules.includes(module.slug)

                  return (
                    <div
                      key={module.id}
                      role="button"
                      tabIndex={0}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        checked
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-border hover:bg-muted/50"
                      }`}
                      onClick={() => toggleEditModule(module.slug)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          toggleEditModule(module.slug)
                        }
                      }}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleEditModule(module.slug)}
                        onClick={(e) => e.stopPropagation()}
                      />

                      <span className="text-sm font-medium">{module.name}</span>
                    </div>
                  )
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                {editModules.length} tools selected
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditPlan(null)}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={savePlanEdit}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
