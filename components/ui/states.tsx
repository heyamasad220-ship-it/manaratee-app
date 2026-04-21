"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Calendar,
  CalendarX,
  CreditCard,
  FileText,
  Inbox,
  Loader2,
  AlertCircle,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  DollarSign,
  CalendarDays,
  FileX,
} from "lucide-react"

// ============================================
// BASE COMPONENTS
// ============================================

interface BaseStateProps {
  className?: string
  children?: React.ReactNode
}

interface EmptyStateProps extends BaseStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
  secondaryAction?: {
    label: string
    onClick?: () => void
    href?: string
  }
}

interface LoadingStateProps extends BaseStateProps {
  title?: string
  description?: string
  variant?: "spinner" | "skeleton" | "dots"
}

interface ErrorStateProps extends BaseStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick?: () => void
  }
  variant?: "error" | "warning"
}

// ============================================
// EMPTY STATE COMPONENT
// ============================================

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      {icon && (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          {description}
        </p>
      )}
      {(action || secondaryAction || children) && (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {action && (
            <Button
              onClick={action.onClick}
              asChild={!!action.href}
            >
              {action.href ? (
                <a href={action.href}>{action.label}</a>
              ) : (
                action.label
              )}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              asChild={!!secondaryAction.href}
            >
              {secondaryAction.href ? (
                <a href={secondaryAction.href}>{secondaryAction.label}</a>
              ) : (
                secondaryAction.label
              )}
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  )
}

// ============================================
// LOADING STATE COMPONENT
// ============================================

export function LoadingState({
  title = "Loading...",
  description,
  variant = "spinner",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      {variant === "spinner" && (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      )}
      {variant === "dots" && (
        <div className="flex gap-1.5 mb-4">
          <div className="h-3 w-3 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <div className="h-3 w-3 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <div className="h-3 w-3 rounded-full bg-primary animate-bounce" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          {description}
        </p>
      )}
    </div>
  )
}

// ============================================
// ERROR STATE COMPONENT
// ============================================

export function ErrorState({
  icon,
  title,
  description,
  action,
  variant = "error",
  className,
}: ErrorStateProps) {
  const defaultIcon = variant === "error" ? (
    <XCircle className="h-8 w-8 text-red-500" />
  ) : (
    <AlertCircle className="h-8 w-8 text-amber-500" />
  )

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className={cn(
        "flex h-16 w-16 items-center justify-center rounded-full mb-4",
        variant === "error" ? "bg-red-100 dark:bg-red-950/50" : "bg-amber-100 dark:bg-amber-950/50"
      )}>
        {icon || defaultIcon}
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          variant={variant === "error" ? "default" : "outline"}
          className="mt-6"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {action.label}
        </Button>
      )}
    </div>
  )
}

// ============================================
// SKELETON LOADERS
// ============================================

export function CalendarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      {/* Days header */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export function BookingDetailsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      {/* Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-5 w-32 mb-4" />
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-5 w-32 mb-4" />
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Action buttons */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5, columns = 5, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header row */}
      <div className="flex gap-4 border-b pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-3 border-b border-muted/50">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================
// PRE-BUILT EMPTY STATES
// ============================================

export function NoBookingRequestsFound({ onRefresh, onCreateNew }: { onRefresh?: () => void; onCreateNew?: () => void }) {
  return (
    <EmptyState
      icon={<Inbox className="h-8 w-8 text-muted-foreground" />}
      title="No booking requests found"
      description="There are no booking requests matching your current filters. Try adjusting your filters or check back later."
      action={onRefresh ? { label: "Refresh", onClick: onRefresh } : undefined}
      secondaryAction={onCreateNew ? { label: "Create Manual Booking", onClick: onCreateNew } : undefined}
    />
  )
}

export function NoAvailableTimeSlots({ onChangeDate, onContactSupport }: { onChangeDate?: () => void; onContactSupport?: () => void }) {
  return (
    <EmptyState
      icon={<CalendarX className="h-8 w-8 text-muted-foreground" />}
      title="No available time slots"
      description="All time slots for this date are either booked or blocked. Please select a different date or venue."
      action={onChangeDate ? { label: "Select Different Date", onClick: onChangeDate } : undefined}
      secondaryAction={onContactSupport ? { label: "Contact Us", onClick: onContactSupport } : undefined}
    />
  )
}

export function NoPaymentsDue({ onViewHistory }: { onViewHistory?: () => void }) {
  return (
    <EmptyState
      icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
      title="No payments due"
      description="You're all caught up! There are no outstanding payments at this time."
      action={onViewHistory ? { label: "View Payment History", onClick: onViewHistory } : undefined}
    />
  )
}

export function NoReportsData({ onAdjustFilters, onExport }: { onAdjustFilters?: () => void; onExport?: () => void }) {
  return (
    <EmptyState
      icon={<BarChart3 className="h-8 w-8 text-muted-foreground" />}
      title="No data available"
      description="There's no data to display for the selected date range and filters. Try adjusting your filters to see more results."
      action={onAdjustFilters ? { label: "Adjust Filters", onClick: onAdjustFilters } : undefined}
      secondaryAction={onExport ? { label: "Export Empty Report", onClick: onExport } : undefined}
    />
  )
}

// ============================================
// PRE-BUILT LOADING STATES
// ============================================

export function LoadingCalendar() {
  return (
    <LoadingState
      title="Loading calendar"
      description="Fetching availability and bookings..."
      variant="spinner"
    />
  )
}

export function LoadingBookingDetails() {
  return (
    <LoadingState
      title="Loading booking details"
      description="Retrieving booking information..."
      variant="spinner"
    />
  )
}

export function LoadingPayments() {
  return (
    <LoadingState
      title="Loading payments"
      description="Fetching payment records..."
      variant="spinner"
    />
  )
}

// ============================================
// PRE-BUILT ERROR STATES
// ============================================

export function PaymentFailed({ onRetry, errorMessage }: { onRetry?: () => void; errorMessage?: string }) {
  return (
    <ErrorState
      icon={<CreditCard className="h-8 w-8 text-red-500" />}
      title="Payment failed"
      description={errorMessage || "We couldn't process your payment. Please check your payment details and try again."}
      action={onRetry ? { label: "Try Again", onClick: onRetry } : undefined}
      variant="error"
    />
  )
}

export function SubmissionFailed({ onRetry, errorMessage }: { onRetry?: () => void; errorMessage?: string }) {
  return (
    <ErrorState
      icon={<FileX className="h-8 w-8 text-red-500" />}
      title="Submission failed"
      description={errorMessage || "We couldn't submit your request. Please check your connection and try again."}
      action={onRetry ? { label: "Try Again", onClick: onRetry } : undefined}
      variant="error"
    />
  )
}

export function ApprovalFailed({ onRetry, errorMessage }: { onRetry?: () => void; errorMessage?: string }) {
  return (
    <ErrorState
      icon={<AlertCircle className="h-8 w-8 text-red-500" />}
      title="Approval failed"
      description={errorMessage || "We couldn't process this approval. Please try again or contact support if the issue persists."}
      action={onRetry ? { label: "Retry Approval", onClick: onRetry } : undefined}
      variant="error"
    />
  )
}

export function LoadFailed({ onRetry, errorMessage }: { onRetry?: () => void; errorMessage?: string }) {
  return (
    <ErrorState
      icon={<AlertCircle className="h-8 w-8 text-red-500" />}
      title="Failed to load"
      description={errorMessage || "Something went wrong while loading this content. Please try again."}
      action={onRetry ? { label: "Retry", onClick: onRetry } : undefined}
      variant="error"
    />
  )
}

// ============================================
// INLINE STATES (for cards, table cells, etc.)
// ============================================

export function InlineLoading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{text}</span>
    </div>
  )
}

export function InlineError({ text = "Error loading data", onRetry }: { text?: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-600">
      <AlertCircle className="h-4 w-4" />
      <span>{text}</span>
      {onRetry && (
        <button onClick={onRetry} className="underline hover:no-underline">
          Retry
        </button>
      )}
    </div>
  )
}

export function InlineEmpty({ text = "No data" }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="text-muted-foreground/60">—</span>
      <span>{text}</span>
    </div>
  )
}
