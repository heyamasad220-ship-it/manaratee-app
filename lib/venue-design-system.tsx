"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import { ReactNode } from "react"

// =============================================================================
// DESIGN TOKENS - Venue Rental SaaS Theme
// =============================================================================

// Consistent spacing for page layouts
export const pageSpacing = {
  wrapper: "flex flex-col gap-4 sm:gap-6 p-4 sm:p-6",
  section: "flex flex-col gap-4",
  cardGrid: "grid gap-3 sm:gap-4",
}

// Consistent grid layouts
export const gridLayouts = {
  kpiCards: "grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-5",
  summaryCards: "grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4",
  formFields: "grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2",
  threeCol: "grid gap-4 lg:grid-cols-3",
  twoCol: "grid gap-4 lg:grid-cols-2",
}

// Status color system for venue rentals
export const statusColors = {
  // Booking workflow statuses
  pendingReview: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500", accent: "border-l-amber-500" },
  approved: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", accent: "border-l-emerald-500" },
  rejected: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", dot: "bg-red-500", accent: "border-l-red-500" },
  cancelled: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-600", dot: "bg-gray-400", accent: "border-l-gray-400" },
  completed: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", dot: "bg-violet-500", accent: "border-l-violet-500" },
  blocked: { bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-700", dot: "bg-slate-500", accent: "border-l-slate-500" },
  
  // Payment statuses
  depositPending: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", dot: "bg-orange-500", accent: "border-l-orange-500" },
  depositPaid: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", dot: "bg-blue-500", accent: "border-l-blue-500" },
  partiallyPaid: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-700", dot: "bg-sky-500", accent: "border-l-sky-500" },
  fullyPaid: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", accent: "border-l-emerald-500" },
  overdue: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", dot: "bg-red-500", accent: "border-l-red-500" },
  
  // General
  info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", dot: "bg-blue-500", accent: "border-l-blue-500" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500", accent: "border-l-amber-500" },
  success: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", accent: "border-l-emerald-500" },
  error: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", dot: "bg-red-500", accent: "border-l-red-500" },
}

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

// KPI Card Component - consistent across all dashboards
interface KpiCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  subtitle?: string
  trend?: { value: string; positive: boolean }
  accentColor: keyof typeof statusColors
}

export function KpiCard({ title, value, icon: Icon, subtitle, trend, accentColor }: KpiCardProps) {
  const colors = statusColors[accentColor]
  return (
    <Card className={cn("border-l-4", colors.accent)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", colors.bg)}>
            <Icon className={cn("h-5 w-5", colors.text)} />
          </div>
        </div>
        {subtitle && (
          <p className={cn("mt-1 text-xs", colors.text)}>{subtitle}</p>
        )}
        {trend && (
          <p className={cn("mt-1 text-xs", trend.positive ? "text-emerald-600" : "text-red-600")}>
            {trend.positive ? "+" : ""}{trend.value}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// Section Card - for dashboard sections
interface SectionCardProps {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  noPadding?: boolean
}

export function SectionCard({ title, description, action, children, className, noPadding }: SectionCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {description && <CardDescription className="mt-1">{description}</CardDescription>}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className={noPadding ? "p-0" : undefined}>
        {children}
      </CardContent>
    </Card>
  )
}

// Summary Row - for displaying key-value pairs
interface SummaryRowProps {
  label: string
  value: string | ReactNode
  muted?: boolean
  bold?: boolean
}

export function SummaryRow({ label, value, muted, bold }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={cn(muted ? "text-muted-foreground" : "text-foreground")}>{label}</span>
      <span className={cn(bold ? "font-semibold" : "font-medium", muted ? "text-muted-foreground" : "text-foreground")}>{value}</span>
    </div>
  )
}

// Info Box - for highlighted information
interface InfoBoxProps {
  variant: "info" | "warning" | "success" | "error"
  icon?: LucideIcon
  title?: string
  children: ReactNode
  className?: string
}

export function InfoBox({ variant, icon: Icon, title, children, className }: InfoBoxProps) {
  const colors = statusColors[variant]
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-3", colors.bg, colors.border, className)}>
      {Icon && <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", colors.text)} />}
      <div className="flex-1 min-w-0">
        {title && <p className={cn("text-sm font-medium", colors.text)}>{title}</p>}
        <div className={cn("text-sm", colors.text)}>{children}</div>
      </div>
    </div>
  )
}

// Detail Item - for displaying labeled data in detail views
interface DetailItemProps {
  icon?: LucideIcon
  label: string
  value: string | ReactNode
  className?: string
}

export function DetailItem({ icon: Icon, label, value, className }: DetailItemProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {Icon && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{typeof value === "string" ? value : value}</p>
      </div>
    </div>
  )
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function formatCurrency(amount: number, options?: { minimumFractionDigits?: number }): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date, options?: { includeTime?: boolean; short?: boolean }): string {
  const d = typeof date === "string" ? new Date(date) : date
  if (options?.short) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }
  if (options?.includeTime) {
    return d.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function formatTime(time: string): string {
  // If already formatted (e.g., "9:00 AM"), return as is
  if (time.includes("AM") || time.includes("PM")) return time
  // Otherwise try to parse and format
  try {
    const [hours, minutes] = time.split(":").map(Number)
    const period = hours >= 12 ? "PM" : "AM"
    const hour12 = hours % 12 || 12
    return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`
  } catch {
    return time
  }
}

// =============================================================================
// FORM STYLING CONSTANTS
// =============================================================================

export const formStyles = {
  input: "h-10 sm:h-11",
  select: "h-10 sm:h-11",
  textarea: "min-h-[80px]",
  label: "text-sm font-medium",
  description: "text-xs text-muted-foreground mt-1",
  required: "text-red-500",
  fieldGroup: "flex flex-col gap-2",
  section: "flex flex-col gap-4",
  divider: "border-t my-4",
}

// =============================================================================
// TABLE STYLING CONSTANTS
// =============================================================================

export const tableStyles = {
  wrapper: "overflow-x-auto -mx-px",
  table: "min-w-[800px]",
  header: "whitespace-nowrap",
  cell: "whitespace-nowrap",
  cellTruncate: "max-w-[200px] truncate",
}

// =============================================================================
// DIALOG STYLING CONSTANTS
// =============================================================================

export const dialogStyles = {
  content: "max-w-lg max-h-[90vh] overflow-y-auto",
  contentWide: "max-w-2xl max-h-[90vh] overflow-y-auto",
  section: "flex flex-col gap-4 py-4",
  footer: "border-t pt-4",
  footerButtons: "flex flex-col-reverse sm:flex-row sm:justify-end gap-2",
}
