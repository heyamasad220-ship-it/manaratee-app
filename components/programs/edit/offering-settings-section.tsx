import type { ReactNode } from "react"

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

export function OfferingSettingsAccordionItem({
  value,
  step,
  title,
  children,
  className,
}: {
  value: string
  step: number
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <AccordionItem
      value={value}
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-white shadow-none",
        className
      )}
    >
      <AccordionTrigger className="px-5 py-4 hover:no-underline data-[state=open]:border-b [&>svg]:ml-auto">
        <span className="flex items-center gap-3 text-left">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
            {step}
          </span>
          <span className="text-base font-semibold text-foreground">{title}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="px-5 pt-5 pb-6">{children}</AccordionContent>
    </AccordionItem>
  )
}
