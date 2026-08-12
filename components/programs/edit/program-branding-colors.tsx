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
  onBackgroundColorChange,
  flyerFit = "cover",
}: {
  flyerUrl?: string
  onFlyerUrlChange?: (url: string) => void
  programId?: string
  initialBackgroundColor?: string | null
  onBackgroundColorChange?: (color: string) => void
  flyerFit?: "cover" | "contain"
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

  function handleBackgroundChange(color: string) {
    setCommittedBackgroundColor(color)
    onBackgroundColorChange?.(color)
  }

  return (
    <div
      className={
        flyerFit === "contain" ? "w-fit max-w-full space-y-3" : "space-y-3"
      }
    >
      <input type="hidden" name="flyer_url" value={committedFlyerUrl} />
      <input type="hidden" name="background_color" value={committedBackgroundColor} />

      <div className="space-y-4">
        <ProgramFlyerField
          programId={programId}
          value={committedFlyerUrl}
          onValueChange={handleFlyerChange}
          hideHiddenInput
          fit={flyerFit}
        />

        <div className="flex items-center gap-3">
          <Label className="shrink-0">Background Color</Label>
          <BackgroundColorPicker
            value={committedBackgroundColor}
            onChange={handleBackgroundChange}
          />
        </div>
      </div>
    </div>
  )
}
