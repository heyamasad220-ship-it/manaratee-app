"use client"

import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

type ContactProfileCollapsibleSectionProps = {
  id?: string
  title: string
  count?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  className?: string
}

export function ContactProfileCollapsibleSection({
  id,
  title,
  count,
  open,
  onOpenChange,
  children,
  className,
}: ContactProfileCollapsibleSectionProps) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className={cn("rounded-lg border", className)}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          id={id}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
        >
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            {count != null ? (
              <Badge variant="secondary" className="font-normal tabular-nums">
                {count}
              </Badge>
            ) : null}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open ? "rotate-180" : ""
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-4 py-3">{children}</CollapsibleContent>
    </Collapsible>
  )
}
