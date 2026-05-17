"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Save,
  User,
  XCircle,
  Download,
  Eye,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

type VendorType =
  | "Clothing"
  | "Decoration"
  | "Coffee"
  | "Food"
  | "Photography"
  | "Entertainment"
  | "Supplies"
  | "Technology"

type BoothType = "Standard" | "Premium" | "Corner" | "Double" | "Outdoor"
type VendorStatus = "Pending" | "Approved" | "Rejected" | "Active"

interface Vendor {
  id: string
  type: VendorType
  businessName: string
  contact: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  zip: string
  eventName: string
  eventDate: string
  boothType: BoothType
  boothNumber?: string
  amountPaid: number
  totalAmount: number
  status: VendorStatus
  applicationDate: string
  approvalDate?: string
  documents: { name: string; status: "Verified" | "Pending" | "Missing" }[]
  notes?: string
  paymentHistory: {
    id: string
    date: string
    amount: number
    method: string
    reference?: string
  }[]
  previousEvents: {
    eventName: string
    date: string
    boothType: BoothType
    amountPaid: number
  }[]
}

const mockVendor: Vendor = {
  id: "vnd-001",
  type: "Coffee",
  businessName: "Arabica Brews",
  contact: "Yusuf Haddad",
  phone: "+1 (555) 111-2233",
  email: "yusuf@arabicabrews.com",
  address: "456 Coffee Lane",
  city: "Austin",
  state: "TX",
  zip: "78701",
  eventName: "Eid Bazaar 2026",
  eventDate: "Mar 30, 2026",
  boothType: "Premium",
  boothNumber: "A-12",
  amountPaid: 450,
  totalAmount: 500,
  status: "Active",
  applicationDate: "Jan 10, 2026",
  approvalDate: "Jan 15, 2026",
  documents: [
    { name: "Business License", status: "Verified" },
    { name: "Health Permit", status: "Verified" },
    { name: "Insurance Certificate", status: "Verified" },
    { name: "Food Handler Certificate", status: "Pending" },
  ],
  notes: "Returning vendor from previous year. Excellent customer feedback.",
  paymentHistory: [
    { id: "pay-1", date: "Jan 15, 2026", amount: 250, method: "Credit Card", reference: "CC-4532" },
    { id: "pay-2", date: "Feb 10, 2026", amount: 200, method: "Check", reference: "Check #1234" },
  ],
  previousEvents: [
    { eventName: "Eid Bazaar 2025", date: "Apr 10, 2025", boothType: "Standard", amountPaid: 350 },
    { eventName: "Community Festival 2024", date: "Sep 15, 2024", boothType: "Standard", amountPaid: 300 },
  ],
}

const typeStyles: Record<VendorType, string> = {
  Clothing: "bg-purple-100 text-purple-700",
  Decoration: "bg-pink-100 text-pink-700",
  Coffee: "bg-amber-100 text-amber-700",
  Food: "bg-orange-100 text-orange-700",
  Photography: "bg-sky-100 text-sky-700",
  Entertainment: "bg-rose-100 text-rose-700",
  Supplies: "bg-teal-100 text-teal-700",
  Technology: "bg-blue-100 text-blue-700",
}

const boothStyles: Record<BoothType, string> = {
  Standard: "bg-muted text-muted-foreground",
  Premium: "bg-emerald-100 text-emerald-700",
  Corner: "bg-sky-100 text-sky-700",
  Double: "bg-violet-100 text-violet-700",
  Outdoor: "bg-lime-100 text-lime-700",
}

const statusStyles: Record<VendorStatus, { className: string; icon: typeof CheckCircle2 }> = {
  Pending: { className: "bg-amber-100 text-amber-700", icon: Clock },
  Approved: { className: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  Rejected: { className: "bg-red-100 text-red-700", icon: XCircle },
  Active: { className: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function VendorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [vendor] = useState<Vendor>(mockVendor)
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)

  const StatusIcon = statusStyles[vendor.status].icon
  const balanceDue = vendor.totalAmount - vendor.amountPaid

  return (
    <>
      <Header title="Vendor Details" />
      <div className="flex flex-col gap-6 p-6">
        {/* Back Link & Actions */}
        <div className="flex items-center justify-between">
          <Link
            href="/vendor-hub/vendors"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Vendors
          </Link>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => setIsEditing(false)}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Vendor
                </Button>
                <Button size="sm" onClick={() => setShowPaymentDialog(true)}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Record Payment
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Vendor Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-foreground">{vendor.businessName}</h2>
                    <Badge variant="secondary" className={typeStyles[vendor.type]}>
                      {vendor.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {vendor.contact}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {vendor.eventName}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="secondary" className={`${statusStyles[vendor.status].className} px-3 py-1`}>
                  <StatusIcon className="mr-1 h-3.5 w-3.5" />
                  {vendor.status}
                </Badge>
                <Badge variant="secondary" className={boothStyles[vendor.boothType]}>
                  {vendor.boothType} Booth {vendor.boothNumber && `(${vendor.boothNumber})`}
                </Badge>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(vendor.totalAmount)}</p>
              </div>
              <div className="rounded-lg border bg-emerald-50 p-4">
                <p className="text-sm text-emerald-600">Amount Paid</p>
                <p className="text-2xl font-bold text-emerald-700">{formatCurrency(vendor.amountPaid)}</p>
              </div>
              <div className={`rounded-lg border p-4 ${balanceDue > 0 ? "bg-amber-50" : "bg-emerald-50"}`}>
                <p className={`text-sm ${balanceDue > 0 ? "text-amber-600" : "text-emerald-600"}`}>Balance Due</p>
                <p className={`text-2xl font-bold ${balanceDue > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {formatCurrency(balanceDue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground">Contact Person</Label>
                    {isEditing ? (
                      <Input defaultValue={vendor.contact} />
                    ) : (
                      <p className="text-sm font-medium">{vendor.contact}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    {isEditing ? (
                      <Input defaultValue={vendor.email} type="email" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${vendor.email}`} className="text-sm text-primary hover:underline">
                          {vendor.email}
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    {isEditing ? (
                      <Input defaultValue={vendor.phone} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${vendor.phone}`} className="text-sm text-primary hover:underline">
                          {vendor.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Business Address */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Business Address</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground">Street Address</Label>
                    {isEditing ? (
                      <Input defaultValue={vendor.address} />
                    ) : (
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <p className="text-sm">{vendor.address}</p>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground">City</Label>
                      {isEditing ? (
                        <Input defaultValue={vendor.city} />
                      ) : (
                        <p className="text-sm">{vendor.city}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground">State</Label>
                      {isEditing ? (
                        <Input defaultValue={vendor.state} />
                      ) : (
                        <p className="text-sm">{vendor.state}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground">ZIP Code</Label>
                      {isEditing ? (
                        <Input defaultValue={vendor.zip} />
                      ) : (
                        <p className="text-sm">{vendor.zip}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Booth Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Booth Information</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground">Vendor Type</Label>
                      {isEditing ? (
                        <Select defaultValue={vendor.type}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Clothing">Clothing</SelectItem>
                            <SelectItem value="Coffee">Coffee</SelectItem>
                            <SelectItem value="Decoration">Decoration</SelectItem>
                            <SelectItem value="Entertainment">Entertainment</SelectItem>
                            <SelectItem value="Food">Food</SelectItem>
                            <SelectItem value="Photography">Photography</SelectItem>
                            <SelectItem value="Supplies">Supplies</SelectItem>
                            <SelectItem value="Technology">Technology</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className={typeStyles[vendor.type]}>
                          {vendor.type}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground">Booth Type</Label>
                      {isEditing ? (
                        <Select defaultValue={vendor.boothType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Standard">Standard</SelectItem>
                            <SelectItem value="Premium">Premium</SelectItem>
                            <SelectItem value="Corner">Corner</SelectItem>
                            <SelectItem value="Double">Double</SelectItem>
                            <SelectItem value="Outdoor">Outdoor</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className={boothStyles[vendor.boothType]}>
                          {vendor.boothType}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground">Booth Number</Label>
                    {isEditing ? (
                      <Input defaultValue={vendor.boothNumber} />
                    ) : (
                      <p className="text-sm font-medium">{vendor.boothNumber || "Not assigned"}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <Textarea defaultValue={vendor.notes} rows={4} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {vendor.notes || "No notes added."}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Required Documents</CardTitle>
                  <CardDescription>Track vendor documentation status</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  Request Missing Documents
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendor.documents.map((doc, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{doc.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              doc.status === "Verified"
                                ? "bg-emerald-100 text-emerald-700"
                                : doc.status === "Pending"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                            }
                          >
                            {doc.status === "Verified" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                            {doc.status === "Pending" && <Clock className="mr-1 h-3 w-3" />}
                            {doc.status === "Missing" && <XCircle className="mr-1 h-3 w-3" />}
                            {doc.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {doc.status === "Verified" ? (
                            <Button variant="ghost" size="sm" className="h-8">
                              <Download className="mr-1 h-3 w-3" />
                              Download
                            </Button>
                          ) : doc.status === "Pending" ? (
                            <Button variant="ghost" size="sm" className="h-8">
                              <Eye className="mr-1 h-3 w-3" />
                              Review
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-8 text-amber-600">
                              <Mail className="mr-1 h-3 w-3" />
                              Request
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Payment History</CardTitle>
                  <CardDescription>All payments received from this vendor</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowPaymentDialog(true)}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Record Payment
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendor.paymentHistory.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{payment.date}</TableCell>
                        <TableCell className="font-medium text-emerald-700">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell>{payment.method}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {payment.reference || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Previous Events</CardTitle>
                <CardDescription>History of events this vendor has participated in</CardDescription>
              </CardHeader>
              <CardContent>
                {vendor.previousEvents.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No previous event history.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Booth Type</TableHead>
                        <TableHead className="text-right">Amount Paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendor.previousEvents.map((event, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{event.eventName}</TableCell>
                          <TableCell className="text-muted-foreground">{event.date}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={boothStyles[event.boothType]}>
                              {event.boothType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(event.amountPaid)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Record Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                Record a payment from {vendor.businessName}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Balance Due</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(balanceDue)}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-amount">Payment Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input id="payment-amount" type="number" placeholder="0.00" className="pl-7" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-date">Payment Date</Label>
                <Input id="payment-date" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-method">Payment Method</Label>
                <Select>
                  <SelectTrigger id="payment-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Check">Check</SelectItem>
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-reference">Reference Number (Optional)</Label>
                <Input id="payment-reference" placeholder="e.g., Check #1234" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowPaymentDialog(false)}>
                Record Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
