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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Plus, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { getCampaignAnalyticsAction } from "@/lib/donations/donation-reports-actions"
import { DonationReceiptSettingsForm } from "@/components/donations/donation-receipt-settings-form"
import { PledgeReminderSettingsForm } from "@/components/donations/pledge-reminder-settings-form"
import { DonationOpsPanel } from "@/components/donations/donation-ops-panel"

const settingsTabs = ["General", "Campaigns", "Categories", "Payment Methods", "Receipts", "Pledge Reminders", "Notifications"] as const
type SettingsTab = (typeof settingsTabs)[number]

interface Category {
  id: string
  name: string
  description: string
  taxDeductible: boolean
}

interface PaymentMethod {
  id: string
  name: string
  enabled: boolean
  fee: string
}

interface Campaign {
  id: string
  name: string
  description: string
  goalAmount: number
  raisedAmount: number
  startDate: string
  endDate: string
  status: "Active" | "Completed" | "Draft" | "Paused"
  campaignCode?: string
}
function getCampaignStatusBadge(status?: string) {
  if (!status) return "Draft"

  switch (status.toLowerCase()) {
    case "active":
      return "Active"

    case "draft":
      return "Draft"

    case "completed":
      return "Completed"

    case "paused":
      return "Paused"

    default:
      return status
  }
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
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false)
  const [showCampaignDialog, setShowCampaignDialog] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [categoryName, setCategoryName] = useState("")
const [categoryDescription, setCategoryDescription] = useState("")
const [editingCategory, setEditingCategory] = useState<Category | null>(null)
const [categoryTaxDeductible, setCategoryTaxDeductible] = useState(true)
const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | null>(null)
const [paymentMethodName, setPaymentMethodName] = useState("")
const [paymentMethodFee, setPaymentMethodFee] = useState("")
const [paymentMethodEnabled, setPaymentMethodEnabled] = useState(true)
const [showPaymentMethodDialog, setShowPaymentMethodDialog] = useState(false)
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    description: "",
    goalAmount: "",
    startDate: "",
    endDate: "",
    status: "Draft" as Campaign["status"],
    campaignCode: "",
  })
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
async function loadCampaigns() {
  const result = await getCampaignAnalyticsAction()

  if (!result.success) {
    console.error("Error loading campaigns:", result.error)
    setCampaigns([])
    return
  }

  setCampaigns(
    (result.entries || []).map(({ campaign, metrics }) => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description || "",
      goalAmount: Number(campaign.goal_amount || 0),
      raisedAmount: metrics.raised,
      startDate: campaign.start_date || "",
      endDate: campaign.end_date || "",
      status:
        campaign.status === "active"
          ? "Active"
          : campaign.status === "completed"
            ? "Completed"
            : campaign.status === "paused"
              ? "Paused"
              : "Draft",
      campaignCode: campaign.code || "",
    }))
  )
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

  if (!editingPaymentMethod) return

  const { error } = await supabase
    .from("payment_methods")
    .update({
      name: paymentMethodName.trim(),
      fee: paymentMethodFee.trim() || "None",
      enabled: paymentMethodEnabled,
    })
    .eq("id", editingPaymentMethod.id)
    .eq("organization_id", orgId)

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
  loadCampaigns()
  loadCategories()
  loadPaymentMethods()
}, [])

useEffect(() => {
  if (editingCampaign) {
    setCampaignForm({
      name: editingCampaign.name,
      description: editingCampaign.description,
      goalAmount: editingCampaign.goalAmount.toString(),
      startDate: editingCampaign.startDate,
      endDate: editingCampaign.endDate,
      status: editingCampaign.status,
      campaignCode: editingCampaign.campaignCode || "",
    })
  } else {
    setCampaignForm({
      name: "",
      description: "",
      goalAmount: "",
      startDate: "",
      endDate: "",
      status: "Draft",
      campaignCode: "",
    })
  }
}, [editingCampaign])
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ""
    // Parse date as local date to avoid timezone offset issues
    const date = new Date(dateString + "T00:00:00")
    return date.toLocaleDateString()
  }

  const generateCampaignCode = (campaignName: string) => {
    // Create a code from the campaign name: take first letter of each word, uppercase, and add random suffix
    const words = campaignName.trim().split(/\s+/)
    const codePrefix = words.map(word => word.charAt(0).toUpperCase()).join('')
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase()
    return `${codePrefix}${randomSuffix}`
  }

  const getCampaignStatusBadge = (status: Campaign["status"]) => {
    switch (status) {
      case "Active":
        return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Active</span>
      case "Completed":
        return <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">Completed</span>
      case "Draft":
        return <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">Draft</span>
      case "Paused":
        return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">Paused</span>
    }
  }
async function handleSaveCampaign() {
  const orgId = await getOrganizationId()

  if (!orgId) {
    alert("No organization selected")
    return
  }

  if (!campaignForm.name.trim()) {
    alert("Campaign name is required")
    return
  }

  // Check for duplicate campaign names (excluding current campaign if editing)
  const existingCampaign = campaigns.find(c => 
    c.name.toLowerCase() === campaignForm.name.trim().toLowerCase() && 
    (!editingCampaign || c.id !== editingCampaign.id)
  )
  
  if (existingCampaign) {
    alert("A campaign with this name already exists")
    return
  }

  const campaignData = {
    organization_id: orgId,
    name: campaignForm.name.trim(),
    description: campaignForm.description.trim() || null,
    goal_amount: campaignForm.goalAmount ? Number(campaignForm.goalAmount) : null,
    start_date: campaignForm.startDate || null,
    end_date: campaignForm.endDate || null,
    status: campaignForm.status.toLowerCase(),
  }

  if (editingCampaign) {
    // Update existing campaign
    const { error } = await supabase
      .from("campaigns")
      .update(campaignData)
      .eq("id", editingCampaign.id)

    if (error) {
      console.error("Error updating campaign:", error)
      alert(error.message)
      return
    }
  } else {
    // Create new campaign with generated code
    const campaignDataWithCode = {
      ...campaignData,
      code: generateCampaignCode(campaignForm.name.trim())
    }

    const { error } = await supabase
      .from("campaigns")
      .insert(campaignDataWithCode)

    if (error) {
      console.error("Error saving campaign:", error)
      alert(error.message)
      return
    }
  }

  setShowCampaignDialog(false)
  setEditingCampaign(null)
  setCampaignForm({
    name: "",
    description: "",
    goalAmount: "",
    startDate: "",
    endDate: "",
    status: "Draft",
    campaignCode: "",
  })

  await loadCampaigns()
}
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
async function handleDeleteCampaign(campaignId: string) {
  if (!confirm("Are you sure you want to delete this campaign? This action cannot be undone.")) {
    return
  }

  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", campaignId)

  if (error) {
    console.error("Error deleting campaign:", error)
    alert(error.message)
    return
  }

  await loadCampaigns()
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
            <DonationOpsPanel />
            <DonationReceiptSettingsForm mode="general" />
          </div>
        )}

        {activeTab === "Campaigns" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Donation Campaigns</h3>
                <p className="text-sm text-muted-foreground">
                  Create and manage fundraising campaigns
                </p>
              </div>
              <Button onClick={() => { setEditingCampaign(null); setShowCampaignDialog(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Campaign
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Goal</TableHead>
                      <TableHead>Raised</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <div>
                            <Link
                              href={`/donations/campaigns/${campaign.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {campaign.name}
                            </Link>
                            <p className="text-sm text-muted-foreground">{campaign.description}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{campaign.campaignCode || "—"}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(campaign.goalAmount)}</TableCell>
                        <TableCell className="text-emerald-600 font-medium">{formatCurrency(campaign.raisedAmount)}</TableCell>
                        <TableCell>
                          <div className="w-24">
                            <div className="mb-1 flex justify-between text-xs">
                             <span>
  {campaign.goalAmount > 0
    ? Math.round((campaign.raisedAmount / campaign.goalAmount) * 100)
    : 0}
  %
</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted">
                              <div
                                className="h-2 rounded-full bg-primary"
                                style={{
  width: `${
    campaign.goalAmount > 0
      ? Math.min((campaign.raisedAmount / campaign.goalAmount) * 100, 100)
      : 0
  }%`,
}}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                        </TableCell>
                       <TableCell>
  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
    {getCampaignStatusBadge(campaign.status)}
  </span>
</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                          <Button
  variant="ghost"
  size="icon"
  className="h-8 w-8"
  onClick={() => {
    setEditingCampaign(campaign)
    setShowCampaignDialog(true)
  }}
>
  <Pencil className="h-4 w-4" />
</Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                              onClick={() => handleDeleteCampaign(campaign.id)}
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

        {activeTab === "Categories" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Donation Categories</h3>
                <p className="text-sm text-muted-foreground">
                  Manage categories for organizing donations
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
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="text-muted-foreground">{category.description}</TableCell>
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
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "Payment Methods" && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Payment Methods</h3>
              <p className="text-sm text-muted-foreground">
                Configure accepted payment methods for donations
              </p>
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
      {/* Edit Payment Method Dialog */}
<Dialog open={showPaymentMethodDialog} onOpenChange={setShowPaymentMethodDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit Payment Method</DialogTitle>
      <DialogDescription>
        Update this accepted payment method
      </DialogDescription>
    </DialogHeader>

    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="payment-method-name">Method Name</Label>
        <Input
          id="payment-method-name"
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
          setEditingPaymentMethod(null)
          setPaymentMethodName("")
          setPaymentMethodFee("")
          setPaymentMethodEnabled(true)
          setShowPaymentMethodDialog(false)
        }}
      >
        Cancel
      </Button>

      <Button onClick={handleSavePaymentMethod}>
        Save Changes
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
          placeholder="e.g., Education Fund"
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

      {/* Campaign Dialog */}
      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? "Edit Campaign" : "Add Campaign"}</DialogTitle>
            <DialogDescription>
              {editingCampaign ? "Update campaign details" : "Create a new fundraising campaign"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="camp-name">Campaign Name</Label>
              <Input
  id="camp-name"
  placeholder="e.g., Building Fund 2025"
  value={campaignForm.name}
  onChange={(e) => setCampaignForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            {editingCampaign && campaignForm.campaignCode && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="camp-code">Campaign Code</Label>
                <Input
                  id="camp-code"
                  value={campaignForm.campaignCode}
                  readOnly
                  className="font-mono bg-muted"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="camp-description">Description</Label>
              <Textarea
                id="camp-description"
                placeholder="Brief description of this campaign"
                rows={2}
                value={campaignForm.description}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="camp-goal">Goal Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="camp-goal"
                  type="number"
                  placeholder="50000"
                  className="pl-7"
                  value={campaignForm.goalAmount}
                  onChange={(e) => setCampaignForm(prev => ({ ...prev, goalAmount: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="camp-start">Start Date</Label>
                <Input
                  id="camp-start"
                  type="date"
                  value={campaignForm.startDate}
                  onChange={(e) => setCampaignForm(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="camp-end">End Date</Label>
                <Input
                  id="camp-end"
                  type="date"
                  value={campaignForm.endDate}
                  onChange={(e) => setCampaignForm(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="camp-status">Status</Label>
              <Select value={campaignForm.status} onValueChange={(value: Campaign["status"]) => setCampaignForm(prev => ({ ...prev, status: value }))}>
                <SelectTrigger id="camp-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Paused">Paused</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveCampaign}>
              {editingCampaign ? "Save Changes" : "Add Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
