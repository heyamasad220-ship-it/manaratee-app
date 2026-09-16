import { Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { staffModuleDisplayName } from "@/lib/modules/staff-module-labels"

const SUPPORT_EMAIL = "support@manaratee.com"

export function ModuleNotSubscribed({
  moduleSlug,
  moduleName,
}: {
  moduleSlug?: string
  moduleName?: string
}) {
  const name =
    moduleName ||
    (moduleSlug ? staffModuleDisplayName(moduleSlug) : "this module")
  const subject = `Enable ${name}`

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-base font-semibold tracking-tight">
            {name} is not included in your subscription
          </h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            This area needs {name}. Contact Manaratee to enable it for your
            organization.
          </p>
        </div>
        <Button asChild>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`}
          >
            Contact Manaratee
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
