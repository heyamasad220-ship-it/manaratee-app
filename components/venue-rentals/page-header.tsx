"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
  children?: ReactNode
  className?: string
}

export function PageHeader({ title, description, action, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex items-center gap-2 shrink-0">
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

// Standardized page container for venue rental pages
interface PageContainerProps {
  children: ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:gap-6 p-4 sm:p-6", className)}>
      {children}
    </div>
  )
}

// Filter bar container
interface FilterBarProps {
  children: ReactNode
  className?: string
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      {children}
    </div>
  )
}

// Filter group for multiple filter controls
interface FilterGroupProps {
  children: ReactNode
  className?: string
}

export function FilterGroup({ children, className }: FilterGroupProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 sm:gap-3", className)}>
      {children}
    </div>
  )
}

// Empty state component for tables and lists
interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed p-8 sm:p-12 text-center", className)}>
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  )
}

// Stat card for KPI displays
interface StatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  description?: string
  trend?: {
    value: string
    positive: boolean
  }
  accentColor?: "amber" | "emerald" | "blue" | "orange" | "red" | "violet"
}

const accentColors = {
  amber: "border-l-amber-500 bg-amber-50 text-amber-600",
  emerald: "border-l-emerald-500 bg-emerald-50 text-emerald-600",
  blue: "border-l-blue-500 bg-blue-50 text-blue-600",
  orange: "border-l-orange-500 bg-orange-50 text-orange-600",
  red: "border-l-red-500 bg-red-50 text-red-600",
  violet: "border-l-violet-500 bg-violet-50 text-violet-600",
}

export function StatCard({ label, value, icon, description, trend, accentColor = "blue" }: StatCardProps) {
  const colors = accentColors[accentColor]
  const [borderColor, bgColor, textColor] = colors.split(" ")
  
  return (
    <div className={cn("rounded-lg border border-l-4 bg-card p-4", borderColor)}>
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
        {icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", bgColor)}>
            <div className={textColor}>{icon}</div>
          </div>
        )}
      </div>
      {description && (
        <p className={cn("mt-1 text-xs", textColor)}>{description}</p>
      )}
      {trend && (
        <p className={cn("mt-1 text-xs", trend.positive ? "text-emerald-600" : "text-red-600")}>
          {trend.positive ? "+" : ""}{trend.value}
        </p>
      )}
    </div>
  )
}
