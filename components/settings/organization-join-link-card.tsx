"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { buildOrganizationJoinUrl } from "@/lib/organizations/join-organization-url"

export function OrganizationJoinLinkCard({
  organizationName,
  organizationSlug,
}: {
  organizationName: string
  organizationSlug: string
}) {
  const joinUrl = buildOrganizationJoinUrl(organizationSlug)
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    await navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer join link</CardTitle>
        <CardDescription>
          Share this link so people can create an account and join {organizationName} without
          a staff invite. They&apos;ll get customer portal access and can register for programs.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <Input readOnly value={joinUrl} aria-label="Customer join link" />
        <Button type="button" variant="outline" onClick={() => void copyLink()}>
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy link
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
