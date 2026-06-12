"use client"

import * as React from "react"
import { Loader2, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { uploadBazaarFlyer } from "@/lib/vendor-hub/bazaar-flyer-actions"
import { cn } from "@/lib/utils"

export function BazaarFlyerField({
  eventId,
  initialFlyerUrl = "",
  value,
  onValueChange,
  disabled = false,
}: {
  eventId: string
  initialFlyerUrl?: string | null
  value?: string
  onValueChange?: (url: string) => void
  disabled?: boolean
}) {
  const isControlled = value !== undefined
  const [internalFlyerUrl, setInternalFlyerUrl] = React.useState(initialFlyerUrl || "")
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const flyerUrl = isControlled ? value : internalFlyerUrl

  React.useEffect(() => {
    if (!isControlled) {
      setInternalFlyerUrl(initialFlyerUrl || "")
    }
  }, [initialFlyerUrl, isControlled])

  function updateFlyerUrl(url: string) {
    if (isControlled) {
      onValueChange?.(url)
    } else {
      setInternalFlyerUrl(url)
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.")
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("eventId", eventId)

      const result = await uploadBazaarFlyer(formData)
      if (!result.success) {
        throw new Error(result.error)
      }

      updateFlyerUrl(result.url)
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload flyer.")
    } finally {
      setUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  return (
    <div className="space-y-2">
      <Label>Event flyer</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        disabled={uploading || disabled}
        onChange={handleFileChange}
        className="sr-only"
      />

      <button
        type="button"
        onClick={() => !uploading && !disabled && inputRef.current?.click()}
        disabled={uploading || disabled}
        className={cn(
          "group relative flex w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/40 transition-colors",
          "hover:border-primary/50 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "h-48",
          (uploading || disabled) && "cursor-not-allowed opacity-70"
        )}
      >
        {flyerUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={flyerUrl} alt="Bazaar flyer preview" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
              <Plus className="h-8 w-8 text-white" />
            </div>
          </>
        ) : uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <Plus className="h-8 w-8 text-muted-foreground" />
        )}
      </button>

      {flyerUrl ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => updateFlyerUrl("")}
          disabled={uploading || disabled}
        >
          <X className="mr-1.5 h-4 w-4" />
          Remove
        </Button>
      ) : null}

      <p className="text-xs text-muted-foreground">
        PNG, JPG, or WebP up to 10 MB. Shown on the public share page.
      </p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
