import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** Standard width for KPI / summary cards in a row. */
export const statCardWidthClassName = "w-52 shrink-0"

/** Flex row for KPI cards — each child uses a uniform width. */
export const statCardsRowClassName = "flex flex-wrap gap-4"

export function StatCardsRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn(statCardsRowClassName, className)}>{children}</div>
}

type StatCardProps = {
  label: string
  value: string | number
  icon?: LucideIcon
  hint?: string
  footer?: ReactNode
  layout?: "compact" | "default" | "header"
  className?: string
  iconClassName?: string
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
}: StatCardProps) {
  if (layout === "header") {
    return (
      <Card className={cn(statCardWidthClassName, className)}>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
          <CardTitle className="whitespace-nowrap text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          {Icon ? (
            <Icon className={cn("h-4 w-4 shrink-0 text-muted-foreground", iconClassName)} />
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
          {footer}
        </CardContent>
      </Card>
    )
  }

  if (layout === "compact") {
    return (
      <Card className={cn(statCardWidthClassName, className)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
            <div className="text-2xl font-bold tabular-nums">{value}</div>
          </div>
          <div className="whitespace-nowrap text-sm text-muted-foreground">{label}</div>
          {footer}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(statCardWidthClassName, className)}>
      <CardContent className="flex items-center gap-4 p-4 sm:p-6">
        <div>
          <p className="whitespace-nowrap text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          {hint ? <p className="mt-1 max-w-xs text-xs text-muted-foreground">{hint}</p> : null}
          {footer}
        </div>
        {Icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Icon className={cn("size-5 text-primary", iconClassName)} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
