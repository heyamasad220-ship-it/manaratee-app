"use client"

import { useState } from "react"
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

const settingsTabs = ["General", "Campaigns", "Categories", "Payment Methods", "Receipts", "Notifications"] as const
type SettingsTab = (typeof settingsTabs)[number]

const defaultCategories = [
  { id: "c-1", name: "Zakat", description: "Obligatory alms giving", taxDeductible: true },
  { id: "c-2", name: "Sadaqah", description: "Voluntary charity", taxDeductible: true },
  { id: "c-3", name: "Operations", description: "General operating expenses", taxDeductible: true },
  { id: "c-4", name: "Building Fund", description: "Construction and renovation", taxDeductible: true },
  { id: "c-5", name: "Youth Programs", description: "Youth education and activities", taxDeductible: true },
  { id: "c-6", name: "Community Support", description: "Assistance for community members", taxDeductible: false },
]

const defaultPaymentMethods = [
  { id: "pm-1", name: "Credit Card", enabled: true, fee: "2.9% + $0.30" },
  { id: "pm-2", name: "Bank Transfer", enabled: true, fee: "None" },
  { id: "pm-3", name: "Check", enabled: true, fee: "None" },
  { id: "pm-4", name: "Cash", enabled: true, fee: "None" },
  { id: "pm-5", name: "PayPal", enabled: false, fee: "2.9% + $0.30" },
]

interface Campaign {
  id: string
  name: string
  description: string
  goalAmount: number
  raisedAmount: number
  startDate: string
  endDate: string
  status: "Active" | "Completed" | "Draft" | "Paused"
}

const defaultCampaigns: Campaign[] = [
  { id: "camp-1", name: "Building Fund 2024", description: "Expansion and renovation project", goalAmount: 500000, raisedAmount: 245000, startDate: "2024-01-01", endDate: "2024-12-31", status: "Active" },
  { id: "camp-2", name: "Ramadan Campaign 2024", description: "Support community programs during Ramadan", goalAmount: 75000, raisedAmount: 75000, startDate: "2024-03-01", endDate: "2024-04-15", status: "Completed" },
  { id: "camp-3", name: "Youth Programs 2024", description: "Fund youth education and activities", goalAmount: 50000, raisedAmount: 28000, startDate: "2024-01-01", endDate: "2024-12-31", status: "Active" },
  { id: "camp-4", name: "Zakat Fund", description: "Ongoing zakat collection for eligible recipients", goalAmount: 100000, raisedAmount: 67500, startDate: "2024-01-01", endDate: "2024-12-31", status: "Active" },
  { id: "camp-5", name: "Education Fund", description: "Scholarships and educational resources", goalAmount: 30000, raisedAmount: 12000, startDate: "2024-06-01", endDate: "2025-05-31", status: "Active" },
  { id: "camp-6", name: "Summer Camp 2025", description: "Annual summer camp for youth", goalAmount: 25000, raisedAmount: 0, startDate: "2025-06-01", endDate: "2025-08-31", status: "Draft" },
]

export default function DonationsSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("General")
  const [categories, setCategories] = useState(defaultCategories)
  const [paymentMethods, setPaymentMethods] = useState(defaultPaymentMethods)
  const [campaigns, setCampaigns] = useState(defaultCampaigns)
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false)
  const [showCampaignDialog, setShowCampaignDialog] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount)
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
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription>Information displayed on donation receipts</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="org-name">Organization Name</Label>
                    <Input id="org-name" defaultValue="Islamic Center of Example" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="tax-id">Tax ID / EIN</Label>
                    <Input id="tax-id" defaultValue="12-3456789" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" defaultValue="123 Main Street, City, State 12345" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Donation Defaults</CardTitle>
                <CardDescription>Default settings for new donations</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="default-category">Default Category</Label>
                    <Select defaultValue="operations">
                      <SelectTrigger id="default-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name.toLowerCase()}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="min-donation">Minimum Donation Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input id="min-donation" type="number" defaultValue="5" className="pl-7" />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Anonymous Donations</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow donors to give without providing their name
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Recurring Donations</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow donors to set up recurring monthly donations
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button>Save Changes</Button>
            </div>
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
                            <p className="font-medium">{campaign.name}</p>
                            <p className="text-sm text-muted-foreground">{campaign.description}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(campaign.goalAmount)}</TableCell>
                        <TableCell className="text-emerald-600 font-medium">{formatCurrency(campaign.raisedAmount)}</TableCell>
                        <TableCell>
                          <div className="w-24">
                            <div className="mb-1 flex justify-between text-xs">
                              <span>{Math.round((campaign.raisedAmount / campaign.goalAmount) * 100)}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted">
                              <div
                                className="h-2 rounded-full bg-primary"
                                style={{ width: `${Math.min((campaign.raisedAmount / campaign.goalAmount) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{getCampaignStatusBadge(campaign.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => { setEditingCampaign(campaign); setShowCampaignDialog(true); }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                              onClick={() => setCampaigns(campaigns.filter((c) => c.id !== campaign.id))}
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
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                              onClick={() => setCategories(categories.filter((c) => c.id !== category.id))}
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
                            onCheckedChange={(checked) =>
                              setPaymentMethods(
                                paymentMethods.map((m) =>
                                  m.id === method.id ? { ...m, enabled: checked } : m
                                )
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "Receipts" && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Receipt Settings</CardTitle>
                <CardDescription>Configure donation receipt generation</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-Generate Receipts</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically generate receipts for all donations
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Email Receipts Automatically</Label>
                      <p className="text-sm text-muted-foreground">
                        Send receipts to donors via email upon donation
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="receipt-footer">Receipt Footer Text</Label>
                  <Textarea
                    id="receipt-footer"
                    rows={3}
                    defaultValue="Thank you for your generous donation. Your contribution is tax-deductible to the extent allowed by law."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Year-End Statements</CardTitle>
                <CardDescription>Configure annual giving statements</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Generate Year-End Statements</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically generate annual giving summaries in January
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="statement-threshold">Minimum for Statement</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input id="statement-threshold" type="number" defaultValue="250" className="pl-7" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button>Save Changes</Button>
            </div>
          </div>
        )}

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

      {/* Add Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Donation Category</DialogTitle>
            <DialogDescription>Create a new category for organizing donations</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-name">Category Name</Label>
              <Input id="cat-name" placeholder="e.g., Education Fund" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-description">Description</Label>
              <Textarea id="cat-description" placeholder="Brief description of this category" rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="cat-tax" defaultChecked />
              <Label htmlFor="cat-tax">Tax Deductible</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCategoryDialog(false)}>Cancel</Button>
            <Button onClick={() => setShowAddCategoryDialog(false)}>Add Category</Button>
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
                defaultValue={editingCampaign?.name || ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="camp-description">Description</Label>
              <Textarea
                id="camp-description"
                placeholder="Brief description of this campaign"
                rows={2}
                defaultValue={editingCampaign?.description || ""}
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
                  defaultValue={editingCampaign?.goalAmount || ""}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="camp-start">Start Date</Label>
                <Input
                  id="camp-start"
                  type="date"
                  defaultValue={editingCampaign?.startDate || ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="camp-end">End Date</Label>
                <Input
                  id="camp-end"
                  type="date"
                  defaultValue={editingCampaign?.endDate || ""}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="camp-status">Status</Label>
              <Select defaultValue={editingCampaign?.status || "Draft"}>
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
            <Button onClick={() => setShowCampaignDialog(false)}>
              {editingCampaign ? "Save Changes" : "Add Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
