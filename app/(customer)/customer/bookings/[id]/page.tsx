"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  CreditCard,
  CheckCircle2,
  Circle,
  AlertCircle,
  DollarSign,
  FileText,
  Utensils,
  Settings2,
  MessageSquare,
  Download,
} from "lucide-react"
import { BookingStatusBadge, type BookingStatus } from "@/lib/status-badges"

// Mock booking data
const mockBooking = {
  id: "BK-2024-0042",
  status: "Deposit Pending" as const,
  customer: {
    name: "Sarah Johnson",
    email: "sarah.johnson@email.com",
    phone: "(555) 234-5678",
  },
  event: {
    venue: "Grand Hall",
    date: "2024-04-15",
    startTime: "2:00 PM",
    endTime: "10:00 PM",
    type: "Wedding Reception",
    guestCount: 150,
  },
  payment: {
    totalAmount: 5500,
    depositAmount: 1650,
    paidToDate: 0,
    balanceDue: 5500,
    depositDueDate: "2024-02-01",
    balanceDueDate: "2024-04-01",
  },
  details: {
    setupStyle: "Round tables with chairs",
    foodTypes: ["Full meal", "Coffee and tea"],
    specialNeeds: ["Sound system", "Projector", "Microphone"],
    notes: "Please ensure the venue is ready 2 hours before the event for decorators to set up. We will have a live band performing.",
    admissionFee: false,
  },
  timeline: [
    { event: "Request Submitted", date: "2024-01-10", time: "10:30 AM", completed: true },
    { event: "Booking Approved", date: "2024-01-12", time: "2:15 PM", completed: true },
    { event: "Deposit Due", date: "2024-02-01", time: "", completed: false, current: true },
    { event: "Balance Due", date: "2024-04-01", time: "", completed: false },
    { event: "Event Day", date: "2024-04-15", time: "2:00 PM", completed: false },
  ],
  createdAt: "2024-01-10",
}

export default function CustomerBookingDetailPage() {
  const params = useParams()
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState("card")
  const [isProcessing, setIsProcessing] = useState(false)

  const booking = mockBooking

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
  }

  const getPaymentButtonText = () => {
    if (booking.status === "Deposit Pending" || booking.status === "Approved") {
      return `Pay Deposit (${formatCurrency(booking.payment.depositAmount)})`
    }
    if (booking.status === "Deposit Paid") {
      return `Pay Remaining Balance (${formatCurrency(booking.payment.balanceDue)})`
    }
    return "Make Payment"
  }

  const getPaymentAmount = () => {
    if (booking.status === "Deposit Pending" || booking.status === "Approved") {
      return booking.payment.depositAmount
    }
    return booking.payment.balanceDue
  }

  const handlePayment = () => {
    setIsProcessing(true)
    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false)
      setShowPaymentDialog(false)
    }, 2000)
  }

  const showPayButton = ["Approved", "Deposit Pending", "Deposit Paid"].includes(booking.status)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <Link
            href="/customer/dashboard"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">Booking {booking.id}</h1>
                <BookingStatusBadge status={booking.status as BookingStatus} />
              </div>
              <p className="mt-1 text-muted-foreground">
                Submitted on {formatShortDate(booking.createdAt)}
              </p>
            </div>
            {showPayButton && (
              <Button size="lg" onClick={() => setShowPaymentDialog(true)}>
                <CreditCard className="mr-2 h-4 w-4" />
                {getPaymentButtonText()}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Main Content */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            {/* Event Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Event Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Venue</p>
                      <p className="font-semibold">{booking.event.venue}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Date</p>
                      <p className="font-semibold">{formatDate(booking.event.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Time</p>
                      <p className="font-semibold">{booking.event.startTime} - {booking.event.endTime}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Guest Count</p>
                      <p className="font-semibold">{booking.event.guestCount} guests</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 sm:col-span-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Event Type</p>
                      <p className="font-semibold">{booking.event.type}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Setup & Services */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-primary" />
                  Setup & Services
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Setup Style</p>
                  <p className="font-medium">{booking.details.setupStyle}</p>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Food & Beverage</p>
                  <div className="flex flex-wrap gap-2">
                    {booking.details.foodTypes.map((food, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        <Utensils className="h-3 w-3" />
                        {food}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Equipment & Special Needs</p>
                  <div className="flex flex-wrap gap-2">
                    {booking.details.specialNeeds.map((need, index) => (
                      <Badge key={index} variant="outline">
                        {need}
                      </Badge>
                    ))}
                  </div>
                </div>

                {booking.details.notes && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">Additional Notes</p>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-sm">{booking.details.notes}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Amount</span>
                    <span className="font-semibold">{formatCurrency(booking.payment.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deposit Required (30%)</span>
                    <span className="font-medium">{formatCurrency(booking.payment.depositAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span className="font-medium text-emerald-600">{formatCurrency(booking.payment.paidToDate)}</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Remaining Balance</span>
                      <span className="text-lg font-bold">{formatCurrency(booking.payment.balanceDue)}</span>
                    </div>
                  </div>
                </div>

                {/* Due Dates */}
                <div className="mt-4 flex flex-col gap-2 rounded-lg border-2 border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Payment Schedule</span>
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-amber-700 dark:text-amber-300">Deposit Due</span>
                      <span className="font-medium text-amber-800 dark:text-amber-200">{formatShortDate(booking.payment.depositDueDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-700 dark:text-amber-300">Balance Due</span>
                      <span className="font-medium text-amber-800 dark:text-amber-200">{formatShortDate(booking.payment.balanceDueDate)}</span>
                    </div>
                  </div>
                </div>

                {showPayButton && (
                  <Button className="mt-4 w-full" size="lg" onClick={() => setShowPaymentDialog(true)}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    {getPaymentButtonText()}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Timeline & Actions */}
          <div className="flex flex-col gap-6">
            {/* Booking Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Booking Timeline</CardTitle>
                <CardDescription>Track your booking progress</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative flex flex-col gap-0">
                  {booking.timeline.map((item, index) => (
                    <div key={index} className="relative flex gap-4 pb-6 last:pb-0">
                      {/* Line */}
                      {index < booking.timeline.length - 1 && (
                        <div
                          className={`absolute left-[11px] top-6 h-full w-0.5 ${
                            item.completed ? "bg-primary" : "bg-muted"
                          }`}
                        />
                      )}
                      {/* Icon */}
                      <div className="relative z-10">
                        {item.completed ? (
                          <CheckCircle2 className="h-6 w-6 text-primary" />
                        ) : item.current ? (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-background">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          </div>
                        ) : (
                          <Circle className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex flex-col">
                        <p className={`text-sm font-medium ${item.completed || item.current ? "text-foreground" : "text-muted-foreground"}`}>
                          {item.event}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatShortDate(item.date)}
                          {item.time && ` at ${item.time}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button variant="outline" className="justify-start" asChild>
                  <Link href="/customer/venue-availability">
                    <Calendar className="mr-2 h-4 w-4" />
                    View Venue Calendar
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start">
                  <Download className="mr-2 h-4 w-4" />
                  Download Booking Details
                </Button>
                <Button variant="outline" className="justify-start">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Contact Support
                </Button>
              </CardContent>
            </Card>

            {/* Need Help */}
            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <h4 className="mb-2 font-semibold">Need Help?</h4>
                <p className="mb-4 text-sm text-muted-foreground">
                  Have questions about your booking? Our team is here to assist you.
                </p>
                <Button variant="secondary" className="w-full">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Get Support
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Make Payment</DialogTitle>
            <DialogDescription>
              {booking.status === "Deposit Pending" || booking.status === "Approved"
                ? "Pay your deposit to confirm your booking"
                : "Pay the remaining balance for your booking"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5 py-4">
            {/* Amount */}
            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 text-center">
              <p className="text-sm text-muted-foreground">Amount Due</p>
              <p className="text-3xl font-bold text-primary">{formatCurrency(getPaymentAmount())}</p>
            </div>

            {/* Payment Method */}
            <div className="flex flex-col gap-3">
              <Label>Payment Method</Label>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="flex flex-col gap-2">
                <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                  <RadioGroupItem value="card" id="card" />
                  <Label htmlFor="card" className="flex flex-1 cursor-pointer items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Credit/Debit Card</p>
                      <p className="text-xs text-muted-foreground">Pay securely with Stripe</p>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                  <RadioGroupItem value="bank" id="bank" />
                  <Label htmlFor="bank" className="flex flex-1 cursor-pointer items-center gap-3">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Bank Transfer</p>
                      <p className="text-xs text-muted-foreground">ACH or wire transfer</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Booking Reference */}
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Booking Reference</p>
              <p className="font-medium">{booking.id}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
            <Button onClick={handlePayment} disabled={isProcessing}>
              {isProcessing ? "Processing..." : `Pay ${formatCurrency(getPaymentAmount())}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
