"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Pencil,
  Save,
  X,
  Heart,
  TrendingUp,
  Plus,
  User,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { DonorProfileMetrics } from "@/components/donations/donor-profile-metrics"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DonorDonationHistoryTable } from "@/components/donations/donor-donation-history-table"
import { Textarea } from "@/components/ui/textarea"
import { DonorGivingSummary } from "@/components/donations/donor-giving-summary"
import { DonorPledgeCollectionPanel } from "@/components/donations/donor-pledge-collection-panel"
import { DonorPledgesTab } from "@/components/donations/donor-pledges-tab"
import { DonorRecurringPanel } from "@/components/donations/donor-recurring-panel"
import { mapPaymentToDonationHistoryRow } from "@/lib/donations/payment-admin-capabilities"
import { updateDonorContactProfileAction } from "@/lib/donations/donor-profile-actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"


export default function OrganizationDonorDetailPage() {
  const [donor, setDonor] = useState<any>(null)

  const params = useParams()
  const supabase = createClient()

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", contact: "" })
  const [showRecordDonation, setShowRecordDonation] = useState(false)
  const [showOverviewDialog, setShowOverviewDialog] = useState(false)
  const [showDonationsDialog, setShowDonationsDialog] = useState(false)
  const [showPledgesDialog, setShowPledgesDialog] = useState(false)

  useEffect(() => {
    void loadDonor()
  }, [params.id, supabase])

  async function loadDonor() {
    const { data, error } = await supabase
      .from("donor_summary_view")
      .select("*")
      .eq("id", params.id as string)
      .single()

    if (error) {
      console.error("Error loading organization donor:", error)
      return
    }

    let primaryContactName = ""
    if (data.contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("primary_contact_name")
        .eq("id", data.contact_id)
        .maybeSingle()
      primaryContactName = contact?.primary_contact_name || ""
    }

    const { data: payments } = await supabase
      .from("payments")
      .select(
        `
        id,
        amount,
        refunded_amount,
        payment_date,
        source,
        source_type,
        memo,
        status,
        pledge_id,
        import_batch_id,
        stripe_payment_intent_id,
        stripe_charge_id,
        category_id,
        donation_categories ( name )
      `
      )
      .eq("donor_id", data.id)
      .order("payment_date", { ascending: false })
      .limit(100)

    const donationHistory = (payments || []).map((p: any) =>
      mapPaymentToDonationHistoryRow(p)
    )

    setDonor({
      id: data.id,
      contactId: data.contact_id,
      name: data.full_name,
      email: data.email,
      phone: data.phone,
      status: data.status || "Active",
      hasPledge: data.has_open_pledge || false,
      preferredCategory: data.preferred_category || "",
      address: {
        street: data.street || "",
        city: data.city || "",
        state: data.state || "",
        zip: data.zip || "",
      },
      contact: primaryContactName,
      type: data.organization_type || "",
      totalDonations: Number(data.total_donations || 0),
      donationCount: Number(data.donation_count || 0),
      lastDonation: data.last_donation_date || "",
      notes: data.notes || "",
      donationHistory,
      createdAt: data.created_at,
    })
  }

  async function handleSave() {
    if (!donor) return
    setIsSaving(true)
    setSaveError(null)

    const result = await updateDonorContactProfileAction({
      donorId: donor.id,
      contactId: donor.contactId,
      fullName: editForm.name,
      email: editForm.email,
      phone: editForm.phone,
      primaryContactName: editForm.contact,
    })

    setIsSaving(false)

    if (!result.success) {
      setSaveError(result.error)
      return
    }

    setDonor((prev: any) => ({
      ...prev,
      name: editForm.name.trim(),
      email: editForm.email.trim(),
      phone: editForm.phone.trim(),
      contact: editForm.contact.trim(),
    }))
    setIsEditing(false)
  }

  function startEditing() {
    if (!donor) return
    setEditForm({
      name: donor.name || "",
      email: donor.email || "",
      phone: donor.phone || "",
      contact: donor.contact || "",
    })
    setSaveError(null)
    setIsEditing(true)
  }

  function cancelEditing() {
    setSaveError(null)
    setIsEditing(false)
  }

  function openOverviewDialog() {
    setSaveError(null)
    setIsEditing(false)
    setShowOverviewDialog(true)
  }

  function closeOverviewDialog() {
    setSaveError(null)
    setIsEditing(false)
    setShowOverviewDialog(false)
  }

  if (!donor) return <div className="p-6">Loading...</div>
  return (
    <>
      <Header title="Organization Donor Details" />
      <div className="p-6">
        <div className="mb-6">
          <Link
            href="/donations/donors"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Donors
          </Link>
        </div>

        {/* Header Section */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={openOverviewDialog}
                  className="text-2xl font-bold text-primary hover:underline"
                >
                  {donor.name}
                </button>
                <Badge variant={donor.status === "Major Donor" ? "default" : "secondary"}>
                  {donor.status}
                </Badge>
                {donor.hasPledge && (
                  <Badge variant="outline">Active Pledge</Badge>
                )}
              </div>
              <p className="text-muted-foreground">{donor.type} Organization</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Partner since {new Date(donor.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {saveError && !showOverviewDialog ? (
              <p className="text-sm text-destructive">{saveError}</p>
            ) : null}
            <Button onClick={() => setShowRecordDonation(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Record Donation
            </Button>
          </div>
        </div>

        <DonorProfileMetrics
          donorId={donor.id}
          totalDonations={donor.totalDonations}
          donationCount={donor.donationCount}
          lastDonation={donor.lastDonation}
          onDonationCountClick={() => setShowDonationsDialog(true)}
          onPledgesClick={() => setShowPledgesDialog(true)}
        />

        <div className="mb-6">
          <DonorGivingSummary donorId={donor.id} donorName={donor.name} statementOnly />
        </div>

        <div className="mb-6">
          <DonorPledgeCollectionPanel donorId={donor.id} donorName={donor.name} />
        </div>

        <div className="mb-6">
          <DonorRecurringPanel donorId={donor.id} />
        </div>

      </div>

      <Dialog
        open={showOverviewDialog}
        onOpenChange={(open) => {
          if (!open) closeOverviewDialog()
          else setShowOverviewDialog(true)
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Organization overview</DialogTitle>
            <DialogDescription>Details and preferences for {donor.name}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-2 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Organization Name</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.name}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        className="mt-1"
                        placeholder="Organization name"
                      />
                    ) : (
                      <p className="font-medium">{donor.name || "—"}</p>
                    )}
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Organization Type</Label>
                    {isEditing ? (
                      <Select defaultValue={donor.type}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Non-Profit">Non-Profit</SelectItem>
                          <SelectItem value="Corporate">Corporate</SelectItem>
                          <SelectItem value="Educational">Educational</SelectItem>
                          <SelectItem value="Foundation">Foundation</SelectItem>
                          <SelectItem value="Government">Government</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-medium">{donor.type}</p>
                    )}
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Contact Person</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.contact}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, contact: event.target.value }))
                        }
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{donor.contact || "—"}</p>
                    )}
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.email}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, email: event.target.value }))
                        }
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{donor.email || "—"}</p>
                    )}
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.phone}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, phone: event.target.value }))
                        }
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{donor.phone || "—"}</p>
                    )}
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Address</Label>
                    {isEditing ? (
                      <div className="mt-1 space-y-2">
                        <Input defaultValue={donor.address.street} placeholder="Street" />
                        <div className="grid grid-cols-3 gap-2">
                          <Input defaultValue={donor.address.city} placeholder="City" />
                          <Input defaultValue={donor.address.state} placeholder="State" />
                          <Input defaultValue={donor.address.zip} placeholder="ZIP" />
                        </div>
                      </div>
                    ) : (
                      <p className="font-medium">
                        {donor.address.street}
                        <br />
                        {donor.address.city}, {donor.address.state} {donor.address.zip}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preferences & Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Preferred Category</Label>
                  {isEditing ? (
                    <Select defaultValue={donor.preferredCategory}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Operations">Operations</SelectItem>
                        <SelectItem value="Programs">Programs</SelectItem>
                        <SelectItem value="Community Support">Community Support</SelectItem>
                        <SelectItem value="Special Campaigns">Special Campaigns</SelectItem>
                        <SelectItem value="Building Fund">Building Fund</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mt-1 font-medium">{donor.preferredCategory || "—"}</p>
                  )}
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  {isEditing ? (
                    <Textarea defaultValue={donor.notes} className="mt-1" rows={4} />
                  ) : (
                    <p className="mt-1 text-sm">{donor.notes || "No notes"}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {saveError && showOverviewDialog ? (
            <p className="text-sm text-destructive">{saveError}</p>
          ) : null}

          <DialogFooter>
            {isEditing ? (
              <>
                <Button variant="outline" onClick={cancelEditing} disabled={isSaving}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowOverviewDialog(false)}>
                  Close
                </Button>
                <Button variant="outline" onClick={startEditing}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDonationsDialog} onOpenChange={setShowDonationsDialog}>
        <DialogContent className="flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col gap-4 overflow-hidden sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Donation History</DialogTitle>
            <DialogDescription>All donations from {donor.name}</DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setShowDonationsDialog(false)
                setShowRecordDonation(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Record Donation
            </Button>
          </div>

          <div className="min-h-0 overflow-y-auto">
            <DonorDonationHistoryTable
              donorId={donor.id}
              donations={donor.donationHistory}
              onUpdated={() => void loadDonor()}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPledgesDialog} onOpenChange={setShowPledgesDialog}>
        <DialogContent className="flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col gap-4 overflow-hidden sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Pledges</DialogTitle>
            <DialogDescription>All pledges for {donor.name}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto">
            <DonorPledgesTab
              donorId={donor.id}
              donorName={donor.name}
              embedded
              onUpdated={() => void loadDonor()}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Donation Dialog */}
      <Dialog open={showRecordDonation} onOpenChange={setShowRecordDonation}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Donation</DialogTitle>
            <DialogDescription>
              Record a new donation from {donor.name}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="donation-amount">Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input id="donation-amount" type="number" placeholder="0.00" className="pl-7" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="donation-date">Date</Label>
                <Input id="donation-date" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="donation-category">Category</Label>
                <Select>
                  <SelectTrigger id="donation-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="Programs">Programs</SelectItem>
                    <SelectItem value="Community Support">Community Support</SelectItem>
                    <SelectItem value="Special Campaigns">Special Campaigns</SelectItem>
                    <SelectItem value="Building Fund">Building Fund</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="donation-method">Payment Method</Label>
                <Select>
                  <SelectTrigger id="donation-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Wire Transfer">Wire Transfer</SelectItem>
                    <SelectItem value="Check">Check</SelectItem>
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Stock">Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="donation-notes">Notes (Optional)</Label>
              <Textarea id="donation-notes" placeholder="Additional notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecordDonation(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowRecordDonation(false)}>
              Record Donation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
