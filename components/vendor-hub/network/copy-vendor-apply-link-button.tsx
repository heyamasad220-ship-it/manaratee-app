"use client"

import { useState } from "react"
import { Link2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { CUSTOMER_VENDOR_APPLY_PATH } from "@/lib/applications/application-routes"

export function CopyVendorApplyLinkButton() {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${CUSTOMER_VENDOR_APPLY_PATH}`)
      setCopied(true)
      toast.success("Vendor apply link copied")
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy link")
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
      <Link2 className="mr-2 h-4 w-4" />
      {copied ? "Copied" : "Copy apply link"}
    </Button>
  )
}
