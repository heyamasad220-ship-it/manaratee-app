"use client"

import { useState } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Mock individual donor data
const mockDonors: Record<string, {
  id: string
  name: string
  email: string
  phone: string
  address: {
    street: string
    city: string
    state: string
    zip: string
  }
  totalDonations: number
  donationCount: number
  hasPledge: boolean
  pledgeInfo?: {
    amount: number
    frequency: string
    nextPayment: string
    remaining: number
  }
  preferredCategory: string
  notes: string
  status: string
  donationHistory: {
    id: string
    date: string
    amount: number
    category: string
    method: string
    receipt: string
  }[]
  createdAt: string
  lastDonation: string
}> = {
  "ind-1": {
    id: "ind-1",
    name: "Ahmed Hassan",
    email: "ahmed.hassan@email.com",
    phone: "+1 (555) 123-4567",
    address: {
      street: "123 Oak Street",
      city: "Springfield",
      state: "IL",
      zip: "62701",
    },
    totalDonations: 12500,
    donationCount: 15,
    hasPledge: true,
    pledgeInfo: {
      amount: 500,
      frequency: "Monthly",
      nextPayment: "2024-02-15",
      remaining: 4500,
    },
    preferredCategory: "Operations",
    notes: "Prefers to donate during Ramadan. Interested in youth programs.",
    status: "Active",
    donationHistory: [
      { id: "d1", date: "2024-01-15", amount: 500, category: "Operations", method: "Credit Card", receipt: "REC-001" },
      { id: "d2", date: "2023-12-15", amount: 500, category: "Operations", method: "Credit Card", receipt: "REC-002" },
      { id: "d3", date: "2023-11-15", amount: 500, category: "Operations", method: "Credit Card", receipt: "REC-003" },
      { id: "d4", date: "2023-10-15", amount: 500, category: "Operations", method: "Credit Card", receipt: "REC-004" },
      { id: "d5", date: "2023-09-15", amount: 2000, category: "Ramadan", method: "Bank Transfer", receipt: "REC-005" },
    ],
    createdAt: "2022-03-15",
    lastDonation: "2024-01-15",
  },
  "ind-3": {
    id: "ind-3",
    name: "Omar Khalil",
    email: "omar.k@email.com",
    phone: "+1 (555) 345-6789",
    address: {
      street: "789 Pine Road",
      city: "Naperville",
      state: "IL",
      zip: "60540",
    },
    totalDonations: 25000,
    donationCount: 24,
    hasPledge: true,
    pledgeInfo: {
      amount: 1000,
      frequency: "Monthly",
      nextPayment: "2024-02-20",
      remaining: 9000,
    },
    preferredCategory: "Community Support",
    notes: "Major donor. Board member interest. Prefers quarterly recognition.",
    status: "Major Donor",
    donationHistory: [
      { id: "d1", date: "2024-01-20", amount: 1000, category: "Community Support", method: "Bank Transfer", receipt: "REC-101" },
      { id: "d2", date: "2023-12-20", amount: 1000, category: "Community Support", method: "Bank Transfer", receipt: "REC-102" },
      { id: "d3", date: "2023-11-20", amount: 5000, category: "Special Campaign", method: "Check", receipt: "REC-103" },
      { id: "d4", date: "2023-10-20", amount: 1000, category: "Community Support", method: "Bank Transfer", receipt: "REC-104" },
    ],
    createdAt: "2020-06-10",
    lastDonation: "2024-01-20",
  },
}

// Default donor for unknown IDs
const defaultDonor = {
  id: "unknown",
  name: "Fatima Al-Rahman",
  email: "fatima.ar@email.com",
  phone: "+1 (555) 234-5678",
  address: {
    street: "456 Maple Ave",
    city: "Chicago",
    state: "IL",
    zip: "60601",
  },
  totalDonations: 8750,
  donationCount: 8,
  hasPledge: false,
  preferredCategory: "Programs",
  notes: "Interested in education initiatives.",
  status: "Active",
  donationHistory: [
    { id: "d1", date: "2024-01-08", amount: 1000, category: "Programs", method: "Credit Card", receipt: "REC-201" },
    { id: "d2", date: "2023-11-25", amount: 750, category: "Programs", method: "Credit Card", receipt: "REC-202" },
    { id: "d3", date: "2023-09-10", amount: 2000, category: "Zakat", method: "Check", receipt: "REC-203" },
  ],
  createdAt: "2021-08-20",
  lastDonation: "2024-01-08",
}

export default function IndividualDonorDetailPage() {
  const params = useParams()
  const donor = mockDonors[params.id as string] || defaultDonor
  
  const [isEditing, setIsEditing] = useState(false)
  const [showRecordDonation, setShowRecordDonation] = useState(false)

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
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                ${Math.round(donor.totalDonations / donor.donationCount).toLocaleString()}
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
                {new Date(donor.lastDonation).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(donor.lastDonation).getFullYear()}
              </p>
            </CardContent>
          </Card>
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
                    {donor.donationHistory.map((donation) => (
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
                        <TableCell className="text-muted-foreground">
                          {donation.receipt}
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
