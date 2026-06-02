"use client"

import { Loader2 } from "lucide-react"
import type { ContactTimelineItem } from "@/lib/contacts/contact-profile-data"
import { formatContactDate, formatContactMoney } from "@/lib/contacts/contact-profile-data"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

type ContactTimelinePanelProps = {
  items: ContactTimelineItem[]
  loading?: boolean
}

export function ContactTimelinePanel({ items, loading = false }: ContactTimelinePanelProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading timeline...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Timeline</h2>
          <p className="text-sm text-muted-foreground">
            Important events across contacts, teams, programs, and other modules.
          </p>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No timeline activity yet.</p>
        ) : (
          <div className="relative flex flex-col gap-0">
            {items.map((item, index) => (
              <div key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
                {index < items.length - 1 && (
                  <span className="absolute left-[7px] top-3 h-full w-px bg-border" />
                )}
                <span className="relative mt-1.5 size-3.5 shrink-0 rounded-full border-2 border-primary bg-background" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.title}</p>
                    <Badge variant="outline" className="text-xs">
                      {item.module}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatContactDate(item.date)}
                    {item.amount != null && item.amount > 0 && (
                      <> · {formatContactMoney(item.amount)}</>
                    )}
                    {item.status && <> · {item.status.replace(/_/g, " ")}</>}
                  </p>
                  {item.subtitle && (
                    <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
