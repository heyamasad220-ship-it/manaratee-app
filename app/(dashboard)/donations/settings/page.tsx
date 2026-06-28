"use client"

import { useEffect, useState } from "react"
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

const settingsTabs = ["General", "Categories", "Payment Methods", "Receipts", "Pledge Reminders", "Notifications"] as const
type SettingsTab = (typeof settingsTabs)[number]

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
}

interface PaymentMethod {
  id: string
  name: string
  enabled: boolean
  fee: string
}

export default function DonationsSettingsPage() {
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false)
  const [categoryName, setCategoryName] = useState("")
const [categoryDescription, setCategoryDescription] = useState("")
const [editingCategory, setEditingCategory] = useState<Category | null>(null)
const [categoryTaxDeductible, setCategoryTaxDeductible] = useState(true)
  const [funds, setFunds] = useState<DonationFund[]>([])
  const [showFundDialog, setShowFundDialog] = useState(false)
  const [fundName, setFundName] = useState("")
  const [fundCategoryId, setFundCategoryId] = useState("")
  const [editingFund, setEditingFund] = useState<DonationFund | null>(null)
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | null>(null)
const [paymentMethodName, setPaymentMethodName] = useState("")
const [paymentMethodFee, setPaymentMethodFee] = useState("")
const [paymentMethodEnabled, setPaymentMethodEnabled] = useState(true)
const [showPaymentMethodDialog, setShowPaymentMethodDialog] = useState(false)
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
    .select("id, name, category_id")
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
  }

  const { error } = editingFund
    ? await supabase
        .from("donation_subcategories")
        .update({ category_id: fundCategoryId, name: fundName.trim() })
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

async function handleSavePaymentMethod() {
  const orgId = await getOrganizationId()

  if (!orgId) {
    alert("No organization found.")
    return
  }

  if (!paymentMethodName.trim()) {
    alert("Payment method name is required.")
    return
  }

  const payload = {
    name: paymentMethodName.trim(),
    fee: paymentMethodFee.trim() || "None",
    enabled: paymentMethodEnabled,
  }

  const { error } = editingPaymentMethod
    ? await supabase
        .from("payment_methods")
        .update(payload)
        .eq("id", editingPaymentMethod.id)
        .eq("organization_id", orgId)
    : await supabase.from("payment_methods").insert({
        organization_id: orgId,
        ...payload,
      })

  if (error) {
    alert(error.message)
    return
  }

  setEditingPaymentMethod(null)
  setPaymentMethodName("")
  setPaymentMethodFee("")
  setPaymentMethodEnabled(true)
  setShowPaymentMethodDialog(false)

  await loadPaymentMethods()
}

function resetPaymentMethodForm() {
  setEditingPaymentMethod(null)
  setPaymentMethodName("")
  setPaymentMethodFee("")
  setPaymentMethodEnabled(true)
}

function openAddPaymentMethodDialog() {
  resetPaymentMethodForm()
  setShowPaymentMethodDialog(true)
}
async function handleDeletePaymentMethod(methodId: string) {
  if (
    !confirm(
      "Delete this payment method? Existing donation records are kept; their payment method link will be cleared."
    )
  ) {
    return
  }

  const orgId = await getOrganizationId()

  if (!orgId) {
    alert("No organization found.")
    return
  }

  const { error } = await supabase
    .from("payment_methods")
    .delete()
    .eq("id", methodId)
    .eq("organization_id", orgId)

  if (error) {
    alert(error.message)
    return
  }

  await loadPaymentMethods()
}
async function loadPaymentMethods() {
  const orgId = await getOrganizationId()

  if (!orgId) {
    setPaymentMethods([])
    return
  }

  const { data, error } = await supabase
    .from("payment_methods")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error loading payment methods:", error)
    setPaymentMethods([])
    return
  }

  setPaymentMethods(
    (data || []).map((pm: any) => ({
      id: pm.id,
      name: pm.name,
      enabled: pm.enabled || false,
      fee: pm.fee || "None",
    }))
  )
}

useEffect(() => {
  void loadCategories()
  void loadPaymentMethods()
}, [])

useEffect(() => {
  void loadFunds()
}, [categories])

async function handleTogglePaymentMethod(methodId: string, enabled: boolean) {
  const orgId = await getOrganizationId()

  if (!orgId) {
    alert("No organization found.")
    return
  }

  const { error } = await supabase
    .from("payment_methods")
    .update({ enabled })
    .eq("id", methodId)
    .eq("organization_id", orgId)

  if (error) {
    alert(error.message)
    return
  }

  await loadPaymentMethods()
}
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
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {funds.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
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
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditingFund(fund)
                                    setFundName(fund.name)
                                    setFundCategoryId(fund.categoryId)
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

        {activeTab === "Payment Methods" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Payment Methods</h3>
                <p className="text-sm text-muted-foreground">
                  Configure accepted payment methods for donations
                </p>
              </div>
              <Button onClick={openAddPaymentMethodDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Payment Method
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Method</TableHead>
                      <TableHead>Processing Fee</TableHead>
                      <TableHead>Enabled</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentMethods.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          No payment methods yet. Add one to accept donations through your portal and
                          staff forms.
                        </TableCell>
                      </TableRow>
                    )}
                    {paymentMethods.map((method) => (
                      <TableRow key={method.id}>
                        <TableCell className="font-medium">{method.name}</TableCell>
                        <TableCell className="text-muted-foreground">{method.fee}</TableCell>
                        <TableCell>
                          <Switch
                            checked={method.enabled}
                            onCheckedChange={(checked) => handleTogglePaymentMethod(method.id, checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingPaymentMethod(method)
                                setPaymentMethodName(method.name)
                                setPaymentMethodFee(method.fee)
                                setPaymentMethodEnabled(method.enabled)
                                setShowPaymentMethodDialog(true)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                              onClick={() => handleDeletePaymentMethod(method.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
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
      {/* Add/Edit Payment Method Dialog */}
<Dialog
  open={showPaymentMethodDialog}
  onOpenChange={(open) => {
    setShowPaymentMethodDialog(open)
    if (!open) resetPaymentMethodForm()
  }}
>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>
        {editingPaymentMethod ? "Edit Payment Method" : "Add Payment Method"}
      </DialogTitle>
      <DialogDescription>
        {editingPaymentMethod
          ? "Update this accepted payment method"
          : "Create a custom payment method for donations"}
      </DialogDescription>
    </DialogHeader>

    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="payment-method-name">Method Name</Label>
        <Input
          id="payment-method-name"
          placeholder="e.g. Venmo, Wire Transfer, In-kind"
          value={paymentMethodName}
          onChange={(event) => setPaymentMethodName(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="payment-method-fee">Processing Fee</Label>
        <Input
          id="payment-method-fee"
          placeholder="None"
          value={paymentMethodFee}
          onChange={(event) => setPaymentMethodFee(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Shown to staff only — e.g. &quot;None&quot; or &quot;Processing fee applies&quot;
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="payment-method-enabled"
          checked={paymentMethodEnabled}
          onCheckedChange={setPaymentMethodEnabled}
        />
        <Label htmlFor="payment-method-enabled">Enabled</Label>
      </div>
    </div>

    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => {
          resetPaymentMethodForm()
          setShowPaymentMethodDialog(false)
        }}
      >
        Cancel
      </Button>

      <Button onClick={handleSavePaymentMethod}>
        {editingPaymentMethod ? "Save Changes" : "Add Payment Method"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
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
                Funds are subcategories under a donation category. They appear in the Fund dropdown
                on pledges and payments.
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
