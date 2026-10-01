import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** Standard width for KPI / summary cards in a row. */
export const statCardWidthClassName = "w-52 shrink-0"

/** Flex row for KPI cards — each child uses a uniform width. */
export const statCardsRowClassName = "flex flex-wrap gap-4"

/** Full-width equal columns for HR directory KPI rows. */
export const statCardsEqualRowClassName = "grid w-full items-stretch gap-4"

export const STAT_CARD_TONES = {
  blue: {
    card: "border-l-4 border-l-blue-500 shadow-sm",
    label: "text-muted-foreground",
    value: "text-foreground",
    hint: "text-muted-foreground",
    icon: "text-blue-600",
    iconWrap: "bg-blue-100",
  },
  emerald: {
    card: "border-l-4 border-l-emerald-500 shadow-sm",
    label: "text-muted-foreground",
    value: "text-foreground",
    hint: "text-muted-foreground",
    icon: "text-emerald-600",
    iconWrap: "bg-emerald-100",
  },
  sky: {
    card: "border-l-4 border-l-sky-500 shadow-sm",
    label: "text-muted-foreground",
    value: "text-foreground",
    hint: "text-muted-foreground",
    icon: "text-sky-600",
    iconWrap: "bg-sky-100",
  },
  violet: {
    card: "border-l-4 border-l-violet-500 shadow-sm",
    label: "text-muted-foreground",
    value: "text-foreground",
    hint: "text-muted-foreground",
    icon: "text-violet-600",
    iconWrap: "bg-violet-100",
  },
  amber: {
    card: "border-l-4 border-l-amber-500 shadow-sm",
    label: "text-muted-foreground",
    value: "text-foreground",
    hint: "text-muted-foreground",
    icon: "text-amber-600",
    iconWrap: "bg-amber-100",
  },
  rose: {
    card: "border-l-4 border-l-rose-500 shadow-sm",
    label: "text-muted-foreground",
    value: "text-foreground",
    hint: "text-muted-foreground",
    icon: "text-rose-600",
    iconWrap: "bg-rose-100",
  },
  slate: {
    card: "border-l-4 border-l-slate-400 shadow-sm",
    label: "text-muted-foreground",
    value: "text-foreground",
    hint: "text-muted-foreground",
    icon: "text-slate-500",
    iconWrap: "bg-slate-100",
  },
  teal: {
    card: "border-l-4 border-l-teal-500 shadow-sm",
    label: "text-muted-foreground",
    value: "text-foreground",
    hint: "text-muted-foreground",
    icon: "text-teal-600",
    iconWrap: "bg-teal-100",
  },
  orange: {
    card: "border-l-4 border-l-orange-500 shadow-sm",
    label: "text-muted-foreground",
    value: "text-foreground",
    hint: "text-muted-foreground",
    icon: "text-orange-600",
    iconWrap: "bg-orange-100",
  },
  indigo: {
    card: "border-l-4 border-l-indigo-500 shadow-sm",
    label: "text-muted-foreground",
    value: "text-foreground",
    hint: "text-muted-foreground",
    icon: "text-indigo-600",
    iconWrap: "bg-indigo-100",
  },
} as const

export type StatCardTone = keyof typeof STAT_CARD_TONES

export function StatCardsRow({
  children,
  className,
  equal,
  columns,
}: {
  children: ReactNode
  className?: string
  /** Stretch cards evenly across the full row width. */
  equal?: boolean
  /** Column count when `equal` (default 4). Use 5 for Employees, 6 for department overview. */
  columns?: 2 | 3 | 4 | 5 | 6
}) {
  if (equal) {
    const cols = columns ?? 4
    return (
      <div
        className={cn(
          statCardsEqualRowClassName,
          cols === 2 && "grid-cols-1 sm:grid-cols-2",
          cols === 3 && "grid-cols-1 sm:grid-cols-3",
          cols === 4 && "grid-cols-2 lg:grid-cols-4",
          cols === 5 && "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5",
          cols === 6 && "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6",
          className
        )}
      >
        {children}
      </div>
    )
  }

  return <div className={cn(statCardsRowClassName, className)}>{children}</div>
}

type StatCardProps = {
  label: string
  value: ReactNode
  icon?: LucideIcon
  hint?: string
  footer?: ReactNode
  layout?: "compact" | "default" | "header"
  className?: string
  iconClassName?: string
  valueClassName?: string
  /** Colored left edge and icon, matching Vendor Hub Overview. */
  tone?: StatCardTone
  /** Grow to fill equal-row grid cells instead of fixed width. */
  fill?: boolean
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  footer,
  layout = "default",
  className,
  iconClassName,
  valueClassName,
  tone,
  fill = false,
}: StatCardProps) {
  const colors = tone ? STAT_CARD_TONES[tone] : null
  const widthClass = fill ? "w-full min-w-0" : statCardWidthClassName
  const valueClasses = cn(
    "text-2xl font-bold tabular-nums",
    colors?.value,
    valueClassName
  )

  if (layout === "header" || layout === "compact") {
    return (
      <Card
        className={cn(
          "h-full",
          widthClass,
          fill && "flex flex-col",
          colors?.card,
          className
        )}
      >
        <CardContent className="flex h-full flex-col justify-center p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium leading-tight text-muted-foreground">{label}</p>
              <div className={cn("mt-0.5 text-lg font-bold leading-tight tabular-nums", valueClassName)}>
                {value}
              </div>
              {hint ? (
                <p className="mt-0.5 text-xs leading-tight text-muted-foreground">{hint}</p>
              ) : null}
              {footer}
            </div>
            {Icon ? (
              <div className={cn("shrink-0 rounded-full p-2", colors?.iconWrap ?? "bg-muted")}>
                <Icon
                  className={cn(
                    "h-4 w-4",
                    colors?.icon ?? "text-muted-foreground",
                    iconClassName
                  )}
                />
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(widthClass, colors?.card, className)}>
      <CardContent className="flex items-center gap-4 p-4 sm:p-6">
        <div>
          <p className={cn("whitespace-nowrap text-sm", colors?.label ?? "text-muted-foreground")}>
            {label}
          </p>
          <div className={valueClasses}>{value}</div>
          {hint ? (
            <p className={cn("mt-1 max-w-xs text-xs", colors?.hint ?? "text-muted-foreground")}>
              {hint}
            </p>
          ) : null}
          {footer}
        </div>
        {Icon ? (
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              colors?.iconWrap ?? "bg-primary/10"
            )}
          >
            <Icon className={cn("size-5", colors?.icon ?? "text-primary", iconClassName)} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
