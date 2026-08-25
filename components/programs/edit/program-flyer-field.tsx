"use client"

import * as React from "react"
import { Loader2, Plus, X } from "lucide-react"

import { FlyerThumbnail } from "@/components/ui/flyer-thumbnail"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { uploadProgramFlyer } from "@/lib/programs/program-flyer-actions"
import { cn } from "@/lib/utils"

export function ProgramFlyerField({
  programId,
  initialFlyerUrl = "",
  value,
  onValueChange,
  onFlyerUrlChange,
  uploadOnly = false,
  hideHiddenInput = false,
  hideLabel = false,
  emptyLabel,
  frameClassName,
  imageClassName: _imageClassName,
  fit: _fit = "cover",
}: {
  programId?: string
  initialFlyerUrl?: string | null
  value?: string
  onValueChange?: (url: string) => void
  onFlyerUrlChange?: (url: string) => void
  uploadOnly?: boolean
  hideHiddenInput?: boolean
  /** Hide the default "Flyer" label above the dropzone. */
  hideLabel?: boolean
  /** Optional text shown under the + when empty (e.g. "Add Flyer"). */
  emptyLabel?: string
  /** Extra classes for the empty upload dropzone. */
  frameClassName?: string
  /** Unused — kept for callers; preview is always a compact thumbnail. */
  imageClassName?: string
  fit?: "cover" | "contain"
}) {
  const isControlled = value !== undefined
  const [internalFlyerUrl, setInternalFlyerUrl] = React.useState(
    initialFlyerUrl || ""
  )
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
    onFlyerUrlChange?.(url)
  }

  function openFilePicker() {
    if (!uploading) {
      inputRef.current?.click()
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
      formData.append("programId", programId || "draft")

      const result = await uploadProgramFlyer(formData)

      if (!result.success) {
        throw new Error(result.error)
      }

      updateFlyerUrl(result.url)
    } catch (uploadError: unknown) {
      console.error("Flyer upload error:", uploadError)
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload flyer."
      )
    } finally {
      setUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  function handleRemove(event: React.MouseEvent) {
    event.stopPropagation()
    updateFlyerUrl("")
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  return (
    <div className="flex w-fit max-w-full flex-col items-start space-y-2">
      {hideLabel ? null : <Label>Flyer</Label>}
      {!hideHiddenInput ? (
        <input type="hidden" name="flyer_url" value={flyerUrl} />
      ) : null}
      <input
        ref={inputRef}
        id="program-flyer"
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={handleFileChange}
        className="sr-only"
      />

      {flyerUrl && !uploadOnly ? (
        <FlyerThumbnail src={flyerUrl} alt="Flyer" />
      ) : (
        <button
          type="button"
          onClick={openFilePicker}
          disabled={uploading}
          className={cn(
            "group relative flex aspect-[3/4] w-28 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/40 transition-colors",
            "hover:border-primary/50 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            emptyLabel && "flex-col gap-1.5",
            uploading && "cursor-wait opacity-70",
            frameClassName
          )}
          data-flyer-frame=""
          aria-label={emptyLabel || "Upload flyer"}
        >
          {flyerUrl && uploadOnly ? (
            <span className="px-2 text-center text-xs text-muted-foreground">
              Flyer uploaded — click to replace
            </span>
          ) : uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Plus className="h-6 w-6 text-muted-foreground" />
              {emptyLabel ? (
                <span className="px-1 text-center text-xs font-medium text-muted-foreground">
                  {emptyLabel}
                </span>
              ) : null}
            </>
          )}
        </button>
      )}

      {flyerUrl ? (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={openFilePicker}
            disabled={uploading}
          >
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={handleRemove}
            disabled={uploading}
          >
            <X className="mr-1.5 h-4 w-4" />
            Remove
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
