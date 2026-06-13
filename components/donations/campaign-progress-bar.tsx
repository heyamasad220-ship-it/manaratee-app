import { cn } from "@/lib/utils"

type CampaignProgressBarProps = {
  progressPercent: number | null
  className?: string
  barClassName?: string
}

export function CampaignProgressBar({
  progressPercent,
  className,
  barClassName,
}: CampaignProgressBarProps) {
  const percent = progressPercent ?? 0
  const label = progressPercent == null ? "—" : `${Math.round(percent)}%`

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>Progress</span>
        <span>{label}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={cn("h-2 rounded-full bg-primary transition-all", barClassName)}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  )
}
