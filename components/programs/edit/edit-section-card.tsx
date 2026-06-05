import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function EditSectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold leading-none">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}
