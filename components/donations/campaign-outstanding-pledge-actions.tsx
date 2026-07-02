"use client"

import Link from "next/link"
import { MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { donationPledgesHref } from "@/lib/donations/donation-pledge-paths"

type CampaignOutstandingPledgeActionsProps = {
  pledgeId: string
}

export function CampaignOutstandingPledgeActions({
  pledgeId,
}: CampaignOutstandingPledgeActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Pledge actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={donationPledgesHref({ pledgeId, action: "view" })}>View pledge</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={donationPledgesHref({ pledgeId, action: "edit" })}>Edit pledge</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={donationPledgesHref({ pledgeId, action: "pay" })}>Record payment</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
