"use client"

import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { Check, Copy, ExternalLink, Link2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { BazaarFlyerField } from "@/components/vendor-hub/events/bazaar-flyer-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getBazaarShareLink,
  regenerateBazaarShareToken,
} from "@/lib/vendor-hub/bazaar-share-actions"
import { buildBazaarShareUrl } from "@/lib/vendor-hub/bazaar-share-url"
import type { VendorHubEventWithInternal } from "@/lib/vendor-hub/vendor-hub-types"

export function BazaarEventFlyerSharePanel({ event }: { event: VendorHubEventWithInternal }) {
  const [flyerUrl, setFlyerUrl] = useState(event.flyer_url ?? "")
  const [shareUrl, setShareUrl] = useState(
    event.public_share_token ? buildBazaarShareUrl(event.public_share_token) : ""
  )
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setFlyerUrl(event.flyer_url ?? "")
    setShareUrl(
      event.public_share_token ? buildBazaarShareUrl(event.public_share_token) : ""
    )
  }, [event.flyer_url, event.public_share_token])

  useEffect(() => {
    if (!shareUrl && event.id) {
      startTransition(async () => {
        try {
          const result = await getBazaarShareLink(event.id)
          setShareUrl(result.shareUrl)
        } catch (loadError) {
          console.error(loadError)
        }
      })
    }
  }, [event.id, shareUrl])

  async function handleCopyLink() {
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success("Share link copied")
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy link")
    }
  }

  function handleRegenerateLink() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await regenerateBazaarShareToken(event.id)
        setShareUrl(result.shareUrl)
        toast.success("New share link created")
      } catch (regenerateError) {
        setError(
          regenerateError instanceof Error
            ? regenerateError.message
            : "Could not regenerate share link."
        )
      }
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          Flyer & share link
        </CardTitle>
        <CardDescription>
          Upload a promotional flyer and share a public page with vendors and the community.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <BazaarFlyerField
          eventId={event.id}
          value={flyerUrl}
          onValueChange={setFlyerUrl}
          disabled={isPending}
          autoSave
          compact
          showHint={false}
        />

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="share-link">Public share link</Label>
            <div className="flex gap-2">
              <Input
                id="share-link"
                readOnly
                value={shareUrl || "Generating link..."}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                disabled={!shareUrl || isPending}
                aria-label="Copy share link"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              {shareUrl ? (
                <Button type="button" variant="outline" size="icon" asChild>
                  <Link href={shareUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can view the bazaar details and flyer.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={handleRegenerateLink}
            disabled={isPending}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate link
          </Button>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
