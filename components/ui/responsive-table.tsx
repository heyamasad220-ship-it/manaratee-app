"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"

// Wrapper that makes tables horizontally scrollable on mobile
export function ResponsiveTableWrapper({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0", className)}>
      <div className="min-w-[640px] sm:min-w-0">
        {children}
      </div>
    </div>
  )
}

// Mobile-friendly card list alternative to tables
interface MobileCardListProps<T> {
  data: T[]
  renderCard: (item: T, index: number) => React.ReactNode
  className?: string
}

export function MobileCardList<T>({ data, renderCard, className }: MobileCardListProps<T>) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {data.map((item, index) => renderCard(item, index))}
    </div>
  )
}

// Responsive container that shows table on desktop and cards on mobile
interface ResponsiveDataViewProps<T> {
  data: T[]
  renderTable: () => React.ReactNode
  renderCard: (item: T, index: number) => React.ReactNode
  breakpoint?: "sm" | "md" | "lg"
}

export function ResponsiveDataView<T>({ 
  data, 
  renderTable, 
  renderCard,
  breakpoint = "md" 
}: ResponsiveDataViewProps<T>) {
  const breakpointClass = {
    sm: "hidden sm:block",
    md: "hidden md:block",
    lg: "hidden lg:block",
  }[breakpoint]
  
  const mobileClass = {
    sm: "sm:hidden",
    md: "md:hidden",
    lg: "lg:hidden",
  }[breakpoint]

  return (
    <>
      {/* Desktop Table View */}
      <div className={breakpointClass}>
        {renderTable()}
      </div>
      
      {/* Mobile Card View */}
      <div className={mobileClass}>
        <MobileCardList data={data} renderCard={renderCard} />
      </div>
    </>
  )
}

// Simple data row for mobile cards
export function MobileDataRow({ 
  label, 
  value, 
  className 
}: { 
  label: string
  value: React.ReactNode
  className?: string 
}) {
  return (
    <div className={cn("flex items-center justify-between py-1.5 text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

// Re-export table components for convenience
export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow }
