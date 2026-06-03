"use client"

import Link from "next/link"
import { ExternalLink, Eye, MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function RegistrationRowActions({
  registrationId,
  recordType,
  programId,
}: {
  registrationId: string
  recordType: "enrollment" | "waitlist"
  programId: string | null
}) {
  const registrationHref =
    recordType === "enrollment"
      ? `/programs/registrations/${registrationId}`
      : `/programs/registrations/waitlist/${registrationId}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Registration actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={registrationHref} className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            View Registration
          </Link>
        </DropdownMenuItem>

        {programId ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href={`/programs/${programId}`}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View Program
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
