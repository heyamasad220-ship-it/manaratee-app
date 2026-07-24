"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type HrDirectoryTab = {
  id: string
  label: string
  count?: number
  href?: string
}

export function HrDirectoryShell({
  title,
  description,
  primaryAction,
  onExport,
  exportDisabled,
  tabs,
  activeTab,
  onTabChange,
  stats,
  filters,
  children,
  footer,
}: {
  title: string
  description: string
  primaryAction?: ReactNode
  onExport?: () => void
  exportDisabled?: boolean
  tabs: HrDirectoryTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  stats?: ReactNode
  filters?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onExport ? (
            <Button
              type="button"
              variant="outline"
              onClick={onExport}
              disabled={exportDisabled}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          ) : null}
          {primaryAction}
        </div>
      </div>

      {stats}

      <div className="flex gap-0 border-b border-border">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          const className = cn(
            "relative px-4 py-2.5 text-sm font-medium transition-colors",
            isActive
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )
          const label = (
            <>
              {tab.label}
              {typeof tab.count === "number" ? (
                <span className="ml-1.5 text-muted-foreground">({tab.count})</span>
              ) : null}
              {isActive ? (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
              ) : null}
            </>
          )

          if (tab.href) {
            return (
              <Link key={tab.id} href={tab.href} className={className}>
                {label}
              </Link>
            )
          }

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={className}
            >
              {label}
            </button>
          )
        })}
      </div>

      {filters}
      {children}
      {footer}
    </div>
  )
}

export function formatEmploymentTenure(startDate: string | null | undefined) {
  if (!startDate) return null
  const start = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null

  const now = new Date()
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 0) months = 0

  const years = Math.floor(months / 12)
  const remMonths = months % 12
  if (years <= 0) return `${remMonths}m`
  if (remMonths <= 0) return `${years}y`
  return `${years}y ${remMonths}m`
}

export function formatShortDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
