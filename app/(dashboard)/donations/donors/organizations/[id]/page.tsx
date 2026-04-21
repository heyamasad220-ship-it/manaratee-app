"use client"

import { useState } from "react"
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

// Mock organization donor data
const mockOrganizations: Record<string, {
  id: string
  name: string
  type: string
  contact: string
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
  "org-1": {
    id: "org-1",
    name: "Al-Noor Foundation",
    type: "Non-Profit",
    contact: "Sarah Williams",
    email: "contact@alnoor.org",
    phone: "+1 (555) 111-2222",
    address: {
      street: "100 Foundation Drive",
      city: "Springfield",
      state: "IL",
      zip: "62702",
    },
    totalDonations: 75000,
    donationCount: 24,
    hasPledge: true,
    pledgeInfo: {
      amount: 5000,
      frequency: "Monthly",
      nextPayment: "2024-02-18",
      remaining: 45000,
    },
    preferredCategory: "Operations",
    notes: "Long-term partner. Interested in joint programs. Annual gala sponsor.",
    status: "Major Donor",
    donationHistory: [
      { id: "d1", date: "2024-01-18", amount: 5000, category: "Operations", method: "Bank Transfer", receipt: "REC-O001" },
      { id: "d2", date: "2023-12-18", amount: 5000, category: "Operations", method: "Bank Transfer", receipt: "REC-O002" },
      { id: "d3", date: "2023-11-18", amount: 10000, category: "Special Campaign", method: "Check", receipt: "REC-O003" },
      { id: "d4", date: "2023-10-18", amount: 5000, category: "Operations", method: "Bank Transfer", receipt: "REC-O004" },
      { id: "d5", date: "2023-09-18", amount: 5000, category: "Operations", method: "Bank Transfer", receipt: "REC-O005" },
    ],
    createdAt: "2019-01-10",
    lastDonation: "2024-01-18",
  },
  "org-4": {
    id: "org-4",
    name: "Barakah Holdings LLC",
    type: "Corporate",
    contact: "Michael Chen",
    email: "csr@barakahholdings.com",
    phone: "+1 (555) 444-5555",
    address: {
      street: "750 Business Park",
      city: "Schaumburg",
      state: "IL",
      zip: "60173",
    },
    totalDonations: 100000,
    donationCount: 36,
    hasPledge: true,
    pledgeInfo: {
      amount: 10000,
      frequency: "Quarterly",
      nextPayment: "2024-04-01",
      remaining: 30000,
    },
    preferredCategory: "Special Campaigns",
    notes: "Corporate matching program. CEO on advisory board. Prefer naming opportunities.",
    status: "Major Donor",
    donationHistory: [
      { id: "d1", date: "2024-01-22", amount: 10000, category: "Special Campaigns", method: "Wire Transfer", receipt: "REC-B001" },
      { id: "d2", date: "2023-10-01", amount: 10000, category: "Special Campaigns", method: "Wire Transfer", receipt: "REC-B002" },
      { id: "d3", date: "2023-07-01", amount: 25000, category: "Building Fund", method: "Check", receipt: "REC-B003" },
      { id: "d4", date: "2023-04-01", amount: 10000, category: "Special Campaigns", method: "Wire Transfer", receipt: "REC-B004" },
    ],
    createdAt: "2018-05-15",
    lastDonation: "2024-01-22",
  },
}

// Default organization for unknown IDs
const defaultOrganization = {
  id: "unknown",
  name: "Crescent Medical Group",
  type: "Corporate",
  contact: "Dr. James Foster",
  email: "giving@crescentmed.com",
  phone: "+1 (555) 222-3333",
  address: {
    street: "500 Health Blvd",
    city: "Chicago",
    state: "IL",
    zip: "60606",
  },
  totalDonations: 50000,
  donationCount: 12,
  hasPledge: true,
  pledgeInfo: {
    amount: 2500,
    frequency: "Monthly",
    nextPayment: "2024-02-12",
    remaining: 22500,
  },
  preferredCategory: "Programs",
  notes: "Healthcare focus. Interested in health education programs.",
  status: "Active",
  donationHistory: [
    { id: "d1", date: "2024-01-12", amount: 2500, category: "Programs", method: "Bank Transfer", receipt: "REC-C001" },
    { id: "d2", date: "2023-12-12", amount: 2500, category: "Programs", method: "Bank Transfer", receipt: "REC-C002" },
    { id: "d3", date: "2023-11-12", amount: 5000, category: "Health Initiative", method: "Check", receipt: "REC-C003" },
  ],
  createdAt: "2020-09-01",
  lastDonation: "2024-01-12",
}

export default function OrganizationDonorDetailPage() {
  const params = useParams()
  const org = mockOrganizations[params.id as string] || defaultOrganization
  
  const [isEditing, setIsEditing] = useState(false)
  const [showRecordDonation, setShowRecordDonation] = useState(false)

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
                <h1 className="text-2xl font-bold">{org.name}</h1>
                <Badge variant={org.status === "Major Donor" ? "default" : "secondary"}>
                  {org.status}
                </Badge>
                {org.hasPledge && (
                  <Badge variant="outline">Active Pledge</Badge>
                )}
              </div>
              <p className="text-muted-foreground">{org.type} Organization</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Partner since {new Date(org.createdAt).toLocaleDateString()}
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
              <div className="text-2xl font-bold">${org.totalDonations.toLocaleString()}</div>
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
              <div className="text-2xl font-bold">{org.donationCount}</div>
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
                ${Math.round(org.totalDonations / org.donationCount).toLocaleString()}
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
                {new Date(org.lastDonation).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(org.lastDonation).getFullYear()}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="donations">Donation History</TabsTrigger>
            {org.hasPledge && <TabsTrigger value="pledge">Pledge</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Organization Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Organization Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Organization Type</Label>
                      {isEditing ? (
                        <Select defaultValue={org.type}>
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
                        <p className="font-medium">{org.type}</p>
                      )}
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Contact Person</Label>
                      {isEditing ? (
                        <Input defaultValue={org.contact} className="mt-1" />
                      ) : (
                        <p className="font-medium">{org.contact}</p>
                      )}
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      {isEditing ? (
                        <Input defaultValue={org.email} className="mt-1" />
                      ) : (
                        <p className="font-medium">{org.email}</p>
                      )}
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      {isEditing ? (
                        <Input defaultValue={org.phone} className="mt-1" />
                      ) : (
                        <p className="font-medium">{org.phone}</p>
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
                          <Input defaultValue={org.address.street} placeholder="Street" />
                          <div className="grid grid-cols-3 gap-2">
                            <Input defaultValue={org.address.city} placeholder="City" />
                            <Input defaultValue={org.address.state} placeholder="State" />
                            <Input defaultValue={org.address.zip} placeholder="ZIP" />
                          </div>
                        </div>
                      ) : (
                        <p className="font-medium">
                          {org.address.street}<br />
                          {org.address.city}, {org.address.state} {org.address.zip}
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
                      <Select defaultValue={org.preferredCategory}>
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
                      <p className="mt-1 font-medium">{org.preferredCategory}</p>
                    )}
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    {isEditing ? (
                      <Textarea defaultValue={org.notes} className="mt-1" rows={4} />
                    ) : (
                      <p className="mt-1 text-sm">{org.notes || "No notes"}</p>
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
                  <CardDescription>All donations from this organization</CardDescription>
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
                    {org.donationHistory.map((donation) => (
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

          {org.hasPledge && org.pledgeInfo && (
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
                      <p className="mt-1 text-2xl font-bold">${org.pledgeInfo.amount.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">{org.pledgeInfo.frequency}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Next Payment</Label>
                      <p className="mt-1 text-lg font-medium">
                        {new Date(org.pledgeInfo.nextPayment).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Remaining Balance</Label>
                      <p className="mt-1 text-lg font-medium">${org.pledgeInfo.remaining.toLocaleString()}</p>
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
              Record a new donation from {org.name}
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
