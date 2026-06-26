import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export const DONATION_METRIC_ACCENTS = [
  "blue",
  "emerald",
  "amber",
  "purple",
  "violet",
  "rose",
  "cyan",
] as const

export type DonationMetricAccent = (typeof DONATION_METRIC_ACCENTS)[number]

const ACCENT_STYLES: Record<
  DonationMetricAccent,
  { card: string; iconWrap: string; icon: string; value?: string }
> = {
  blue: {
    card: "border-l-4 border-l-blue-500",
    iconWrap: "rounded-full bg-blue-100 p-3",
    icon: "text-blue-600",
  },
  emerald: {
    card: "border-l-4 border-l-emerald-500",
    iconWrap: "rounded-full bg-emerald-100 p-3",
    icon: "text-emerald-600",
    value: "text-emerald-600",
  },
  amber: {
    card: "border-l-4 border-l-amber-500",
    iconWrap: "rounded-full bg-amber-100 p-3",
    icon: "text-amber-600",
    value: "text-amber-600",
  },
  purple: {
    card: "border-l-4 border-l-purple-500",
    iconWrap: "rounded-full bg-purple-100 p-3",
    icon: "text-purple-600",
  },
  violet: {
    card: "border-l-4 border-l-violet-500",
    iconWrap: "rounded-full bg-violet-100 p-3",
    icon: "text-violet-600",
  },
  rose: {
    card: "border-l-4 border-l-rose-500",
    iconWrap: "rounded-full bg-rose-100 p-3",
    icon: "text-rose-600",
  },
  cyan: {
    card: "border-l-4 border-l-cyan-500",
    iconWrap: "rounded-full bg-cyan-100 p-3",
    icon: "text-cyan-600",
  },
}

type DonationMetricCardProps = {
  title: string
  value?: ReactNode
  icon?: LucideIcon
  description?: ReactNode
  accent?: DonationMetricAccent
  className?: string
  valueClassName?: string
  onValueClick?: () => void
}

function MetricValue({
  value,
  valueClassName,
  styles,
  onValueClick,
}: {
  value: ReactNode
  valueClassName?: string
  styles: { value?: string } | null
  onValueClick?: () => void
}) {
  const className = cn(
    "mt-1 text-2xl font-bold",
    styles?.value,
    valueClassName,
    onValueClick && "cursor-pointer transition hover:underline"
  )

  if (onValueClick) {
    return (
      <button type="button" onClick={onValueClick} className={cn(className, "text-left")}>
        {value}
      </button>
    )
  }

  return <div className={className}>{value}</div>
}

export function DonationMetricCard({
  title,
  value,
  icon: Icon,
  description,
  accent,
  className,
  valueClassName,
  onValueClick,
}: DonationMetricCardProps) {
  const styles = accent ? ACCENT_STYLES[accent] : null

  if (styles) {
    return (
      <Card className={cn("h-full", styles.card, className)}>
        <CardContent className="flex h-full flex-col justify-center pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              {value != null && value !== "" ? (
                <MetricValue
                  value={value}
                  valueClassName={valueClassName}
                  styles={styles}
                  onValueClick={onValueClick}
                />
              ) : null}
              {description ? (
                <div
                  className={cn(
                    "text-xs text-muted-foreground",
                    value != null && value !== "" && "mt-1"
                  )}
                >
                  {description}
                </div>
              ) : null}
            </div>
            {Icon ? (
              <div className={cn(styles.iconWrap, "shrink-0")}>
                <Icon className={cn("h-5 w-5", styles.icon)} />
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
      </CardHeader>
      <CardContent>
        {value != null && value !== "" ? (
          <MetricValue
            value={value}
            valueClassName={valueClassName}
            styles={null}
            onValueClick={onValueClick}
          />
        ) : null}
        {description ? (
          <div className={cn("text-xs text-muted-foreground", value != null && value !== "" && "mt-1")}>
            {description}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

type DonationMetricCardGridProps = {
  children: ReactNode
  className?: string
  columns?: 2 | 3 | 4
  colorful?: boolean
}

export function DonationMetricCardGrid({
  children,
  className,
  columns = 4,
  colorful = false,
}: DonationMetricCardGridProps) {
  const columnClass =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "sm:grid-cols-2 lg:grid-cols-4"

  if (colorful) {
    return (
      <div className={cn("grid grid-cols-1 gap-4", columnClass, className)}>{children}</div>
    )
  }

  return (
    <div className={cn("flex flex-wrap gap-4 [&>*]:w-fit", className)}>{children}</div>
  )
}
