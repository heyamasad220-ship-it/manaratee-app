"use client"

import * as React from "react"

import { Label } from "@/components/ui/label"

import { BackgroundColorPicker } from "./background-color-picker"
import { ProgramFlyerField } from "./program-flyer-field"

const DEFAULT_BACKGROUND_COLOR = "#2563eb"

function normalizeHexColor(value: string | null | undefined, fallback: string) {
  if (!value) return fallback

  const trimmed = value.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed
  }

  return fallback
}

export function ProgramBrandingColors({
  flyerUrl,
  onFlyerUrlChange,
  programId,
  initialBackgroundColor,
}: {
  flyerUrl?: string
  onFlyerUrlChange?: (url: string) => void
  programId?: string
  initialBackgroundColor?: string | null
}) {
  const [committedFlyerUrl, setCommittedFlyerUrl] = React.useState(flyerUrl || "")
  const [committedBackgroundColor, setCommittedBackgroundColor] = React.useState(
    normalizeHexColor(initialBackgroundColor, DEFAULT_BACKGROUND_COLOR)
  )

  React.useEffect(() => {
    setCommittedFlyerUrl(flyerUrl || "")
    setCommittedBackgroundColor(
      normalizeHexColor(initialBackgroundColor, DEFAULT_BACKGROUND_COLOR)
    )
  }, [flyerUrl, initialBackgroundColor])

  function handleFlyerChange(url: string) {
    setCommittedFlyerUrl(url)
    onFlyerUrlChange?.(url)
  }

  return (
    <div className="space-y-3 border-t pt-3">
      <input type="hidden" name="flyer_url" value={committedFlyerUrl} />
      <input type="hidden" name="background_color" value={committedBackgroundColor} />

      <div className="grid gap-4 sm:grid-cols-1">
        <ProgramFlyerField
          programId={programId}
          value={committedFlyerUrl}
          onValueChange={handleFlyerChange}
          hideHiddenInput
        />

        <div className="flex items-center gap-3">
          <Label className="shrink-0">Background Color</Label>
          <BackgroundColorPicker
            value={committedBackgroundColor}
            onChange={setCommittedBackgroundColor}
          />
        </div>
      </div>
    </div>
  )
}
