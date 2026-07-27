import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function EditSectionCard({
  title,
  description,
  children,
  className,
  /** When true, render fields only — no nested card chrome (for settings page). */
  plain = false,
}: {
  title?: string
  description?: string
  children: ReactNode
  className?: string
  plain?: boolean
}) {
  if (plain) {
    return (
      <div className={cn("space-y-3", className)}>
        {title ? (
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {description ? (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
        ) : null}
        <div>{children}</div>
      </div>
    )
  }

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
