"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  buildOrganizationDonationJoinUrl,
  buildOrganizationJoinUrl,
} from "@/lib/organizations/join-organization-url"

function CopyLinkButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button type="button" variant="outline" onClick={() => void copyLink()} className="shrink-0">
      {copied ? (
        <>
          <Check className="mr-2 h-4 w-4" />
          Copied
        </>
      ) : (
        <>
          <Copy className="mr-2 h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  )
}

export function OrganizationJoinLinkCard({
  organizationName,
  organizationSlug,
}: {
  organizationName: string
  organizationSlug: string
}) {
  const joinUrl = buildOrganizationJoinUrl(organizationSlug)
  const donorJoinUrl = buildOrganizationDonationJoinUrl(organizationSlug)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer join links</CardTitle>
        <CardDescription>
          Share these links so people can create an account and join {organizationName} without a
          staff invite.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="customer-join-link">General customer portal</Label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="customer-join-link"
              readOnly
              value={joinUrl}
              aria-label="Customer join link"
            />
            <CopyLinkButton url={joinUrl} label="Copy link" />
          </div>
          <p className="text-xs text-muted-foreground">
            After signup, they land on the customer dashboard and can register for programs.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="donor-join-link">Donor signup and give</Label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="donor-join-link"
              readOnly
              value={donorJoinUrl}
              aria-label="Donor join and donate link"
            />
            <CopyLinkButton url={donorJoinUrl} label="Copy donor link" />
          </div>
          <p className="text-xs text-muted-foreground">
            After signup, they go straight to online giving (requires Donations module and Stripe
            Connect under Donations → Settings → Online Payments).
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
