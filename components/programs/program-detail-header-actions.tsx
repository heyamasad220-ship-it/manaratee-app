"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Eye, Link2, MoreHorizontal, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  buildProgramCustomerUrl,
  buildProgramRegistrationUrl,
} from "@/lib/programs/program-customer-url"

export function ProgramDetailHeaderActions({
  programId,
  programStatus,
  onEditProgram,
}: {
  programId: string
  programStatus: string
  onEditProgram?: () => void
}) {
  const router = useRouter()
  const [feedback, setFeedback] = React.useState<string | null>(null)

  function showFeedback(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 2500)
  }

  async function handlePreviewPublicPage() {
    const url = buildProgramCustomerUrl(programId, window.location.origin)
    window.open(url, "_blank", "noopener,noreferrer")
  }

  async function handleShareLink() {
    if (programStatus !== "active") {
      showFeedback("Set status to Active before sharing a registration link.")
      return
    }

    try {
      const url = buildProgramRegistrationUrl(programId, window.location.origin)
      await navigator.clipboard.writeText(url)
      showFeedback("Registration link copied.")
    } catch {
      showFeedback("Failed to copy link.")
    }
  }

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handlePreviewPublicPage}>
        <Eye className="mr-2 h-4 w-4" />
        Preview Public Page
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => void handleShareLink()}>
        <Link2 className="mr-2 h-4 w-4" />
        Share Link
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              onEditProgram?.()
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit program
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/programs/${programId}/offerings`)}>
            Manage offerings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {feedback ? (
        <p className="absolute right-0 top-full mt-1 text-xs text-muted-foreground">{feedback}</p>
      ) : null}
    </div>
  )
}
