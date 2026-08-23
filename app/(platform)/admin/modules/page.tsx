"use client"

import { useState, useEffect } from "react"
import { PlatformHeader } from "@/components/platform/platform-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
import { Pencil, Boxes, Calendar, Ticket, Store, GraduationCap, Heart } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  isCapabilityModuleSlug,
  isCoreModuleSlug,
  isProductModuleSlug,
} from "@/lib/modules/module-catalog"

type Module = {
  id: string
  name: string
  slug: string
  description: string | null
  is_core: boolean
  is_active: boolean
  default_enabled: boolean
  include_in_catalog?: boolean
  price_monthly: number
  price_yearly: number
}

const moduleIcons: Record<string, React.ElementType> = {
  bookings: Calendar,
  ticketing: Ticket,
  bazaar: Store,
  programs: GraduationCap,
  donations: Heart,
}

export default function ModulesPage() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state for editing
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")

  useEffect(() => {
    fetchModules()
  }, [])

  async function fetchModules() {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .order("name")

    if (error) {
      console.error("Error fetching modules:", error)
    } else {
      // Add is_active and default_enabled if not present
      const modulesWithDefaults = (data || []).map((m) => ({
        ...m,
        is_active: m.is_active ?? true,
        default_enabled: m.default_enabled ?? false,
        include_in_catalog:
          m.include_in_catalog ??
          (isProductModuleSlug(m.slug) &&
            !isCoreModuleSlug(m.slug) &&
            !isCapabilityModuleSlug(m.slug)),
      }))
      setModules(modulesWithDefaults)
    }
    setLoading(false)
  }

  async function toggleModuleActive(module: Module) {
    const supabase = createClient()
    const newValue = !module.is_active
    
    const { error } = await supabase
      .from("modules")
      .update({ is_active: newValue })
      .eq("id", module.id)

    if (error) {
      console.error("Error updating module:", error)
    } else {
      setModules((prev) =>
        prev.map((m) => (m.id === module.id ? { ...m, is_active: newValue } : m))
      )
    }
  }

  async function toggleDefaultEnabled(module: Module) {
    const supabase = createClient()
    const newValue = !module.default_enabled
    
    const { error } = await supabase
      .from("modules")
      .update({ default_enabled: newValue })
      .eq("id", module.id)

    if (error) {
      console.error("Error updating module:", error)
    } else {
      setModules((prev) =>
        prev.map((m) => (m.id === module.id ? { ...m, default_enabled: newValue } : m))
      )
    }
  }

  function openEditDialog(module: Module) {
    setEditingModule(module)
    setEditName(module.name)
    setEditDescription(module.description || "")
    setEditDialogOpen(true)
  }

  async function saveModuleEdit() {
    if (!editingModule) return
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from("modules")
      .update({
        name: editName,
        description: editDescription,
      })
      .eq("id", editingModule.id)

    if (error) {
      console.error("Error saving module:", error)
    } else {
      setModules((prev) =>
        prev.map((m) =>
          m.id === editingModule.id
            ? { ...m, name: editName, description: editDescription }
            : m
        )
      )
      setEditDialogOpen(false)
      setEditingModule(null)
    }
    setSaving(false)
  }

  const activeCount = modules.filter((m) => m.is_active).length
  const defaultEnabledCount = modules.filter((m) => m.default_enabled).length
  const catalogCount = modules.filter((m) => m.include_in_catalog).length

  function catalogLabel(module: Module) {
    if (module.is_core || isCoreModuleSlug(module.slug)) return "Core"
    if (isCapabilityModuleSlug(module.slug) || !isProductModuleSlug(module.slug)) {
      return "Capability"
    }
    if (module.include_in_catalog) return "Product"
    return "Capability"
  }

  return (
    <>
      <PlatformHeader title="Modules" />
      <div className="flex flex-col gap-6 p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="border border-border shadow-sm">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Modules</p>
                <p className="mt-0.5 text-2xl font-bold text-foreground">{modules.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-sm">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Modules</p>
                <p className="mt-0.5 text-2xl font-bold text-foreground">{activeCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-sm">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Default Enabled</p>
                <p className="mt-0.5 text-2xl font-bold text-foreground">{defaultEnabledCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-sm">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Catalog Modules</p>
                <p className="mt-0.5 text-2xl font-bold text-foreground">{catalogCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modules Table */}
        <Card className="border border-border shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">All Modules</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium text-muted-foreground">Module Name</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Description</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Catalog</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Status</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Default Enabled</TableHead>
                  <TableHead className="font-medium text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Loading modules...
                    </TableCell>
                  </TableRow>
                ) : modules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No modules found.
                    </TableCell>
                  </TableRow>
                ) : (
                  modules.map((module) => {
                    const IconComponent = moduleIcons[module.slug] || Boxes
                    return (
                      <TableRow key={module.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                              <IconComponent className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{module.name}</p>
                              <p className="text-xs text-muted-foreground">{module.slug}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <p className="text-sm text-muted-foreground truncate">
                            {module.description || "No description"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              catalogLabel(module) === "Product"
                                ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
                                : catalogLabel(module) === "Core"
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-100"
                            }
                          >
                            {catalogLabel(module)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={module.is_active}
                              onCheckedChange={() => toggleModuleActive(module)}
                              disabled={module.is_core}
                            />
                            <Badge
                              variant="secondary"
                              className={
                                module.is_active
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-100"
                              }
                            >
                              {module.is_active ? "Active" : "Inactive"}
                            </Badge>
                            {module.is_core && (
                              <Badge variant="outline" className="text-xs">
                                Core
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={module.default_enabled}
                            onCheckedChange={() => toggleDefaultEnabled(module)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(module)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
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

      {/* Edit Module Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Module</DialogTitle>
            <DialogDescription>
              Update the module name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Module Name</Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Module name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Module description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveModuleEdit} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
