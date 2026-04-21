"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  User,
  Users,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { BookingStatusBadge, PaymentStatusBadge, type BookingStatus, type PaymentStatus } from "@/lib/status-badges"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Mock booking data
const mockBooking = {
  id: "REQ-2024-001",
  status: "pending",
  paymentStatus: "unpaid",
  submittedAt: "2024-03-15T10:30:00Z",
  
  // Customer Information
  customer: {
    name: "Sarah Johnson",
    email: "sarah.johnson@email.com",
    phone: "(555) 234-5678",
  },
  
  // Event Information
  event: {
    venue: "Grand Hall",
    venueId: "venue-1",
    date: "2024-04-20",
    startTime: "14:00",
    endTime: "22:00",
    type: "Wedding",
    guestCount: 150,
    admissionFee: false,
  },
  
  // Setup and Services
  setup: {
    style: "Round tables with chairs",
    foodType: ["Full meal", "Coffee and tea"],
    specialNeeds: ["Sound system", "Microphone", "Stage"],
    notes: "We will need extra lighting for the dance floor area. The bride prefers warm white tones. We'll also need a separate area for the cake cutting ceremony.",
  },
  
  // Agreement
  agreement: {
    termsAccepted: true,
    signedAt: "2024-03-15T10:28:00Z",
  },
  
  // Payment
  payment: {
    totalAmount: 5500,
    depositAmount: 1650,
    balanceAmount: 3850,
    depositDueDate: "2024-03-25",
    balanceDueDate: "2024-04-15",
    depositPaidAt: null,
    balancePaidAt: null,
  },
  
  // Admin Notes
  adminNotes: [
    {
      id: "note-1",
      author: "Admin User",
      content: "Customer called to confirm availability. Mentioned they might need to add 20 more guests.",
      createdAt: "2024-03-16T09:00:00Z",
    },
  ],
}

export default function BookingDetailPage() {
  const params = useParams()
  const [booking] = useState(mockBooking)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [showRequestChangesDialog, setShowRequestChangesDialog] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showMessageDialog, setShowMessageDialog] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [adminNotes, setAdminNotes] = useState(booking.adminNotes)
  
  // Approval form state
  const [approvalPricing, setApprovalPricing] = useState({
    venueRental: 3500,
    addOns: 500,
    foodServices: 1200,
    taxes: 300,
    depositPercent: 30,
    balanceDueDate: booking.payment.balanceDueDate,
  })
  const [sendApprovalEmail, setSendApprovalEmail] = useState(true)
  const [depositPaymentMethod, setDepositPaymentMethod] = useState("stripe")

  const approvalTotal = approvalPricing.venueRental + approvalPricing.addOns + approvalPricing.foodServices + approvalPricing.taxes
  const approvalDeposit = Math.round(approvalTotal * (approvalPricing.depositPercent / 100))
  const approvalBalance = approvalTotal - approvalDeposit

  // Map internal status to display status
  const getBookingDisplayStatus = (status: string): BookingStatus => {
    const statusMap: Record<string, BookingStatus> = {
      pending: "Pending Review",
      approved: "Approved",
      rejected: "Rejected",
      cancelled: "Cancelled",
    }
    return statusMap[status] || "Pending Review"
  }

  const getPaymentDisplayStatus = (status: string): PaymentStatus => {
    const statusMap: Record<string, PaymentStatus> = {
      unpaid: "Unpaid",
      deposit_paid: "Partially Paid",
      fully_paid: "Paid",
      overdue: "Overdue",
    }
    return statusMap[status] || "Unpaid"
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
  }

  const handleAddNote = () => {
    if (!newNote.trim()) return
    const note = {
      id: `note-${Date.now()}`,
      author: "Admin User",
      content: newNote,
      createdAt: new Date().toISOString(),
    }
    setAdminNotes([note, ...adminNotes])
    setNewNote("")
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/events/external/requests">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Booking Request</h1>
              <BookingStatusBadge status={getBookingDisplayStatus(booking.status)} />
            </div>
            <p className="text-sm text-muted-foreground">
              {booking.id} &bull; Submitted {formatDateTime(booking.submittedAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        {/* Main Content */}
        <div className="flex flex-col gap-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Full Name</span>
                  <span className="font-medium">{booking.customer.name}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Email Address</span>
                  <a href={`mailto:${booking.customer.email}`} className="font-medium text-primary hover:underline">
                    {booking.customer.email}
                  </a>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Phone Number</span>
                  <a href={`tel:${booking.customer.phone}`} className="font-medium">
                    {booking.customer.phone}
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Event Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                Event Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Venue</span>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{booking.event.venue}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Event Date</span>
                  <span className="font-medium">{formatDate(booking.event.date)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Time</span>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{booking.event.startTime} - {booking.event.endTime}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Event Type</span>
                  <span className="font-medium">{booking.event.type}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Guest Count</span>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{booking.event.guestCount} guests</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Admission Fee</span>
                  <span className="font-medium">{booking.event.admissionFee ? "Yes" : "No"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Setup and Services */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Pencil className="h-4 w-4" />
                Setup and Services
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Setup Style</span>
                  <span className="font-medium">{booking.setup.style}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Food & Beverage</span>
                  <div className="flex flex-wrap gap-1">
                    {booking.setup.foodType.map((food) => (
                      <Badge key={food} variant="secondary" className="text-xs">{food}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Special Needs & Equipment</span>
                <div className="flex flex-wrap gap-1">
                  {booking.setup.specialNeeds.map((need) => (
                    <Badge key={need} variant="outline" className="text-xs">{need}</Badge>
                  ))}
                </div>
              </div>
              {booking.setup.notes && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Additional Notes</span>
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                    {booking.setup.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agreement */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4" />
                Agreement
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Terms & Conditions</span>
                  <span className="font-medium text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Accepted
                  </span>
                </div>
                <div className="flex flex-col gap-1 text-right">
                  <span className="text-xs font-medium text-muted-foreground">Signed At</span>
                  <span className="text-sm">{formatDateTime(booking.agreement.signedAt)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Digital Signature</span>
                <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30">
                  <p className="text-sm text-muted-foreground italic">Signature preview placeholder</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-4 w-4" />
                  Payment Summary
                </CardTitle>
                <PaymentStatusBadge status={getPaymentDisplayStatus(booking.paymentStatus)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-2xl font-bold">{formatCurrency(booking.payment.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">Total Amount</p>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">{formatCurrency(booking.payment.depositAmount)}</p>
                    <p className="text-xs text-muted-foreground">Deposit (30%)</p>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(booking.payment.balanceAmount)}</p>
                    <p className="text-xs text-muted-foreground">Balance Due</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Deposit Due Date</p>
                      <p className="font-medium">{formatDate(booking.payment.depositDueDate)}</p>
                    </div>
                    {booking.payment.depositPaidAt ? (
                      <Badge className="bg-emerald-100 text-emerald-700">Paid</Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-300 text-amber-600">Pending</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Balance Due Date</p>
                      <p className="font-medium">{formatDate(booking.payment.balanceDueDate)}</p>
                    </div>
                    {booking.payment.balancePaidAt ? (
                      <Badge className="bg-emerald-100 text-emerald-700">Paid</Badge>
                    ) : (
                      <Badge variant="outline" className="border-gray-300 text-gray-600">Pending</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Internal Admin Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                Internal Admin Notes
              </CardTitle>
              <CardDescription>Notes are only visible to admin staff</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button onClick={handleAddNote} disabled={!newNote.trim()}>Add</Button>
              </div>
              <div className="flex flex-col gap-3">
                {adminNotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
                ) : (
                  adminNotes.map((note) => (
                    <div key={note.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{note.author}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{note.content}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sticky Action Panel */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {booking.status === "pending" && (
                <>
                  <Button className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowApproveDialog(true)}>
                    <CheckCircle2 className="h-4 w-4" />
                    Approve Booking
                  </Button>
                  <Button variant="destructive" className="w-full justify-start gap-2" onClick={() => setShowRejectDialog(true)}>
                    <XCircle className="h-4 w-4" />
                    Reject Booking
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setShowRequestChangesDialog(true)}>
                    <Pencil className="h-4 w-4" />
                    Request Changes
                  </Button>
                </>
              )}
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setShowPaymentDialog(true)}>
                <CreditCard className="h-4 w-4" />
                Record Payment
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setShowMessageDialog(true)}>
                <Mail className="h-4 w-4" />
                Send Message
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Download className="h-4 w-4" />
                Download Summary
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Approve Booking Request</DialogTitle>
            <DialogDescription>
              Review pricing and send approval with deposit payment link
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5 py-4">
            {/* Booking Summary */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <h4 className="text-sm font-semibold mb-3">Booking Summary</h4>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium">{booking.customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Venue</span>
                  <span className="font-medium">{booking.event.venue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{formatDate(booking.event.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time</span>
                  <span className="font-medium">{booking.event.startTime} - {booking.event.endTime}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Pricing Summary */}
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-semibold">Pricing Details</h4>
              
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="venueRental" className="text-sm text-muted-foreground">Venue Rental Fee</Label>
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="venueRental"
                      type="number"
                      value={approvalPricing.venueRental}
                      onChange={(e) => setApprovalPricing(prev => ({ ...prev, venueRental: Number(e.target.value) }))}
                      className="pl-7 text-right h-9"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="addOns" className="text-sm text-muted-foreground">Add-ons (Equipment, etc.)</Label>
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="addOns"
                      type="number"
                      value={approvalPricing.addOns}
                      onChange={(e) => setApprovalPricing(prev => ({ ...prev, addOns: Number(e.target.value) }))}
                      className="pl-7 text-right h-9"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="foodServices" className="text-sm text-muted-foreground">Food & Services</Label>
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="foodServices"
                      type="number"
                      value={approvalPricing.foodServices}
                      onChange={(e) => setApprovalPricing(prev => ({ ...prev, foodServices: Number(e.target.value) }))}
                      className="pl-7 text-right h-9"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="taxes" className="text-sm text-muted-foreground">Taxes & Fees</Label>
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="taxes"
                      type="number"
                      value={approvalPricing.taxes}
                      onChange={(e) => setApprovalPricing(prev => ({ ...prev, taxes: Number(e.target.value) }))}
                      className="pl-7 text-right h-9"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Totals */}
              <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Total Amount</span>
                  <span className="font-bold text-lg">{formatCurrency(approvalTotal)}</span>
                </div>
              </div>

              {/* Deposit Settings */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="depositPercent" className="text-sm text-muted-foreground">Deposit Percentage</Label>
                  <div className="relative w-24">
                    <Input
                      id="depositPercent"
                      type="number"
                      min={0}
                      max={100}
                      value={approvalPricing.depositPercent}
                      onChange={(e) => setApprovalPricing(prev => ({ ...prev, depositPercent: Number(e.target.value) }))}
                      className="text-right pr-8 h-9"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="balanceDueDate" className="text-sm text-muted-foreground">Balance Due Date</Label>
                  <Input
                    id="balanceDueDate"
                    type="date"
                    value={approvalPricing.balanceDueDate}
                    onChange={(e) => setApprovalPricing(prev => ({ ...prev, balanceDueDate: e.target.value }))}
                    className="w-40 h-9"
                  />
                </div>
              </div>

              {/* Payment Breakdown */}
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deposit Amount ({approvalPricing.depositPercent}%)</span>
                    <span className="font-semibold text-primary">{formatCurrency(approvalDeposit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remaining Balance</span>
                    <span className="font-semibold">{formatCurrency(approvalBalance)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Balance due by</span>
                    <span>{formatDate(approvalPricing.balanceDueDate)}</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Email and Payment Options */}
            <div className="flex flex-col gap-4">
              <div className="flex items-start space-x-3 rounded-lg border p-3">
                <Checkbox
                  id="sendEmail"
                  checked={sendApprovalEmail}
                  onCheckedChange={(checked) => setSendApprovalEmail(checked === true)}
                  className="mt-0.5"
                />
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="sendEmail" className="cursor-pointer text-sm font-medium">
                    Send approval email with deposit payment link
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Customer will receive an email with booking confirmation and payment instructions
                  </p>
                </div>
              </div>

              {sendApprovalEmail && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="paymentMethod">Deposit Payment Method</Label>
                  <Select value={depositPaymentMethod} onValueChange={setDepositPaymentMethod}>
                    <SelectTrigger id="paymentMethod">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stripe">Stripe Payment Link</SelectItem>
                      <SelectItem value="invoice">Manual Invoice</SelectItem>
                      <SelectItem value="other">Other (specify in message)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label>Add a message (optional)</Label>
                <Textarea placeholder="Include any special instructions or notes for the customer..." rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowApproveDialog(false)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve and Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Booking Request</DialogTitle>
            <DialogDescription>
              This will reject the booking and notify the customer via email.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Reason for rejection <span className="text-red-500">*</span></Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unavailable">Venue unavailable</SelectItem>
                  <SelectItem value="capacity">Exceeds capacity</SelectItem>
                  <SelectItem value="policy">Policy violation</SelectItem>
                  <SelectItem value="incomplete">Incomplete information</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Additional details</Label>
              <Textarea placeholder="Provide more context for the customer..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => setShowRejectDialog(false)}>
              Reject Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Changes Dialog */}
      <Dialog open={showRequestChangesDialog} onOpenChange={setShowRequestChangesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>
              Ask the customer to modify their booking request.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>What changes are needed? <span className="text-red-500">*</span></Label>
              <Textarea placeholder="Describe the changes needed (e.g., different time slot, updated guest count, etc.)" rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestChangesDialog(false)}>Cancel</Button>
            <Button onClick={() => setShowRequestChangesDialog(false)}>Send Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Manually record a payment for this booking.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Payment Type <span className="text-red-500">*</span></Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit ({formatCurrency(booking.payment.depositAmount)})</SelectItem>
                  <SelectItem value="balance">Balance ({formatCurrency(booking.payment.balanceAmount)})</SelectItem>
                  <SelectItem value="full">Full Amount ({formatCurrency(booking.payment.totalAmount)})</SelectItem>
                  <SelectItem value="custom">Custom Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input type="number" placeholder="0.00" className="pl-7" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Payment Method <span className="text-red-500">*</span></Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="venmo">Venmo</SelectItem>
                  <SelectItem value="card">Credit/Debit Card</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Reference/Notes</Label>
              <Input placeholder="Check #, transaction ID, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
            <Button onClick={() => setShowPaymentDialog(false)}>Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Message to Customer</DialogTitle>
            <DialogDescription>
              Send an email to {booking.customer.email}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Subject <span className="text-red-500">*</span></Label>
              <Input placeholder="Email subject" defaultValue={`Regarding your booking request: ${booking.id}`} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Message <span className="text-red-500">*</span></Label>
              <Textarea placeholder="Type your message..." rows={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessageDialog(false)}>Cancel</Button>
            <Button onClick={() => setShowMessageDialog(false)}>
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
