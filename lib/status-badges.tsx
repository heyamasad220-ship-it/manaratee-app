import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { EventStatus, OrderStatus } from "@/lib/mock-data"

// =============================================================================
// BOOKING STATUS BADGES
// =============================================================================

export type BookingStatus =
  | "Pending Review"
  | "Approved"
  | "Rejected"
  | "Deposit Pending"
  | "Deposit Paid"
  | "Partially Paid"
  | "Fully Paid"
  | "Cancelled"
  | "Completed"
  | "Blocked"

const bookingStatusStyles: Record<BookingStatus, string> = {
  "Pending Review": "bg-amber-100 text-amber-700 border-amber-200",
  "Approved": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Rejected": "bg-red-100 text-red-700 border-red-200",
  "Deposit Pending": "bg-orange-100 text-orange-700 border-orange-200",
  "Deposit Paid": "bg-blue-100 text-blue-700 border-blue-200",
  "Partially Paid": "bg-sky-100 text-sky-700 border-sky-200",
  "Fully Paid": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Cancelled": "bg-gray-100 text-gray-600 border-gray-200",
  "Completed": "bg-violet-100 text-violet-700 border-violet-200",
  "Blocked": "bg-slate-200 text-slate-700 border-slate-300",
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", bookingStatusStyles[status])}>
      {status}
    </Badge>
  )
}

// =============================================================================
// PAYMENT STATUS BADGES
// =============================================================================

export type PaymentStatus = "Unpaid" | "Partially Paid" | "Paid" | "Overdue"

const paymentStatusStyles: Record<PaymentStatus, string> = {
  "Unpaid": "bg-gray-100 text-gray-600 border-gray-200",
  "Partially Paid": "bg-amber-100 text-amber-700 border-amber-200",
  "Paid": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Overdue": "bg-red-100 text-red-700 border-red-200",
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", paymentStatusStyles[status])}>
      {status}
    </Badge>
  )
}

// =============================================================================
// DEPOSIT STATUS BADGES
// =============================================================================

export type DepositStatus = "Not Required" | "Pending" | "Paid" | "Overdue"

const depositStatusStyles: Record<DepositStatus, string> = {
  "Not Required": "bg-gray-100 text-gray-500 border-gray-200",
  "Pending": "bg-amber-100 text-amber-700 border-amber-200",
  "Paid": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Overdue": "bg-red-100 text-red-700 border-red-200",
}

export function DepositStatusBadge({ status }: { status: DepositStatus }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", depositStatusStyles[status])}>
      {status}
    </Badge>
  )
}

// =============================================================================
// BALANCE STATUS BADGES
// =============================================================================

export type BalanceStatus = "No Balance" | "Due" | "Paid" | "Overdue"

const balanceStatusStyles: Record<BalanceStatus, string> = {
  "No Balance": "bg-gray-100 text-gray-500 border-gray-200",
  "Due": "bg-amber-100 text-amber-700 border-amber-200",
  "Paid": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Overdue": "bg-red-100 text-red-700 border-red-200",
}

export function BalanceStatusBadge({ status }: { status: BalanceStatus }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", balanceStatusStyles[status])}>
      {status}
    </Badge>
  )
}

// =============================================================================
// EVENT STATUS BADGES (existing)
// =============================================================================

const eventStatusStyles: Record<EventStatus, string> = {
  Published: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Draft: "bg-amber-100 text-amber-700 border-amber-200",
  "Sales Closed": "bg-gray-100 text-gray-600 border-gray-200",
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", eventStatusStyles[status])}>
      {status}
    </Badge>
  )
}

// =============================================================================
// ORDER STATUS BADGES (existing)
// =============================================================================

const orderStatusStyles: Record<OrderStatus, string> = {
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Pending: "bg-amber-100 text-amber-700 border-amber-200",
  Canceled: "bg-red-100 text-red-700 border-red-200",
  Refunded: "bg-violet-100 text-violet-700 border-violet-200",
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", orderStatusStyles[status])}>
      {status}
    </Badge>
  )
}

// =============================================================================
// EMAIL DELIVERY STATUS BADGES
// =============================================================================

export type EmailDeliveryStatus = "Delivered" | "Opened" | "Clicked" | "Bounced" | "Failed" | "Pending"

const emailDeliveryStatusStyles: Record<EmailDeliveryStatus, string> = {
  "Delivered": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Opened": "bg-blue-100 text-blue-700 border-blue-200",
  "Clicked": "bg-violet-100 text-violet-700 border-violet-200",
  "Bounced": "bg-amber-100 text-amber-700 border-amber-200",
  "Failed": "bg-red-100 text-red-700 border-red-200",
  "Pending": "bg-gray-100 text-gray-600 border-gray-200",
}

export function EmailDeliveryStatusBadge({ status }: { status: EmailDeliveryStatus }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", emailDeliveryStatusStyles[status])}>
      {status}
    </Badge>
  )
}

// =============================================================================
// EMAIL TYPE BADGES
// =============================================================================

export type EmailType = 
  | "Booking Confirmation"
  | "Approval Notification"
  | "Rejection Notification"
  | "Deposit Request"
  | "Payment Received"
  | "Balance Reminder"

const emailTypeStyles: Record<EmailType, string> = {
  "Booking Confirmation": "bg-blue-100 text-blue-700 border-blue-200",
  "Approval Notification": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Rejection Notification": "bg-red-100 text-red-700 border-red-200",
  "Deposit Request": "bg-orange-100 text-orange-700 border-orange-200",
  "Payment Received": "bg-violet-100 text-violet-700 border-violet-200",
  "Balance Reminder": "bg-amber-100 text-amber-700 border-amber-200",
}

export function EmailTypeBadge({ type }: { type: EmailType }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", emailTypeStyles[type])}>
      {type}
    </Badge>
  )
}

// =============================================================================
// GENERIC STATUS BADGE (fallback)
// =============================================================================

// =============================================================================
// VENUE STATUS BADGES
// =============================================================================

export type VenueStatus = "Active" | "Inactive" | "Maintenance"

const venueStatusStyles: Record<VenueStatus, string> = {
  "Active": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Inactive": "bg-gray-100 text-gray-600 border-gray-200",
  "Maintenance": "bg-amber-100 text-amber-700 border-amber-200",
}

export function VenueStatusBadge({ status }: { status: VenueStatus }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", venueStatusStyles[status])}>
      {status}
    </Badge>
  )
}

// =============================================================================
// INTERNAL EVENT REQUEST STATUS BADGES
// =============================================================================

export type InternalEventStatus = 
  | "Submitted" 
  | "Pending Review" 
  | "Approved" 
  | "Needs Changes" 
  | "Rejected" 
  | "Scheduled" 
  | "Completed" 
  | "Cancelled"

const internalEventStatusStyles: Record<InternalEventStatus, string> = {
  "Submitted": "bg-blue-100 text-blue-700 border-blue-200",
  "Pending Review": "bg-amber-100 text-amber-700 border-amber-200",
  "Approved": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Needs Changes": "bg-orange-100 text-orange-700 border-orange-200",
  "Rejected": "bg-red-100 text-red-700 border-red-200",
  "Scheduled": "bg-violet-100 text-violet-700 border-violet-200",
  "Completed": "bg-slate-100 text-slate-700 border-slate-200",
  "Cancelled": "bg-gray-100 text-gray-600 border-gray-200",
}

export function InternalEventStatusBadge({ status }: { status: InternalEventStatus }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", internalEventStatusStyles[status])}>
      {status}
    </Badge>
  )
}

const allStatusStyles: Record<string, string> = {
  ...eventStatusStyles,
  ...orderStatusStyles,
  ...bookingStatusStyles,
  ...paymentStatusStyles,
  ...depositStatusStyles,
  ...balanceStatusStyles,
  ...emailDeliveryStatusStyles,
  ...emailTypeStyles,
  ...venueStatusStyles,
  ...internalEventStatusStyles,
  Closed: "bg-gray-100 text-gray-600 border-gray-200",
  Sent: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Processing: "bg-blue-100 text-blue-700 border-blue-200",
}

export function StatusBadge({ status }: { status: string }) {
  const style = allStatusStyles[status] ?? "bg-gray-100 text-gray-600 border-gray-200"
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", style)}>
      {status}
    </Badge>
  )
}

// =============================================================================
// UTILITY: Get status style class (for custom usage)
// =============================================================================

export function getBookingStatusStyle(status: BookingStatus): string {
  return bookingStatusStyles[status]
}

export function getPaymentStatusStyle(status: PaymentStatus): string {
  return paymentStatusStyles[status]
}

export function getDepositStatusStyle(status: DepositStatus): string {
  return depositStatusStyles[status]
}

export function getBalanceStatusStyle(status: BalanceStatus): string {
  return balanceStatusStyles[status]
}
