import { ChevronRight } from "lucide-react"

export function PlatformHeader({
  title,
  breadcrumb,
}: {
  title: string
  breadcrumb?: string
}) {
  return (
    <header className="flex items-center gap-3 border-b border-border bg-card px-6 py-4">
      {breadcrumb && (
        <>
          <span className="text-sm text-muted-foreground">{breadcrumb}</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </>
      )}
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
    </header>
  )
}
