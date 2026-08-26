import { Badge } from "@/components/ui/badge"
import {
  CAMPAIGN_PROSPECT_ASK_TYPE_LABELS,
  type CampaignProspectAskType,
  normalizeProspectAskType,
} from "@/lib/donations/campaign-prospect-types"
import { cn } from "@/lib/utils"

const ASK_TYPE_CLASS: Record<CampaignProspectAskType, string> = {
  donation: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  sponsorship: "bg-teal-50 text-teal-800 hover:bg-teal-50",
}

export function CampaignProspectAskTypeBadge({
  askType,
  className,
}: {
  askType: CampaignProspectAskType | string | null | undefined
  className?: string
}) {
  const key = normalizeProspectAskType(askType)

  return (
    <Badge variant="secondary" className={cn(ASK_TYPE_CLASS[key], className)}>
      {CAMPAIGN_PROSPECT_ASK_TYPE_LABELS[key]}
    </Badge>
  )
}
