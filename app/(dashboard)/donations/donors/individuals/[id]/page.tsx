"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  User,
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
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Textarea } from "@/components/ui/textarea"
import { DonorGivingSummary } from "@/components/donations/donor-giving-summary"
import { DonorPledgeCollectionPanel } from "@/components/donations/donor-pledge-collection-panel"
import { DonorRecurringPanel } from "@/components/donations/donor-recurring-panel"
import { PaymentReceiptActions } from "@/components/donations/payment-receipt-actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"


export default function IndividualDonorDetailPage() {
  const [donor, setDonor] = useState<any>(null)
  const params = useParams()
  
  const [isEditing, setIsEditing] = useState(false)
  const [showRecordDonation, setShowRecordDonation] = useState(false)
  const supabase = createClient()

useEffect(() => {
  const fetchDonor = async () => {
    const { data, error } = await supabase
      .from("donor_summary_view")
.select("*")
      .eq("id", params.id as string)
      .single()

    console.log("Donor detail data:", data)

    if (error) {
      console.error("Error loading donor detail:", error)
      return
    }

    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("id, amount, payment_date, source, memo, status, category_id, subcategory_id")
      .eq("donor_id", data.id)
      .order("payment_date", { ascending: false })
      .limit(100)

    if (paymentsError) {
      console.error("Error loading donor payments:", paymentsError)
    }

    setDonor({
      id: data.id,
      name: data.full_name,
      email: data.email,
      phone: data.phone,
     totalDonations: Number(data.total_donations || 0),
donationCount: Number(data.donation_count || 0),
lastDonation: data.last_donation_date || "",
      preferredCategory: data.preferred_category || "",
      status: data.status || "Active",
      hasPledge: data.has_open_pledge || false,
      address: {
        street: data.street || "",
        city: data.city || "",
        state: data.state || "",
        zip: data.zip || "",
      },
      notes: data.notes || "",
      donationHistory: (payments || []).map((p: any) => ({
        id: p.id,
        date: p.payment_date,
        amount: p.amount,
        category: p.category || "General",
        method: p.source || "Unknown",
        receipt: p.id,
      })),
      createdAt: data.created_at,
    })
  }

  fetchDonor()
}, [params.id])

if (!donor) return <div className="p-6">Loading...</div>
  return (
    <>
      <Header title="Donor Details" />
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
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{donor.name}</h1>
                <Badge variant={donor.status === "Major Donor" ? "default" : "secondary"}>
                  {donor.status}
                </Badge>
                {donor.hasPledge && (
                  <Badge variant="outline">Active Pledge</Badge>
                )}
              </div>
              <p className="text-muted-foreground">Individual Donor</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Member since {new Date(donor.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={() => setIsEditing(false)}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button onClick={() => setShowRecordDonation(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Record Donation
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 flex flex-wrap gap-4 [&>*]:w-fit">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Donations
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${donor.totalDonations.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">All-time contributions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Donation Count
              </CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{donor.donationCount}</div>
              <p className="text-xs text-muted-foreground">Total donations made</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Donation
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${donor.donationCount > 0
  ? Math.round(donor.totalDonations / donor.donationCount).toLocaleString()
  : "0"}
              </div>
              <p className="text-xs text-muted-foreground">Per donation</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Last Donation
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {donor.lastDonation
  ? new Date(donor.lastDonation).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">
                {donor.lastDonation
  ? new Date(donor.lastDonation).getFullYear()
  : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Giving Summary */}
        <div className="mb-6">
          <DonorGivingSummary donorId={donor.id} donorName={donor.name} />
        </div>

        <div className="mb-6">
          <DonorPledgeCollectionPanel donorId={donor.id} donorName={donor.name} />
        </div>

        <div className="mb-6">
          <DonorRecurringPanel donorId={donor.id} />
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="donations">Donation History</TabsTrigger>
            {donor.hasPledge && <TabsTrigger value="pledge">Pledge</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      {isEditing ? (
                        <Input defaultValue={donor.email} className="mt-1" />
                      ) : (
                        <p className="font-medium">{donor.email}</p>
                      )}
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      {isEditing ? (
                        <Input defaultValue={donor.phone} className="mt-1" />
                      ) : (
                        <p className="font-medium">{donor.phone}</p>
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
                          {donor.address.street}<br />
                          {donor.address.city}, {donor.address.state} {donor.address.zip}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Preferences & Notes */}
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
                          <SelectItem value="Zakat">Zakat</SelectItem>
                          <SelectItem value="Sadaqah">Sadaqah</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="mt-1 font-medium">{donor.preferredCategory}</p>
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
          </TabsContent>

          <TabsContent value="donations">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Donation History</CardTitle>
                  <CardDescription>All donations from this donor</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowRecordDonation(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Record Donation
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {donor.donationHistory.map((donation: any) => (
                      <TableRow key={donation.id}>
                        <TableCell>
                          {new Date(donation.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium">
                          ${donation.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{donation.category}</Badge>
                        </TableCell>
                        <TableCell>{donation.method}</TableCell>
                        <TableCell>
                          <PaymentReceiptActions paymentId={donation.id} compact />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {donor.hasPledge && donor.pledgeInfo && (
            <TabsContent value="pledge">
              <Card>
                <CardHeader>
                  <CardTitle>Active Pledge</CardTitle>
                  <CardDescription>Recurring donation commitment</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Pledge Amount</Label>
                      <p className="mt-1 text-2xl font-bold">${donor.pledgeInfo.amount.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">{donor.pledgeInfo.frequency}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Next Payment</Label>
                      <p className="mt-1 text-lg font-medium">
                        {new Date(donor.pledgeInfo.nextPayment).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Remaining Balance</Label>
                      <p className="mt-1 text-lg font-medium">${donor.pledgeInfo.remaining.toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Badge className="mt-2" variant="default">Active</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

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
                    <SelectItem value="Zakat">Zakat</SelectItem>
                    <SelectItem value="Sadaqah">Sadaqah</SelectItem>
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
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Check">Check</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
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
