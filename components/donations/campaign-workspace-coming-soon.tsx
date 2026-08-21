"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type CampaignWorkspaceComingSoonProps = {
  title: string
  description: string
}

export function CampaignWorkspaceComingSoon({
  title,
  description,
}: CampaignWorkspaceComingSoonProps) {
  return (
    <Card className="border border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
