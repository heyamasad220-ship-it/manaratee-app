import { Badge } from "@/components/ui/badge"
import {
  campaignProspectStageLabel,
  displayCampaignProspectStage,
  type CampaignProspectAskType,
  type CampaignProspectStage,
} from "@/lib/donations/campaign-prospect-types"
import { cn } from "@/lib/utils"

const STAGE_CLASS: Record<CampaignProspectStage, string> = {
  identified: "bg-slate-100 text-slate-800 hover:bg-slate-100",
  assigned: "bg-slate-100 text-slate-800 hover:bg-slate-100",
  contacted: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  meeting_scheduled: "bg-violet-100 text-violet-800 hover:bg-violet-100",
  asked: "bg-amber-100 text-amber-900 hover:bg-amber-100",
  pledged: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  declined: "bg-red-100 text-red-800 hover:bg-red-100",
  no_response: "bg-muted text-muted-foreground hover:bg-muted",
}

export function CampaignProspectStageBadge({
  stage,
  askType,
  className,
}: {
  stage: CampaignProspectStage | string
  askType?: CampaignProspectAskType | null
  className?: string
}) {
  const key = displayCampaignProspectStage(stage)

  return (
    <Badge variant="secondary" className={cn(STAGE_CLASS[key], className)}>
      {campaignProspectStageLabel(key, askType)}
    </Badge>
  )
}
