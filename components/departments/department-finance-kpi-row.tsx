"use client"

import { useCallback, useEffect, useState } from "react"
import { DollarSign, Receipt, TrendingUp, Users } from "lucide-react"

import { STAT_CARD_TONES, type StatCardTone } from "@/components/ui/stat-card"
import type { DepartmentStaffMember } from "@/lib/departments/department-actions"
import type { DepartmentFinanceSection } from "@/lib/donations/donation-group-path"
import {
  fetchDepartmentFinanceKpiExtrasAction,
  type DepartmentFinanceKpiExtras,
} from "@/lib/departments/department-finance-kpis"
import { cn } from "@/lib/utils"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const emptyExtras: DepartmentFinanceKpiExtras = {
  received: 0,
  expenses: 0,
  profit: 0,
}

export function DepartmentFinanceKpiRow({
  departmentId,
  staff,
  activeSection,
  onSelectSection,
  refreshToken = 0,
}: {
  departmentId: string
  staff: DepartmentStaffMember[]
  activeSection: DepartmentFinanceSection
  onSelectSection: (section: DepartmentFinanceSection) => void
  refreshToken?: number
}) {
  const [extras, setExtras] = useState<DepartmentFinanceKpiExtras>(emptyExtras)

  const load = useCallback(async () => {
    const result = await fetchDepartmentFinanceKpiExtrasAction(departmentId)
    if (result.success) setExtras(result.extras)
  }, [departmentId])

  const staffKey = staff
    .map((member) => `${member.staffId}:${member.employmentStatus || ""}`)
    .join("|")

  useEffect(() => {
    void load()
  }, [load, staffKey, refreshToken])

  const cards = [
    {
      key: "employees",
      section: "employees" as const,
      label: "Employees",
      value: staff.length,
      hint: "Assigned to department",
      tone: "blue" as const,
      icon: Users,
    },
    {
      key: "received",
      section: "budget" as const,
      label: "Revenue",
      value: formatCurrency(extras.received),
      hint: "Program fees collected",
      tone: "emerald" as const,
      icon: DollarSign,
    },
    {
      key: "expenses",
      section: "expenses" as const,
      label: "Expenses",
      value: formatCurrency(extras.expenses),
      hint: "Payroll + operating costs",
      tone: "amber" as const,
      icon: Receipt,
    },
    {
      key: "profit",
      section: "budget" as const,
      label: "Profit",
      value: formatCurrency(extras.profit),
      hint: "Revenue − expenses",
      tone: extras.profit >= 0 ? ("emerald" as const) : ("rose" as const),
      icon: TrendingUp,
    },
  ]

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}
    >
      {cards.map((card) => {
        const selected = activeSection === card.section
        const colors = STAT_CARD_TONES[card.tone as StatCardTone]
        const Icon = card.icon
        return (
          <button
            key={card.key}
            type="button"
            title={card.hint}
            aria-pressed={selected}
            onClick={() => onSelectSection(card.section)}
            className={cn(
              "min-w-0 rounded-xl border px-3 py-2 text-left shadow-none transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
              colors.card,
              selected && "ring-2 ring-sky-600"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className={cn("truncate text-xs font-medium", colors.label)}>
                {card.label}
              </p>
              <Icon className={cn("h-4 w-4 shrink-0", colors.icon)} />
            </div>
            <p className={cn("mt-1 truncate text-lg font-bold tabular-nums", colors.value)}>
              {card.value}
            </p>
            <p className={cn("truncate text-[11px] leading-tight", colors.hint)}>
              {card.hint}
            </p>
          </button>
        )
      })}
    </div>
  )
}
