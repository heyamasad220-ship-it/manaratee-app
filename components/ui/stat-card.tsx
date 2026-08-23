import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** Standard width for KPI / summary cards in a row. */
export const statCardWidthClassName = "w-52 shrink-0"

/** Flex row for KPI cards — each child uses a uniform width. */
export const statCardsRowClassName = "flex flex-wrap gap-4"

/** Full-width equal columns for HR directory KPI rows. */
export const statCardsEqualRowClassName = "grid w-full items-stretch gap-4"

export const STAT_CARD_TONES = {
  blue: {
    card: "border-blue-200 bg-blue-50 shadow-none",
    label: "text-blue-700",
    value: "text-blue-950",
    hint: "text-blue-700/75",
    icon: "text-blue-600",
    iconWrap: "bg-blue-100",
  },
  emerald: {
    card: "border-emerald-200 bg-emerald-50 shadow-none",
    label: "text-emerald-700",
    value: "text-emerald-950",
    hint: "text-emerald-700/75",
    icon: "text-emerald-600",
    iconWrap: "bg-emerald-100",
  },
  sky: {
    card: "border-sky-200 bg-sky-50 shadow-none",
    label: "text-sky-700",
    value: "text-sky-950",
    hint: "text-sky-700/75",
    icon: "text-sky-600",
    iconWrap: "bg-sky-100",
  },
  violet: {
    card: "border-violet-200 bg-violet-50 shadow-none",
    label: "text-violet-700",
    value: "text-violet-950",
    hint: "text-violet-700/75",
    icon: "text-violet-600",
    iconWrap: "bg-violet-100",
  },
  amber: {
    card: "border-amber-200 bg-amber-50 shadow-none",
    label: "text-amber-800",
    value: "text-amber-950",
    hint: "text-amber-800/75",
    icon: "text-amber-600",
    iconWrap: "bg-amber-100",
  },
  rose: {
    card: "border-rose-200 bg-rose-50 shadow-none",
    label: "text-rose-700",
    value: "text-rose-950",
    hint: "text-rose-700/75",
    icon: "text-rose-600",
    iconWrap: "bg-rose-100",
  },
  slate: {
    card: "border-slate-200 bg-slate-50 shadow-none",
    label: "text-slate-600",
    value: "text-slate-950",
    hint: "text-slate-600/75",
    icon: "text-slate-500",
    iconWrap: "bg-slate-100",
  },
  teal: {
    card: "border-teal-200 bg-teal-50 shadow-none",
    label: "text-teal-700",
    value: "text-teal-950",
    hint: "text-teal-700/75",
    icon: "text-teal-600",
    iconWrap: "bg-teal-100",
  },
  orange: {
    card: "border-orange-200 bg-orange-50 shadow-none",
    label: "text-orange-700",
    value: "text-orange-950",
    hint: "text-orange-700/75",
    icon: "text-orange-600",
    iconWrap: "bg-orange-100",
  },
  indigo: {
    card: "border-indigo-200 bg-indigo-50 shadow-none",
    label: "text-indigo-700",
    value: "text-indigo-950",
    hint: "text-indigo-700/75",
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
  /** Soft tinted background / border color. */
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

  if (layout === "header") {
    return (
      <Card
        className={cn(
          widthClass,
          fill && "flex h-full flex-col",
          colors?.card,
          className
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
          <CardTitle
            className={cn(
              "text-sm font-medium",
              colors?.label ?? "text-muted-foreground"
            )}
          >
            {label}
          </CardTitle>
          {Icon ? (
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                colors?.icon ?? "text-muted-foreground",
                iconClassName
              )}
            />
          ) : null}
        </CardHeader>
        <CardContent className={cn(fill && "flex flex-1 flex-col")}>
          <div className={valueClasses}>{value}</div>
          {hint ? (
            <p className={cn("mt-1 text-xs", colors?.hint ?? "text-muted-foreground")}>{hint}</p>
          ) : null}
          {footer}
        </CardContent>
      </Card>
    )
  }

  if (layout === "compact") {
    return (
      <Card className={cn(widthClass, colors?.card, className)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            {Icon ? (
              <Icon className={cn("h-4 w-4", colors?.icon ?? "text-muted-foreground", iconClassName)} />
            ) : null}
            <div className={valueClasses}>{value}</div>
          </div>
          <div className={cn("whitespace-nowrap text-sm", colors?.label ?? "text-muted-foreground")}>
            {label}
          </div>
          {footer}
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
