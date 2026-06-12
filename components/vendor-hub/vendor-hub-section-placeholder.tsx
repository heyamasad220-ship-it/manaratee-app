import { Card, CardContent } from "@/components/ui/card"

export function VendorHubSectionPlaceholder({
  title,
  description,
  todo,
}: {
  title: string
  description: string
  todo?: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-6">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        {todo ? (
          <p className="rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">TODO:</span> {todo}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
