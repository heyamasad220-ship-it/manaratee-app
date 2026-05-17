"use client"

import { useEffect, useMemo, useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Coffee,
  Download,
  Mail,
  MoreHorizontal,
  Palette,
  Plus,
  Search,
  Store,
  Truck,
  Users,
  Wrench,
} from "lucide-react"
import { cn } from "@/lib/utils"

type VendorCategory = {
  id: string
  name: string
  slug: string | null
  description: string | null
  icon: string | null
  color: string | null
  sort_order: number | null
  is_active: boolean | null
}

type Vendor = {
  id: string
  business_name: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  vendor_type: string | null
  vendor_category_id: string | null
  website_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  tiktok_url: string | null
  youtube_url: string | null
  description_of_products_services: string | null
  status: string | null
  payment_status: string | null
  notes: string | null
}

type VendorForm = {
  business_name: string
  contact_person: string
  email: string
  phone: string
  vendor_category_id: string
  website_url: string
  instagram_url: string
  facebook_url: string
  tiktok_url: string
  youtube_url: string
  description_of_products_services: string
  notes: string
  status: string
}

type CategoryForm = {
  name: string
  description: string
  icon: string
  color: string
  sort_order: string
  is_active: string
}

const emptyVendorForm: VendorForm = {
  business_name: "",
  contact_person: "",
  email: "",
  phone: "",
  vendor_category_id: "",
  website_url: "",
  instagram_url: "",
  facebook_url: "",
  tiktok_url: "",
  youtube_url: "",
  description_of_products_services: "",
  notes: "",
  status: "active",
}

const emptyCategoryForm: CategoryForm = {
  name: "",
  description: "",
  icon: "store",
  color: "emerald",
  sort_order: "0",
  is_active: "true",
}

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export default function VendorsPage() {
  const supabase = createClient()

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [vendorCategories, setVendorCategories] = useState<VendorCategory[]>([])
  const [allVendorCategories, setAllVendorCategories] = useState<VendorCategory[]>([])
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<"all" | string>("all")

  const [addVendorOpen, setAddVendorOpen] = useState(false)
  const [addVendorForm, setAddVendorForm] = useState<VendorForm>(emptyVendorForm)
  const [savingNewVendor, setSavingNewVendor] = useState(false)

  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [editVendorOpen, setEditVendorOpen] = useState(false)
  const [savingVendor, setSavingVendor] = useState(false)

  const [manageTypesOpen, setManageTypesOpen] = useState(false)
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm)
  const [editingCategory, setEditingCategory] = useState<VendorCategory | null>(null)
  const [savingCategory, setSavingCategory] = useState(false)

  useEffect(() => {
    loadPageData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadPageData() {
    setLoading(true)

    const { data: allCategoriesData, error: allCategoriesError } = await supabase
      .from("vendor_categories")
      .select("*")
      .order("sort_order", { ascending: true })

    if (allCategoriesError) {
      console.error("Error loading vendor categories:", allCategoriesError)
      setAllVendorCategories([])
      setVendorCategories([])
    } else {
      const categories = allCategoriesData ?? []
      setAllVendorCategories(categories)
      setVendorCategories(categories.filter((category) => category.is_active === true))
    }

    const { data: vendorsData, error: vendorsError } = await supabase
      .from("vendors")
      .select("*")
      .order("business_name", { ascending: true })

    if (vendorsError) {
      console.error("Error loading vendors:", vendorsError)
      setVendors([])
    } else {
      setVendors(vendorsData ?? [])
    }

    setLoading(false)
  }

  const filteredVendors = useMemo(() => {
    const query = searchQuery.toLowerCase()

    return vendors.filter((vendor) => {
      const category = vendorCategories.find(
        (item) => item.id === vendor.vendor_category_id
      )

      const matchesSearch =
        (vendor.business_name ?? "").toLowerCase().includes(query) ||
        (vendor.contact_person ?? "").toLowerCase().includes(query) ||
        (vendor.email ?? "").toLowerCase().includes(query) ||
        (vendor.phone ?? "").toLowerCase().includes(query) ||
        (vendor.vendor_type ?? "").toLowerCase().includes(query) ||
        (category?.name ?? "").toLowerCase().includes(query) ||
        (vendor.description_of_products_services ?? "").toLowerCase().includes(query)

      const matchesCategory =
        selectedCategoryId === "all" ||
        vendor.vendor_category_id === selectedCategoryId

      return matchesSearch && matchesCategory
    })
  }, [vendors, vendorCategories, searchQuery, selectedCategoryId])

  const selectedCategory = vendorCategories.find(
    (category) => category.id === selectedCategoryId
  )

  function getCategoryCount(category: VendorCategory) {
    return vendors.filter((vendor) => {
      return (
        vendor.vendor_category_id === category.id ||
        (!vendor.vendor_category_id &&
          vendor.vendor_type?.toLowerCase() === category.name.toLowerCase())
      )
    }).length
  }

  function getVendorCategory(vendor: Vendor) {
    return vendorCategories.find((category) => category.id === vendor.vendor_category_id)
  }

  function getCategoryIcon(icon: string | null) {
    switch (icon) {
      case "truck":
        return Truck
      case "coffee":
        return Coffee
      case "wrench":
        return Wrench
      case "palette":
        return Palette
      case "users":
        return Users
      case "store":
      default:
        return Store
    }
  }

  function getCategoryColorClasses(color: string | null) {
    switch (color) {
      case "orange":
        return "bg-orange-50 text-orange-600"
      case "emerald":
        return "bg-emerald-50 text-emerald-600"
      case "blue":
        return "bg-blue-50 text-blue-600"
      case "amber":
        return "bg-amber-50 text-amber-700"
      case "purple":
        return "bg-purple-50 text-purple-600"
      case "cyan":
        return "bg-cyan-50 text-cyan-600"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  function openVendorProfile(vendor: Vendor) {
    setSelectedVendor(vendor)
    setEditVendorOpen(true)
  }

  function startAddCategory() {
    setEditingCategory(null)
    setCategoryForm(emptyCategoryForm)
  }

  function startEditCategory(category: VendorCategory) {
    setEditingCategory(category)
    setCategoryForm({
      name: category.name ?? "",
      description: category.description ?? "",
      icon: category.icon ?? "store",
      color: category.color ?? "emerald",
      sort_order: String(category.sort_order ?? 0),
      is_active: category.is_active === false ? "false" : "true",
    })
  }

  async function saveCategory() {
    if (!categoryForm.name.trim()) return

    setSavingCategory(true)

    const payload = {
      name: categoryForm.name.trim(),
      slug: makeSlug(categoryForm.name),
      description: categoryForm.description.trim() || null,
      icon: categoryForm.icon,
      color: categoryForm.color,
      sort_order: Number(categoryForm.sort_order || 0),
      is_active: categoryForm.is_active === "true",
    }

    if (editingCategory) {
      const { error } = await supabase
        .from("vendor_categories")
        .update(payload)
        .eq("id", editingCategory.id)

      if (error) {
        console.error("Error updating vendor type:", error)
      } else {
        await loadPageData()
        startAddCategory()
      }
    } else {
      const { error } = await supabase
        .from("vendor_categories")
        .insert(payload)

      if (error) {
        console.error("Error adding vendor type:", error)
      } else {
        await loadPageData()
        startAddCategory()
      }
    }

    setSavingCategory(false)
  }

  async function addVendor() {
    setSavingNewVendor(true)

    const selectedCategory = vendorCategories.find(
      (category) => category.id === addVendorForm.vendor_category_id
    )

    const { data, error } = await supabase
      .from("vendors")
      .insert({
        business_name: addVendorForm.business_name || null,
        contact_person: addVendorForm.contact_person || null,
        email: addVendorForm.email || null,
        phone: addVendorForm.phone || null,
        vendor_category_id: addVendorForm.vendor_category_id || null,
        vendor_type: selectedCategory?.name ?? null,
        website_url: addVendorForm.website_url || null,
        instagram_url: addVendorForm.instagram_url || null,
        facebook_url: addVendorForm.facebook_url || null,
        tiktok_url: addVendorForm.tiktok_url || null,
        youtube_url: addVendorForm.youtube_url || null,
        description_of_products_services:
          addVendorForm.description_of_products_services || null,
        notes: addVendorForm.notes || null,
        status: addVendorForm.status || "active",
      })
      .select("*")
      .single()

    if (error) {
      console.error("Error adding vendor:", error)
    } else if (data) {
      setVendors((current) => [...current, data])
      setAddVendorForm(emptyVendorForm)
      setAddVendorOpen(false)
    }

    setSavingNewVendor(false)
  }

  async function saveVendorChanges() {
    if (!selectedVendor) return

    setSavingVendor(true)

    const selectedCategory = vendorCategories.find(
      (category) => category.id === selectedVendor.vendor_category_id
    )

    const { error } = await supabase
      .from("vendors")
      .update({
        business_name: selectedVendor.business_name,
        contact_person: selectedVendor.contact_person,
        email: selectedVendor.email,
        phone: selectedVendor.phone,
        vendor_category_id: selectedVendor.vendor_category_id,
        vendor_type: selectedCategory?.name ?? selectedVendor.vendor_type,
        website_url: selectedVendor.website_url,
        instagram_url: selectedVendor.instagram_url,
        facebook_url: selectedVendor.facebook_url,
        tiktok_url: selectedVendor.tiktok_url,
        youtube_url: selectedVendor.youtube_url,
        description_of_products_services:
          selectedVendor.description_of_products_services,
        status: selectedVendor.status,
        notes: selectedVendor.notes,
      })
      .eq("id", selectedVendor.id)

    if (error) {
      console.error("Error updating vendor:", error)
    } else {
      setVendors((current) =>
        current.map((vendor) =>
          vendor.id === selectedVendor.id
            ? {
                ...selectedVendor,
                vendor_type: selectedCategory?.name ?? selectedVendor.vendor_type,
              }
            : vendor
        )
      )
      setEditVendorOpen(false)
    }

    setSavingVendor(false)
  }

  return (
    <>
      <Header title="Vendors" />

      <div className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Vendor Directory</h1>
              <p className="text-sm text-muted-foreground">
                Manage vendor contacts, categories, and products or services.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
          

              <Button variant="outline" className="gap-2" disabled={vendors.length === 0}>
                <Download className="h-4 w-4" />
                Export Vendors
              </Button>

              <Button onClick={() => setAddVendorOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add New Vendor
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              className={cn(
                "cursor-pointer transition-colors hover:bg-muted/50",
                selectedCategoryId === "all" && "border-primary bg-primary/5"
              )}
              onClick={() => setSelectedCategoryId("all")}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Vendors</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                      {vendors.length}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      All vendor categories
                    </p>
                  </div>

                  <div className="rounded-lg bg-emerald-50 p-2">
                    <Users className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {vendorCategories.map((category) => {
              const Icon = getCategoryIcon(category.icon)
              const colorClasses = getCategoryColorClasses(category.color)

              return (
                <Card
                  key={category.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/50",
                    selectedCategoryId === category.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => setSelectedCategoryId(category.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{category.name}</p>
                        <p className="mt-1 text-2xl font-bold text-foreground">
                          {getCategoryCount(category)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {category.description ?? "Vendor category"}
                        </p>
                      </div>

                      <div className={cn("rounded-lg p-2", colorClasses)}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">
                    {selectedCategoryId === "all"
                      ? "All Vendors"
                      : `${selectedCategory?.name ?? "Selected"} Vendors`}
                  </CardTitle>
                  <CardDescription>
                    A vendor directory organized by your active vendor categories.
                  </CardDescription>
                </div>

                <div className="relative w-full lg:w-[360px]">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search vendor, contact, email, or service..."
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Products / Services</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-12 text-center text-muted-foreground"
                      >
                        Loading vendors...
                      </TableCell>
                    </TableRow>
                  ) : filteredVendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                          <div className="rounded-full bg-muted p-3">
                            <Users className="h-6 w-6 text-muted-foreground" />
                          </div>

                          <div>
                            <p className="font-medium text-foreground">No vendors found</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Add vendors or adjust your search.
                            </p>
                          </div>

                          <Button size="sm" onClick={() => setAddVendorOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add New Vendor
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVendors.map((vendor) => {
                      const category = getVendorCategory(vendor)
                      const Icon = getCategoryIcon(category?.icon ?? null)

                      return (
                        <TableRow key={vendor.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="rounded-lg bg-muted p-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                              </div>

                              <div>
                                <button
                                  type="button"
                                  onClick={() => openVendorProfile(vendor)}
                                  className="font-medium text-primary hover:underline"
                                >
                                  {vendor.business_name || "Unnamed Vendor"}
                                </button>
                                <p className="text-xs text-muted-foreground">
                                  {vendor.contact_person || "No contact listed"}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline">
                              {category?.name ?? vendor.vendor_type ?? "Uncategorized"}
                            </Badge>
                          </TableCell>

                          <TableCell className="max-w-[320px] text-muted-foreground">
                            {vendor.description_of_products_services || "—"}
                          </TableCell>

                          <TableCell>{vendor.phone || "—"}</TableCell>

                          <TableCell>
                            {vendor.email ? (
                              <a
                                href={`mailto:${vendor.email}`}
                                className="text-primary hover:underline"
                              >
                                {vendor.email}
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon">
                                <Mail className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openVendorProfile(vendor)}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </div>
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
      </div>

      <Dialog open={manageTypesOpen} onOpenChange={setManageTypesOpen}>
        <DialogContent className="sm:max-w-[920px]">
          <DialogHeader>
            <DialogTitle>Manage Vendor Types</DialogTitle>
            <DialogDescription>
              Add, edit, hide, and reorder the vendor cards shown at the top of the Vendor Directory.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-2 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="rounded-lg border">
              <div className="border-b p-4">
                <h3 className="text-sm font-medium">Current Vendor Types</h3>
                <p className="text-xs text-muted-foreground">
                  Click Edit to change a vendor type.
                </p>
              </div>

              <div className="max-h-[420px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Icon</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {allVendorCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          No vendor types found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      allVendorCategories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{category.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {category.description || "No description"}
                              </p>
                            </div>
                          </TableCell>

                          <TableCell>{category.icon || "store"}</TableCell>
                          <TableCell>{category.color || "default"}</TableCell>
                          <TableCell>{category.sort_order ?? 0}</TableCell>

                          <TableCell>
                            <Badge variant={category.is_active ? "default" : "secondary"}>
                              {category.is_active ? "Active" : "Hidden"}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEditCategory(category)}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-4">
                <h3 className="text-sm font-medium">
                  {editingCategory ? "Edit Vendor Type" : "Add New Vendor Type"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  These fields control the vendor cards.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input
                    value={categoryForm.name}
                    onChange={(event) =>
                      setCategoryForm({ ...categoryForm, name: event.target.value })
                    }
                    placeholder="Example: Food Truck"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Input
                    value={categoryForm.description}
                    onChange={(event) =>
                      setCategoryForm({ ...categoryForm, description: event.target.value })
                    }
                    placeholder="Example: Mobile food vendors"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Icon</Label>
                  <Select
                    value={categoryForm.icon}
                    onValueChange={(value) =>
                      setCategoryForm({ ...categoryForm, icon: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose icon" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="store">Store</SelectItem>
                      <SelectItem value="truck">Truck</SelectItem>
                      <SelectItem value="coffee">Coffee</SelectItem>
                      <SelectItem value="wrench">Wrench</SelectItem>
                      <SelectItem value="palette">Palette</SelectItem>
                      <SelectItem value="users">Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Color</Label>
                  <Select
                    value={categoryForm.color}
                    onValueChange={(value) =>
                      setCategoryForm({ ...categoryForm, color: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="orange">Orange</SelectItem>
                      <SelectItem value="emerald">Emerald</SelectItem>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="amber">Amber</SelectItem>
                      <SelectItem value="purple">Purple</SelectItem>
                      <SelectItem value="cyan">Cyan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Sort Order</Label>
                  <Input
                    type="number"
                    value={categoryForm.sort_order}
                    onChange={(event) =>
                      setCategoryForm({ ...categoryForm, sort_order: event.target.value })
                    }
                    placeholder="Example: 1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower numbers show first.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={categoryForm.is_active}
                    onValueChange={(value) =>
                      setCategoryForm({ ...categoryForm, is_active: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active / Show Card</SelectItem>
                      <SelectItem value="false">Hidden / Hide Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={saveCategory} disabled={savingCategory}>
                    {savingCategory
                      ? "Saving..."
                      : editingCategory
                        ? "Save Vendor Type"
                        : "Add Vendor Type"}
                  </Button>

                  <Button variant="outline" onClick={startAddCategory}>
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageTypesOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addVendorOpen} onOpenChange={setAddVendorOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Add New Vendor</DialogTitle>
            <DialogDescription>Add a new vendor to the directory.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="business_name">Business Name</Label>
                <Input
                  id="business_name"
                  value={addVendorForm.business_name}
                  onChange={(event) =>
                    setAddVendorForm({
                      ...addVendorForm,
                      business_name: event.target.value,
                    })
                  }
                  placeholder="Enter business name"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  value={addVendorForm.contact_person}
                  onChange={(event) =>
                    setAddVendorForm({
                      ...addVendorForm,
                      contact_person: event.target.value,
                    })
                  }
                  placeholder="Enter contact name"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={addVendorForm.email}
                  onChange={(event) =>
                    setAddVendorForm({
                      ...addVendorForm,
                      email: event.target.value,
                    })
                  }
                  placeholder="Enter email address"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={addVendorForm.phone}
                  onChange={(event) =>
                    setAddVendorForm({
                      ...addVendorForm,
                      phone: event.target.value,
                    })
                  }
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Vendor Category</Label>
              <Select
                value={addVendorForm.vendor_category_id}
                onValueChange={(value) =>
                  setAddVendorForm({
                    ...addVendorForm,
                    vendor_category_id: value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>

                <SelectContent>
                  {vendorCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-4">
                <h3 className="text-sm font-medium">Social Media</h3>
                <p className="text-xs text-muted-foreground">
                  Add social links and website information.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={addVendorForm.website_url}
                    onChange={(event) =>
                      setAddVendorForm({
                        ...addVendorForm,
                        website_url: event.target.value,
                      })
                    }
                    placeholder="https://example.com"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    value={addVendorForm.instagram_url}
                    onChange={(event) =>
                      setAddVendorForm({
                        ...addVendorForm,
                        instagram_url: event.target.value,
                      })
                    }
                    placeholder="https://instagram.com/vendor"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="facebook">Facebook</Label>
                  <Input
                    id="facebook"
                    value={addVendorForm.facebook_url}
                    onChange={(event) =>
                      setAddVendorForm({
                        ...addVendorForm,
                        facebook_url: event.target.value,
                      })
                    }
                    placeholder="https://facebook.com/vendor"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tiktok">TikTok</Label>
                  <Input
                    id="tiktok"
                    value={addVendorForm.tiktok_url}
                    onChange={(event) =>
                      setAddVendorForm({
                        ...addVendorForm,
                        tiktok_url: event.target.value,
                      })
                    }
                    placeholder="https://tiktok.com/@vendor"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">
                Description of Products / Services
              </Label>

              <Textarea
                id="description"
                value={addVendorForm.description_of_products_services}
                onChange={(event) =>
                  setAddVendorForm({
                    ...addVendorForm,
                    description_of_products_services: event.target.value,
                  })
                }
                placeholder="Describe products, menu items, services, specialties, or offerings"
                className="min-h-[110px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddVendorOpen(false)}>
              Cancel
            </Button>

            <Button onClick={addVendor} disabled={savingNewVendor}>
              {savingNewVendor ? "Adding..." : "Add Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editVendorOpen} onOpenChange={setEditVendorOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Edit Vendor Profile</DialogTitle>
            <DialogDescription>
              Update vendor contact information, category, social links, and description.
            </DialogDescription>
          </DialogHeader>

          {selectedVendor && (
            <div className="grid gap-5 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="edit-business-name">Business Name</Label>
                  <Input
                    id="edit-business-name"
                    value={selectedVendor.business_name ?? ""}
                    onChange={(event) =>
                      setSelectedVendor({
                        ...selectedVendor,
                        business_name: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-contact-person">Contact Person</Label>
                  <Input
                    id="edit-contact-person"
                    value={selectedVendor.contact_person ?? ""}
                    onChange={(event) =>
                      setSelectedVendor({
                        ...selectedVendor,
                        contact_person: event.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={selectedVendor.email ?? ""}
                    onChange={(event) =>
                      setSelectedVendor({
                        ...selectedVendor,
                        email: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={selectedVendor.phone ?? ""}
                    onChange={(event) =>
                      setSelectedVendor({
                        ...selectedVendor,
                        phone: event.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Vendor Category</Label>
                  <Select
                    value={selectedVendor.vendor_category_id ?? ""}
                    onValueChange={(value) =>
                      setSelectedVendor({
                        ...selectedVendor,
                        vendor_category_id: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>

                    <SelectContent>
                      {vendorCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={selectedVendor.status ?? "active"}
                    onValueChange={(value) =>
                      setSelectedVendor({
                        ...selectedVendor,
                        status: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="mb-4">
                  <h3 className="text-sm font-medium">Social Media</h3>
                  <p className="text-xs text-muted-foreground">
                    Vendor website and social media links.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-website">Website</Label>
                    <Input
                      id="edit-website"
                      value={selectedVendor.website_url ?? ""}
                      onChange={(event) =>
                        setSelectedVendor({
                          ...selectedVendor,
                          website_url: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-instagram">Instagram</Label>
                    <Input
                      id="edit-instagram"
                      value={selectedVendor.instagram_url ?? ""}
                      onChange={(event) =>
                        setSelectedVendor({
                          ...selectedVendor,
                          instagram_url: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-facebook">Facebook</Label>
                    <Input
                      id="edit-facebook"
                      value={selectedVendor.facebook_url ?? ""}
                      onChange={(event) =>
                        setSelectedVendor({
                          ...selectedVendor,
                          facebook_url: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-tiktok">TikTok</Label>
                    <Input
                      id="edit-tiktok"
                      value={selectedVendor.tiktok_url ?? ""}
                      onChange={(event) =>
                        setSelectedVendor({
                          ...selectedVendor,
                          tiktok_url: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-description">
                  Description of Products / Services
                </Label>
                <Textarea
                  id="edit-description"
                  value={selectedVendor.description_of_products_services ?? ""}
                  onChange={(event) =>
                    setSelectedVendor({
                      ...selectedVendor,
                      description_of_products_services: event.target.value,
                    })
                  }
                  className="min-h-[110px]"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-notes">Internal Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={selectedVendor.notes ?? ""}
                  onChange={(event) =>
                    setSelectedVendor({
                      ...selectedVendor,
                      notes: event.target.value,
                    })
                  }
                  className="min-h-[90px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditVendorOpen(false)}>
              Cancel
            </Button>

            <Button
              disabled={!selectedVendor || savingVendor}
              onClick={saveVendorChanges}
            >
              {savingVendor ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}