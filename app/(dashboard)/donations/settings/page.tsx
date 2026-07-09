"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { DonationReceiptSettingsForm } from "@/components/donations/donation-receipt-settings-form"
import { PledgeReminderSettingsForm } from "@/components/donations/pledge-reminder-settings-form"
import { DonationStripeConnectPanel } from "@/components/donations/donation-stripe-connect-panel"

const settingsTabs = ["General", "Categories", "Online Payments", "Receipts", "Pledge Reminders", "Notifications"] as const
type SettingsTab = (typeof settingsTabs)[number]

function DonationSettingsTabSync({
  onSelectTab,
}: {
  onSelectTab: (tab: SettingsTab) => void
}) {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("tab") === "online-payments") {
      onSelectTab("Online Payments")
    }
  }, [onSelectTab, searchParams])

  return null
}

interface Category {
  id: string
  name: string
  description: string
  taxDeductible: boolean
}

interface DonationFund {
  id: string
  name: string
  categoryId: string
  categoryName: string
  isActive: boolean
}

export default function DonationsSettingsPage() {
  return (
    <Suspense fallback={<DonationsSettingsPageFallback />}>
      <DonationsSettingsPageContent />
    </Suspense>
  )
}

function DonationsSettingsPageFallback() {
  return (
    <>
      <Header title="Donations Settings" />
      <div className="p-6 text-sm text-muted-foreground">Loading settings...</div>
    </>
  )
}

function DonationsSettingsPageContent() {
  const supabase = createClient()
  async function getOrganizationId() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  if (error) {
    console.error("Error loading organization:", error)
    return null
  }

  return data?.organization_id || null
}
  const [activeTab, setActiveTab] = useState<SettingsTab>("General")
  const [categories, setCategories] = useState<Category[]>([])
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false)
  const [categoryName, setCategoryName] = useState("")
const [categoryDescription, setCategoryDescription] = useState("")
const [editingCategory, setEditingCategory] = useState<Category | null>(null)
const [categoryTaxDeductible, setCategoryTaxDeductible] = useState(true)
  const [funds, setFunds] = useState<DonationFund[]>([])
  const [showFundDialog, setShowFundDialog] = useState(false)
  const [fundName, setFundName] = useState("")
  const [fundCategoryId, setFundCategoryId] = useState("")
  const [fundIsActive, setFundIsActive] = useState(true)
  const [editingFund, setEditingFund] = useState<DonationFund | null>(null)
async function handleAddCategory() {
  const orgId = await getOrganizationId()

  if (!orgId) {
    alert("No organization found.")
    return
  }

  if (!categoryName.trim()) {
    alert("Category name is required.")
    return
  }

  const { error } = await supabase.from("donation_categories").insert({
    organization_id: orgId,
    name: categoryName.trim(),
    description: categoryDescription.trim() || null,
    tax_deductible: categoryTaxDeductible,
  })

  if (error) {
    alert(error.message)
    return
  }

  setCategoryName("")
  setCategoryDescription("")
  setCategoryTaxDeductible(true)
  setShowAddCategoryDialog(false)

  await loadCategories()
}

async function loadCategories() {
  const orgId = await getOrganizationId()

  if (!orgId) {
    setCategories([])
    return
  }

  const { data, error } = await supabase
    .from("donation_categories")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error loading categories:", error)
    setCategories([])
    return
  }

  setCategories(
    (data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description || "",
      taxDeductible: c.tax_deductible || false,
    }))
  )
}

async function loadFunds() {
  const orgId = await getOrganizationId()

  if (!orgId) {
    setFunds([])
    return
  }

  const { data, error } = await supabase
    .from("donation_subcategories")
    .select("id, name, category_id, is_active")
    .eq("organization_id", orgId)
    .order("name", { ascending: true })

  if (error) {
    console.error("Error loading donation funds:", error)
    setFunds([])
    return
  }

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]))

  setFunds(
    (data || []).map((fund: any) => ({
      id: fund.id,
      name: fund.name,
      categoryId: fund.category_id,
      categoryName: categoryNameById.get(fund.category_id) || "Unknown category",
      isActive: fund.is_active !== false,
    }))
  )
}

async function handleSaveFund() {
  const orgId = await getOrganizationId()

  if (!orgId) {
    alert("No organization found.")
    return
  }

  if (!fundName.trim()) {
    alert("Fund name is required.")
    return
  }

  if (!fundCategoryId) {
    alert("Select a category for this fund.")
    return
  }

  const payload = {
    organization_id: orgId,
    category_id: fundCategoryId,
    name: fundName.trim(),
    is_active: fundIsActive,
  }

  const { error } = editingFund
    ? await supabase
        .from("donation_subcategories")
        .update({
          category_id: fundCategoryId,
          name: fundName.trim(),
          is_active: fundIsActive,
        })
        .eq("id", editingFund.id)
        .eq("organization_id", orgId)
    : await supabase.from("donation_subcategories").insert(payload)

  if (error) {
    alert(error.message)
    return
  }

  resetFundForm()
  await loadFunds()
}

function resetFundForm() {
  setEditingFund(null)
  setFundName("")
  setFundCategoryId("")
  setFundIsActive(true)
  setShowFundDialog(false)
}

function openAddFundDialog(categoryId?: string) {
  resetFundForm()
  if (categoryId) {
    setFundCategoryId(categoryId)
  }
  setShowFundDialog(true)
}

async function handleDeleteFund(fundId: string) {
  if (!confirm("Delete this fund? Existing pledges and payments keep their records.")) {
    return
  }

  const orgId = await getOrganizationId()

  if (!orgId) {
    alert("No organization found.")
    return
  }

  const { error } = await supabase
    .from("donation_subcategories")
    .delete()
    .eq("id", fundId)
    .eq("organization_id", orgId)

  if (error) {
    alert(error.message)
    return
  }

  await loadFunds()
}

useEffect(() => {
  void loadCategories()
}, [])

useEffect(() => {
  void loadFunds()
}, [categories])

async function handleDeleteCategory(categoryId: string) {
  if (!confirm("Delete this category?")) return

  const { error } = await supabase
    .from("donation_categories")
    .delete()
    .eq("id", categoryId)

  if (error) {
    alert(error.message)
    return
  }

  await loadCategories()
}
async function handleSaveCategory() {
  const orgId = await getOrganizationId()

  if (!orgId) {
    alert("No organization found.")
    return
  }

  if (!categoryName.trim()) {
    alert("Category name is required.")
    return
  }

  if (editingCategory) {
    const { error } = await supabase
      .from("donation_categories")
      .update({
        name: categoryName.trim(),
        description: categoryDescription.trim() || null,
        tax_deductible: categoryTaxDeductible,
      })
      .eq("id", editingCategory.id)
      .eq("organization_id", orgId)

    if (error) {
      alert(error.message)
      return
    }
  } else {
    const { error } = await supabase.from("donation_categories").insert({
      organization_id: orgId,
      name: categoryName.trim(),
      description: categoryDescription.trim() || null,
      tax_deductible: categoryTaxDeductible,
    })

    if (error) {
      alert(error.message)
      return
    }
  }

  setEditingCategory(null)
  setCategoryName("")
  setCategoryDescription("")
  setCategoryTaxDeductible(true)
  setShowAddCategoryDialog(false)

  await loadCategories()
}

  return (
    <>
      <DonationSettingsTabSync onSelectTab={setActiveTab} />
      <Header title="Donations Settings" />
      <div className="p-6">
        <div className="mb-6 flex gap-0 border-b border-border">
          {settingsTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
              )}
            </button>
          ))}
        </div>

        {activeTab === "General" && (
          <div className="flex flex-col gap-6">
            <DonationReceiptSettingsForm mode="general" />
          </div>
        )}

        {activeTab === "Categories" && (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Donation Categories</h3>
                  <p className="text-sm text-muted-foreground">
                    Top-level gift types for accounting and tax treatment (not campaigns)
                  </p>
                </div>
                <Button onClick={() => setShowAddCategoryDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Tax Deductible</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                            No categories yet. Add a category before creating funds.
                          </TableCell>
                        </TableRow>
                      ) : (
                        categories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell className="font-medium">{category.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {category.description}
                            </TableCell>
                            <TableCell>{category.taxDeductible ? "Yes" : "No"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditingCategory(category)
                                    setCategoryName(category.name)
                                    setCategoryDescription(category.description)
                                    setCategoryTaxDeductible(category.taxDeductible)
                                    setShowAddCategoryDialog(true)
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                  onClick={() => handleDeleteCategory(category.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Funds</h3>
                  <p className="text-sm text-muted-foreground">
                    Specific designations under a category (e.g. Operations → Bathroom Renovation)
                  </p>
                </div>
                <Button onClick={() => openAddFundDialog()} disabled={categories.length === 0}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Fund
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Fund</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {funds.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                            {categories.length === 0
                              ? "Create a category first, then add funds under it."
                              : "No funds yet. Add funds like Bathroom Renovation under Operations."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        funds.map((fund) => (
                          <TableRow key={fund.id}>
                            <TableCell className="text-muted-foreground">{fund.categoryName}</TableCell>
                            <TableCell className="font-medium">{fund.name}</TableCell>
                            <TableCell>
                              {fund.isActive ? (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                                  Open
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                                  Closed
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditingFund(fund)
                                    setFundName(fund.name)
                                    setFundCategoryId(fund.categoryId)
                                    setFundIsActive(fund.isActive)
                                    setShowFundDialog(true)
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                  onClick={() => void handleDeleteFund(fund.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "Online Payments" && (
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading Stripe Connect...</p>}>
            <DonationStripeConnectPanel />
          </Suspense>
        )}

        {activeTab === "Receipts" && <DonationReceiptSettingsForm mode="receipts" />}

        {activeTab === "Pledge Reminders" && <PledgeReminderSettingsForm />}

        {activeTab === "Notifications" && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>Configure when to send donation-related emails</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>New Donation Notification</Label>
                      <p className="text-sm text-muted-foreground">
                        Notify admins when a new donation is received
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Large Donation Alert</Label>
                      <p className="text-sm text-muted-foreground">
                        Send alert for donations over a certain amount
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="large-donation-threshold">Large Donation Threshold</Label>
                  <div className="relative w-[200px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input id="large-donation-threshold" type="number" defaultValue="1000" className="pl-7" />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Recurring Donation Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Send reminders before recurring donations are processed
                      </p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button>Save Changes</Button>
            </div>
          </div>
        )}
      </div>
        {/* Add/Edit Category Dialog */}
<Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>
        {editingCategory ? "Edit Donation Category" : "Add Donation Category"}
      </DialogTitle>
      <DialogDescription>
        {editingCategory
          ? "Update this donation category"
          : "Create a new category for organizing donations"}
      </DialogDescription>
    </DialogHeader>

    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="cat-name">Category Name</Label>
        <Input
          id="cat-name"
          placeholder="e.g., Operations"
          value={categoryName}
          onChange={(event) => setCategoryName(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cat-description">Description</Label>
        <Textarea
          id="cat-description"
          placeholder="Brief description of this category"
          rows={2}
          value={categoryDescription}
          onChange={(event) => setCategoryDescription(event.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="cat-tax"
          checked={categoryTaxDeductible}
          onCheckedChange={setCategoryTaxDeductible}
        />
        <Label htmlFor="cat-tax">Tax Deductible</Label>
      </div>
    </div>

    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => {
          setEditingCategory(null)
          setCategoryName("")
          setCategoryDescription("")
          setCategoryTaxDeductible(true)
          setShowAddCategoryDialog(false)
        }}
      >
        Cancel
      </Button>

      <Button onClick={handleSaveCategory}>
        {editingCategory ? "Save Changes" : "Add Category"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

        <Dialog open={showFundDialog} onOpenChange={setShowFundDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingFund ? "Edit Fund" : "Add Fund"}</DialogTitle>
              <DialogDescription>
                Funds are subcategories under a donation category. Open funds appear in the Fund
                dropdown on pledges, payments, and the customer portal.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="fund-category">Category</Label>
                <Select value={fundCategoryId} onValueChange={setFundCategoryId}>
                  <SelectTrigger id="fund-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="fund-name">Fund Name</Label>
                <Input
                  id="fund-name"
                  placeholder="e.g., Bathroom Renovation"
                  value={fundName}
                  onChange={(event) => setFundName(event.target.value)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="fund-active">Accept new gifts</Label>
                  <p className="text-sm text-muted-foreground">
                    Turn off when a time-limited fund is done collecting (e.g. Zakat Al Fitr 2023).
                    Closed funds stay on past gifts but disappear from donation pickers.
                  </p>
                </div>
                <Switch
                  id="fund-active"
                  checked={fundIsActive}
                  onCheckedChange={setFundIsActive}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetFundForm}>
                Cancel
              </Button>
              <Button onClick={() => void handleSaveFund()}>
                {editingFund ? "Save Changes" : "Add Fund"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

    </>
  )
}
