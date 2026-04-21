"use client"

import { useState } from "react"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Pencil, Check, Boxes, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"

interface Module {
  id: string
  name: string
  slug: string
}

const availableModules: Module[] = [
  { id: "mod-1", name: "Bookings", slug: "bookings" },
  { id: "mod-2", name: "Ticketing", slug: "ticketing" },
  { id: "mod-3", name: "Bazaar", slug: "bazaar" },
  { id: "mod-4", name: "Programs", slug: "programs" },
  { id: "mod-5", name: "Donations", slug: "donations" },
  { id: "mod-6", name: "Contacts", slug: "contacts" },
  { id: "mod-7", name: "Human Resources", slug: "hr" },
]

interface Plan {
  id: string
  name: string
  price: number
  billing: string
  orgs: number
  features: string[]
  modules: string[] // module slugs
  color: string
  popular?: boolean
}

const initialPlans: Plan[] = [
  {
    id: "plan-1",
    name: "Free",
    price: 0,
    billing: "Forever",
    orgs: 32,
    features: ["Up to 50 members", "5 events per month", "Basic reporting", "Email support"],
    modules: ["bookings", "contacts"],
    color: "border-zinc-200 bg-zinc-50",
  },
  {
    id: "plan-2",
    name: "Starter",
    price: 100,
    billing: "/month",
    orgs: 47,
    features: ["Up to 200 members", "20 events per month", "Advanced reporting", "Priority email support", "Custom branding"],
    modules: ["bookings", "ticketing", "contacts", "programs"],
    color: "border-blue-200 bg-blue-50",
  },
  {
    id: "plan-3",
    name: "Professional",
    price: 200,
    billing: "/month",
    orgs: 49,
    popular: true,
    features: ["Up to 1,000 members", "Unlimited events", "Advanced analytics", "Priority support", "Custom branding", "API access", "Venue rentals"],
    modules: ["bookings", "ticketing", "bazaar", "programs", "donations", "contacts"],
    color: "border-emerald-200 bg-emerald-50",
  },
  {
    id: "plan-4",
    name: "Enterprise",
    price: 900,
    billing: "/month",
    orgs: 14,
    features: ["Unlimited members", "Unlimited events", "Custom analytics", "Dedicated support", "White-label option", "Full API access", "Venue rentals", "SSO integration"],
    modules: ["bookings", "ticketing", "bazaar", "programs", "donations", "contacts", "hr"],
    color: "border-amber-200 bg-amber-50",
  },
]

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [addPlanOpen, setAddPlanOpen] = useState(false)
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [editModules, setEditModules] = useState<string[]>([])

  const handleEditPlan = (plan: Plan) => {
    setEditPlan(plan)
    setEditModules([...plan.modules])
  }

  const toggleEditModule = (slug: string) => {
    setEditModules(prev => 
      prev.includes(slug) 
        ? prev.filter(m => m !== slug)
        : [...prev, slug]
    )
  }

  const savePlanModules = () => {
    if (!editPlan) return
    setPlans(prev => 
      prev.map(p => p.id === editPlan.id ? { ...p, modules: editModules } : p)
    )
    setEditPlan(null)
  }

  return (
    <>
      <PlatformHeader title="Subscription Plans" />
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {plans.length} plans configured -- {plans.reduce((s, p) => s + p.orgs, 0)} total organizations
            </p>
          </div>
          <Button className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setAddPlanOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Plan
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-5">
          {plans.map((plan) => (
            <Card key={plan.id} className={`relative border-2 shadow-sm ${plan.color}`}>
              {plan.popular && (
                <Badge className="absolute -top-2.5 right-4 bg-emerald-600 text-white hover:bg-emerald-600">
                  Most Popular
                </Badge>
              )}
              <CardContent className="flex flex-col gap-5 p-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">
                      ${plan.price.toLocaleString("en-US")}
                    </span>
                    <span className="text-sm text-muted-foreground">{plan.billing}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {plan.orgs} organizations on this plan
                  </p>
                </div>

                <div className="flex flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </div>
                  ))}
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
                          className={included 
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200" 
                            : "text-muted-foreground opacity-50"
                          }
                        >
                          {included && <Check className="mr-1 h-3 w-3" />}
                          {!included && <X className="mr-1 h-3 w-3" />}
                          {module.name}
                        </Badge>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {plan.modules.length} of {availableModules.length} modules
                  </p>
                </div>

                <Button variant="outline" className="mt-auto gap-1.5" onClick={() => handleEditPlan(plan)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Plan
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Add Plan Dialog */}
      <Dialog open={addPlanOpen} onOpenChange={setAddPlanOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add New Plan</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="plan-name">Plan Name</Label>
              <Input id="plan-name" placeholder="e.g. Professional Plus" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-price">Monthly Price ($)</Label>
                <Input id="plan-price" type="number" placeholder="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-members">Member Limit</Label>
                <Input id="plan-members" type="number" placeholder="e.g. 500" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="plan-features">Features (one per line)</Label>
              <Textarea id="plan-features" placeholder="Up to 500 members&#10;Unlimited events&#10;Advanced analytics" rows={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPlanOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setAddPlanOpen(false)}>
              Create Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={!!editPlan} onOpenChange={(open) => !open && setEditPlan(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit Plan: {editPlan?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-5 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-plan-name">Plan Name</Label>
                <Input id="edit-plan-name" defaultValue={editPlan?.name} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-plan-price">Monthly Price ($)</Label>
                <Input id="edit-plan-price" type="number" defaultValue={editPlan?.price} />
              </div>
            </div>
            
            <Separator />
            
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-emerald-600" />
                <Label className="text-base font-medium">Included Modules</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Select which modules are included with this plan by default.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {availableModules.map((module) => (
                  <div
                    key={module.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      editModules.includes(module.slug)
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => toggleEditModule(module.slug)}
                  >
                    <Checkbox 
                      checked={editModules.includes(module.slug)}
                      onCheckedChange={() => toggleEditModule(module.slug)}
                    />
                    <span className="text-sm font-medium">{module.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {editModules.length} modules selected
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlan(null)}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={savePlanModules}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
